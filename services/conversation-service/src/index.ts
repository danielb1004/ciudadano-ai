import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Store, anonymize, createBaseApp, asyncRoute, errorHandler, requireOwner, requireAccess, internalAccess, internalHeaders, logger, makeEvent, publishEvent, Recommendation, cacheJson, redis, CircuitBreaker } from "@ciudadano-ai/shared";
type Message = { id: string; role: "user" | "assistant"; content: string; createdAt: string; };
type Session = { id: string; profileId: string; messages: Message[]; selected?: Recommendation; clarificationCount: number; expiresAt: number; createdAt: string; };
type Feedback = { id: string; profileId: string; conversationId: string; messageId: string; rating: string; comment: string; createdAt: string; };
export const sessions = new Store<Session>("conversation", "sessions");
export const feedback = new Store<Feedback>("conversation", "feedback");
export const app = createBaseApp("conversation-service");
const notice = "Este sistema orienta y no reemplaza los canales oficiales.";
const counts = new Store<{ sessions: number; messages: number; referrals: number; totalLatencyMs: number; intents: { [key: string]: number } }>("conversation", "metrics");
const initialCounts = () => ({ sessions: 0, messages: 0, referrals: 0, totalLatencyMs: 0, intents: {} as { [key: string]: number } });
const profileId = (res: any): string => res.locals.claims.profileId ?? res.locals.claims.sub;
async function hasConsent(id: string) {
  const response = await fetch((process.env.AUTH_URL ?? "http://localhost:3004") + "/internal/profiles/" + id + "/consent", { headers: internalHeaders(), signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error("Consent service unavailable"); return Boolean((await response.json() as { granted: boolean }).granted);
}
async function eraseSession(id: string) {
  await sessions.mutate(id, async () => ({ result: undefined })); if (redis) await redis.del("conversation:" + id);
  for (const item of await feedback.list()) if (item.value.conversationId === id) await feedback.remove(item.key);
}
async function recordMetric(intent: string, referral: boolean, latency: number) {
  await counts.mutate("summary", async old => { const v = old ?? initialCounts(); v.messages++; v.intents[intent] = (v.intents[intent] ?? 0) + 1; if (referral) v.referrals++; v.totalLatencyMs += latency; return { value: v, ttlSeconds: 30 * 86400, result: undefined }; });
}
const nlpBreaker = new CircuitBreaker(), recommendationBreaker = new CircuitBreaker();
type Nlp = { intent: string; confidence: number; entities: { [key: string]: unknown } };
export async function processMessage(session: Session, text: string) {
  const safe = anonymize(text).replace(/[<>]/g, ""), followup = /^(y\b|¿?(cuánto|cuanto|qué requisitos|que requisitos|cuáles|cuales|cómo|como|cuándo|cuando)|los requisitos|el costo|el precio)/i.test(safe) && !/(cédula|cedula|pasaporte|rut|sisben|sisbén|licencia|pensión|pension)/i.test(safe);
  const contextual = followup && session.selected ? safe + " sobre " + session.selected.title : safe;
  let nlp: Nlp, unavailable = false;
  try {
    const response = await nlpBreaker.execute(() => fetch((process.env.NLP_URL ?? "http://localhost:8001") + "/api/v1/classify", { method: "POST", headers: internalHeaders(), body: JSON.stringify({ text: contextual }), signal: AbortSignal.timeout(3000) }).then(response => { if (!response.ok) throw new Error("NLP unavailable"); return response; }), () => { throw new Error("NLP circuit open"); });
    if (!response.ok) throw new Error("NLP unavailable"); nlp = await response.json() as Nlp;
    if (!Number.isFinite(nlp.confidence) || nlp.confidence < 0 || nlp.confidence > 1) throw new Error("Invalid confidence");
  } catch { nlp = { intent: "UNAVAILABLE", confidence: 0, entities: {} }; unavailable = true; }

  let response = "", requiresClarification = false, requiresReferral = false, authenticationRequired = false, recommendations: Recommendation[] = [], sources: string[] = [], options: string[] = [];
  const referral = (entity?: Recommendation) => {
    requiresReferral = true; sources = entity?.sourceUrls ?? ["https://www.gov.co/"];
    return "Canal oficial: " + (entity?.entity ?? "Portal GOV.CO, directorio de entidades") + ". " + (entity?.channels.join(", ") || "https://www.gov.co/") + ". Horario: " + (entity?.hours ?? "Consulta el horario de la entidad en su portal.") + " " + sources.join(" ");
  };
  if (unavailable) { response = "El servicio de lenguaje no está disponible. Puedes intentar de nuevo o acudir al canal oficial. " + referral(session.selected); }
  else if (nlp.confidence < 0.70) {
    session.clarificationCount++;
    if (session.clarificationCount >= 2) response = "Tras dos intentos de aclaración, te recomiendo el canal oficial. " + referral(session.selected);
    else { requiresClarification = true; options = ["¿Buscas requisitos de un trámite?", "¿Necesitas consultar el estado de una solicitud?"]; response = "Necesito una aclaración para orientarte con precisión. Indica el trámite y la entidad. " + options.join(" "); }
  } else if (nlp.intent === "VERIFICACION_ESTADO") {
    session.clarificationCount = 0; authenticationRequired = true;
    response = "Para consultar una solicitud propia, verifica tu identidad con un código de un solo uso e indica el radicado en el formulario de seguimiento. El código vence en cinco minutos y el acceso dura quince minutos.";
  } else {
    session.clarificationCount = 0;
    try {
      const result = await recommendationBreaker.execute(() => fetch((process.env.RECOMMENDATION_URL ?? "http://localhost:3003") + "/api/v1/recommendations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: contextual, intent: nlp.intent, entities: nlp.entities }), signal: AbortSignal.timeout(3500) }).then(response => { if (!response.ok) throw new Error("Catalog unavailable"); return response; }), () => { throw new Error("Catalog circuit open"); });
      if (!result.ok) throw new Error("Catalog unavailable");
      const body = await result.json() as { recommendations: Recommendation[]; fromCache?: boolean; synchronizedAt?: string };
      recommendations = body.recommendations.slice(0,3);
      const top = recommendations[0];
      if (!top) response = "La consulta excede el catálogo disponible. " + referral(session.selected);
      else if (nlp.intent === "DERIVACION_ENTIDAD") response = referral(top);
      else {
        session.selected = top; sources = [...new Set(recommendations.flatMap(p => p.sourceUrls))];
        response = top.title + " — " + top.entity + ".\nRequisitos: " + top.requirements.join("; ") +
          "\nCosto: " + top.cost + "\nTiempo estimado: " + top.estimatedTime +
          "\nCanal: " + top.channels.join("; ") + "\nFuente actualizada: " + top.verifiedAt + ". " + top.sourceUrls.join(" ");
        if (top.stale) response += "\nLa ficha supera 90 días desde su revisión. Verifica su vigencia en la fuente oficial.";
        if (body.fromCache) response += "\nInformación en caché. Última sincronización: " + body.synchronizedAt;
      }
    } catch { response = "El catálogo no está disponible. " + referral(session.selected); }
  }
  response += "\n" + notice;
  const now = new Date().toISOString(), user: Message = { id: randomUUID(), role: "user", content: safe, createdAt: now }, assistant: Message = { id: randomUUID(), role: "assistant", content: response, createdAt: now };
  session.messages.push(user, assistant); session.expiresAt = Date.now() + 900000;
  // Bound context so a long session cannot exhaust process memory or Redis.
  session.messages = session.messages.slice(-200);
  return { session, messageId: assistant.id, response, intent: nlp.intent, confidence: nlp.confidence, entities: nlp.entities, recommendations, requiresClarification, requiresReferral, sources, clarificationOptions: options, authenticationRequired };
}
app.post("/api/v1/conversations", requireOwner, asyncRoute(async (_req, res) => {
  const owner = profileId(res);
  if (!await hasConsent(owner)) return res.status(403).json({ error: { code: "CONSENT_REQUIRED", message: "Debes aceptar el tratamiento de datos antes de iniciar la conversación." } });
  const id = randomUUID(), now = new Date().toISOString();
  const session: Session = { id, profileId: owner, messages: [], clarificationCount: 0, expiresAt: Date.now() + 900000, createdAt: now };
  await sessions.set(id, session, 900); await cacheJson("conversation:" + id, session, 900);
  await counts.mutate("summary", async old => { const v = old ?? initialCounts(); v.sessions++; return { value: v, result: undefined }; });
  await publishEvent(makeEvent("conversation.started", "conversation-service", { profileId: owner }, res.locals.correlationId, id));
  res.status(201).json({ conversationId: id, expiresAt: new Date(session.expiresAt).toISOString(), notice });
}));
app.get("/api/v1/conversations/metrics/summary", requireAccess("admin", "audit_read"), asyncRoute(async (_req, res) => {
  const summary = await counts.get("summary") ?? initialCounts(), activeSessions = (await sessions.list()).length;
  res.json({ activeSessions, totalSessions: summary.sessions, totalMessages: summary.messages, totalFeedback: (await feedback.list()).length, intentDistribution: summary.intents, referralRate: summary.messages ? summary.referrals / summary.messages : 0, meanLatencyMs: summary.messages ? summary.totalLatencyMs / summary.messages : null, timestamp: new Date().toISOString() });
}));
const sessionAccess = async (id: string, owner: string) => {
  const session = await sessions.get(id); if (!session) return { status: 410, error: "La sesión expiró tras quince minutos sin actividad. Inicia una nueva conversación." };
  if (session.profileId !== owner) return { status: 403, error: "No puedes acceder a una sesión de otro ciudadano." };
  return { status: 200, session };
};
const conversationAuth = requireOwner;
app.post("/api/v1/conversations/:conversationId/messages", conversationAuth, asyncRoute(async (req, res) => {
  const parsed = z.object({ message: z.string().trim().min(1).max(500) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Escribe entre 1 y 500 caracteres." } });
  const owner = profileId(res), id = req.params.conversationId, access = await sessionAccess(id, owner);
  if (!access.session) return res.status(access.status).json({ error: { code: access.status === 410 ? "SESSION_EXPIRED" : "FORBIDDEN", message: access.error } });
  if (!await hasConsent(owner)) { await eraseSession(id); return res.status(403).json({ error: { code: "CONSENT_REQUIRED", message: "Tu consentimiento fue revocado. No se procesó el mensaje." } }); }
  const started = performance.now();
  const result = await sessions.mutate<Awaited<ReturnType<typeof processMessage>> | undefined>(id, async current => {
    if (!current || current.profileId !== owner) return { result: undefined };
    const result = await processMessage(current, parsed.data.message);
    if (!await hasConsent(owner)) return { result: undefined };
    await cacheJson("conversation:" + id, result.session, 900);
    return { value: result.session, ttlSeconds: 900, result };
  });
  if (!result) return res.status(410).json({ error: { code: "SESSION_EXPIRED", message: "Sesión expirada." } });
  await recordMetric(result.intent, result.requiresReferral, performance.now() - started);
  await publishEvent(makeEvent("conversation.intent.classified", "conversation-service", { intent: result.intent, confidence: result.confidence, requiresReferral: result.requiresReferral }, res.locals.correlationId, id));
  const { session, ...body } = result; res.json({ conversationId: id, expiresAt: new Date(session.expiresAt).toISOString(), ...body });
}));
app.get("/api/v1/conversations/:conversationId", conversationAuth, asyncRoute(async (req, res) => {
  const access = await sessionAccess(req.params.conversationId, profileId(res));
  if (!access.session) return res.status(access.status).json({ error: { code: access.status === 410 ? "SESSION_EXPIRED" : "FORBIDDEN", message: access.error } });
  res.json({ conversationId: access.session.id, messages: access.session.messages, expiresAt: new Date(access.session.expiresAt).toISOString() });
}));
app.delete("/api/v1/conversations/:conversationId", conversationAuth, asyncRoute(async (req, res) => {
  const access = await sessionAccess(req.params.conversationId, profileId(res));
  if (access.status === 403) return res.status(403).json({ error: { code: "FORBIDDEN", message: access.error } });
  await eraseSession(req.params.conversationId); await publishEvent(makeEvent("conversation.deleted", "conversation-service", {}, res.locals.correlationId, req.params.conversationId)); res.status(204).send();
}));
app.post("/api/v1/conversations/:conversationId/feedback", conversationAuth, asyncRoute(async (req, res) => {
  const access = await sessionAccess(req.params.conversationId, profileId(res));
  if (!access.session) return res.status(access.status).json({ error: { code: "SESSION_EXPIRED", message: access.error } });
  const parsed = z.object({ rating: z.enum(["positive","negative","helpful","unhelpful"]), messageId: z.string().uuid(), comment: z.string().max(500).default("") }).safeParse(req.body);
  if (!parsed.success || !access.session.messages.some(m => m.role === "assistant" && m.id === parsed.data?.messageId)) return res.status(400).json({ error: { code: "INVALID_FEEDBACK", message: "Selecciona una respuesta existente." } });
  const entry: Feedback = { id: randomUUID(), profileId: profileId(res), conversationId: req.params.conversationId, ...parsed.data, comment: anonymize(parsed.data.comment), createdAt: new Date().toISOString() };
  await feedback.set(entry.id, entry); await publishEvent(makeEvent("conversation.feedback.submitted", "conversation-service", { feedbackId: entry.id, messageId: entry.messageId, rating: entry.rating }, res.locals.correlationId, entry.conversationId));
  res.status(202).json({ accepted: true, feedbackId: entry.id });
}));
app.get("/api/v1/conversations/feedback/review", requireAccess("admin", "ml_manage"), asyncRoute(async (_req, res) => res.json({ reports: (await feedback.list()).map(x => x.value), purpose: "Revisión humana antes de ampliar el corpus." })));
app.get("/internal/profiles/:id/data", internalAccess, asyncRoute(async (req, res) => res.json({ sessions: (await sessions.list()).filter(x => x.value.profileId === req.params.id).map(x => x.value), feedback: (await feedback.list()).filter(x => x.value.profileId === req.params.id).map(x => x.value) })));
app.delete("/internal/profiles/:id/data", internalAccess, asyncRoute(async (req, res) => {
  for (const item of await sessions.list()) if (item.value.profileId === req.params.id) await eraseSession(item.key);
  for (const item of await feedback.list()) if (item.value.profileId === req.params.id) await feedback.remove(item.key);
  res.json({ success: true });
}));
app.use(errorHandler);
const cleanup = setInterval(() => { void Promise.all([sessions.cleanup(), feedback.cleanup(), counts.cleanup()]).catch(error => logger.error({ err: error }, "retention cleanup failed")); }, 60000); cleanup.unref();
if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  const server = app.listen(Number(process.env.PORT ?? 3001)); process.once("SIGTERM", () => server.close()); process.once("SIGINT", () => server.close());
}
