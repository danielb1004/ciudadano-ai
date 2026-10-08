import { z } from "zod";
import { createBaseApp, logger, asyncRoute, errorHandler, requireAccess, Store, Recommendation, seedCatalog, publishEvent, makeEvent, identityHash, internalHeaders } from "@ciudadano-ai/shared";
import { institutionalMockEnabled } from "@ciudadano-ai/shared";
type Record = { current: Recommendation; versions: Recommendation[] };
export const procedures = new Store<Record>("catalog", "procedures");
export const app = createBaseApp("catalog-service");
const officialUrl = z.string().url().refine(value => { const u = new URL(value); return u.protocol === "https:" && (u.hostname.endsWith(".gov.co") || u.hostname === "gov.co" || u.hostname.endsWith(".mil.co")); }, "La fuente debe ser un portal oficial HTTPS .gov.co o .mil.co");
const schema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,80}$/), title: z.string().min(5).max(200), entity: z.string().min(3).max(200),
  category: z.string().max(100).default("General"), description: z.string().min(10).max(4000),
  requirements: z.array(z.string().max(500)).max(30).default([]), steps: z.array(z.string().max(500)).max(30).default([]),
  channels: z.array(z.string().max(200)).max(20).default([]), sourceUrls: z.array(officialUrl).min(1).max(10),
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => Number.isFinite(Date.parse(s)) && s === new Date(s).toISOString().slice(0,10) && Date.parse(s) <= Date.now(), "Fecha de fuente inválida"),
  published: z.boolean().default(true), cost: z.string().min(3).max(500), estimatedTime: z.string().min(3).max(500), hours: z.string().min(3).max(500)
});
export const initialized = (async () => {
  for (const item of seedCatalog) if (!await procedures.get(item.id)) {
    const current = { ...item, version: 1, cost: "Consultar la tarifa vigente en la fuente oficial.", estimatedTime: "Consultar el plazo vigente en la fuente oficial.", hours: "Consultar el horario vigente en el canal oficial." };
    await procedures.set(item.id, { current, versions: [current] }, 3650 * 86400);
  }
})();
const stale = (p: Recommendation) => ({ ...p, stale: Date.now() - Date.parse(p.verifiedAt) > 90 * 86400000 });
const terms = (text: string): string[] => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").match(/[a-z0-9]+/g) ?? [];
app.get("/api/v1/procedures/search", asyncRoute(async (req, res) => {
  await initialized; const words = terms(String(req.query.q ?? ""));
  const items = (await procedures.list()).map(x => x.value.current).filter(p => p.published);
  res.json({ results: items.filter(p => !words.length || words.some(w => terms(p.title + " " + p.description + " " + p.entity).includes(w))).map(stale), synchronizedAt: new Date().toISOString() });
}));
app.get("/api/v1/procedures", asyncRoute(async (req, res) => {
  await initialized;
  if (req.query.all === "true") {
    const { bearer } = await import("@ciudadano-ai/shared"); const claims = bearer(req);
    if (claims?.kind !== "admin" || !claims.permissions?.includes("catalog_read")) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Acceso administrativo requerido." } });
  }
  const items = (await procedures.list()).map(x => x.value.current).filter(p => req.query.all === "true" || p.published);
  res.json({ procedures: items.map(stale), total: items.length, synchronizedAt: new Date().toISOString() });
}));
app.get("/api/v1/procedures/:id/versions", requireAccess("admin", "catalog_read"), asyncRoute(async (req, res) => {
  await initialized; const item = await procedures.get(req.params.id);
  if (!item) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Trámite no encontrado." } }); res.json({ versions: item.versions });
}));
app.get("/api/v1/procedures/:id", asyncRoute(async (req, res) => {
  await initialized; const item = await procedures.get(req.params.id);
  if (!item?.current.published) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Trámite no publicado o no encontrado." } }); res.json(stale(item.current));
}));
app.post("/api/v1/procedures", requireAccess("admin", "catalog_write"), asyncRoute(async (req, res) => {
  await initialized; const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues.map(i => i.path.join(".") + ": " + i.message).join("; ") } });
  const created = await procedures.mutate(parsed.data.id, async old => {
    if (old) return { value: old, ttlSeconds: 3650 * 86400, result: false };
    const current = { ...parsed.data, version: 1 }; return { value: { current, versions: [current] }, ttlSeconds: 3650 * 86400, result: true };
  });
  if (!created) return res.status(409).json({ error: { code: "CONFLICT", message: "El ID ya existe, usa actualización." } });
  await publishEvent(makeEvent("procedure.created", "catalog-service", { procedureId: parsed.data.id, version: 1 })); res.status(201).json((await procedures.get(parsed.data.id))?.current);
}));
app.put("/api/v1/procedures/:id", requireAccess("admin", "catalog_write"), asyncRoute(async (req, res) => {
  await initialized;
  const result = await procedures.mutate<{ status: number; current: Recommendation | undefined }>(req.params.id, async old => {
    if (!old) return { result: { status: 404, current: undefined as Recommendation | undefined } };
    const parsed = schema.safeParse({ ...old.current, ...req.body, id: req.params.id });
    if (!parsed.success) return { value: old, ttlSeconds: 3650 * 86400, result: { status: 400, current: undefined } };
    const current = { ...parsed.data, version: (old.current.version ?? 1) + 1 };
    return { value: { current, versions: [...old.versions, current] }, ttlSeconds: 3650 * 86400, result: { status: 200, current } };
  });
  if (!result.current) return res.status(result.status).json({ error: { code: result.status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR", message: "Trámite ausente o ficha incompleta." } });
  await publishEvent(makeEvent("procedure.updated", "catalog-service", { procedureId: req.params.id, version: result.current.version })); res.json(result.current);
}));
app.delete("/api/v1/procedures/:id", requireAccess("admin", "catalog_write"), asyncRoute(async (req, res) => {
  await initialized;
  const found = await procedures.mutate(req.params.id, async old => {
    if (!old) return { result: false };
    const current = { ...old.current, published: false, version: (old.current.version ?? 1) + 1 };
    return { value: { current, versions: [...old.versions, current] }, ttlSeconds: 3650 * 86400, result: true };
  });
  if (!found) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Trámite no encontrado." } });
  await publishEvent(makeEvent("procedure.deactivated", "catalog-service", { procedureId: req.params.id })); res.status(204).send();
}));
app.get("/api/v1/entities", asyncRoute(async (_req, res) => { await initialized; res.json({ entities: [...new Set((await procedures.list()).filter(x => x.value.current.published).map(x => x.value.current.entity))] }); }));
app.get("/api/v1/categories", asyncRoute(async (_req, res) => { await initialized; res.json({ categories: [...new Set((await procedures.list()).filter(x => x.value.current.published).map(x => x.value.current.category))] }); }));
app.post("/api/v1/requests/status", requireAccess("citizen"), asyncRoute(async (req, res) => {
  const parsed = z.object({ radicado: z.string().regex(/^[A-Z0-9-]{3,50}$/i) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Radicado inválido." } });
  const claims = res.locals.claims;
  const consent = await fetch((process.env.AUTH_URL ?? "http://localhost:3004") + "/internal/profiles/" + claims.profileId + "/consent", { headers: internalHeaders(), signal: AbortSignal.timeout(3000) });
  if (!consent.ok) throw new Error("Consent verification unavailable");
  if (!(await consent.json() as { granted: boolean }).granted) return res.status(403).json({ error: { code: "CONSENT_REQUIRED", message: "Tu consentimiento no está vigente." } });
  const mock = institutionalMockEnabled();
  let record: { ownerHash: string; state: string; updatedAt: string; entity: string; channel: string } | undefined;
  try {
    if (mock) {
      if (process.env.MOCK_STATUS_UNAVAILABLE === "true") throw new Error("Simulated outage");
      if (parsed.data.radicado.toUpperCase() === "DEMO-001") record = { ownerHash: identityHash("ciudadano-demo@example.test"), state: "En revisión", updatedAt: "2026-01-01T12:00:00Z", entity: "Entidad de demostración", channel: "https://www.gov.co/" };
    } else {
      if (!process.env.INSTITUTIONAL_STATUS_URL) throw new Error("Institutional adapter not configured");
      const response = await fetch(process.env.INSTITUTIONAL_STATUS_URL + "/" + encodeURIComponent(parsed.data.radicado), { headers: { authorization: "Bearer " + (process.env.INSTITUTIONAL_API_TOKEN ?? "") }, signal: AbortSignal.timeout(3000) });
      if (response.status !== 404 && !response.ok) throw new Error("Institutional API unavailable");
      if (response.ok) record = z.object({ ownerHash: z.string().regex(/^[a-f0-9]{64}$/), state: z.string().min(1).max(100), updatedAt: z.string().datetime(), entity: z.string().min(1).max(200), channel: officialUrl }).parse(await response.json());
    }
  } catch {
    await publishEvent(makeEvent("request.status.unavailable", "catalog-service", { profileId: claims.profileId }));
    return res.status(503).json({ error: { code: "INSTITUTIONAL_UNAVAILABLE", message: "La API institucional no está disponible. No se entrega un estado parcial.", channel: "https://www.gov.co/" } });
  }
  if (!record) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Solicitud no encontrada. Verifica el radicado en el canal oficial." } });
  if (record.ownerHash !== claims.identityHash) {
    await publishEvent(makeEvent("security.request.denied", "catalog-service", { profileId: claims.profileId }));
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "El radicado no corresponde al ciudadano autenticado." } });
  }
  await publishEvent(makeEvent("request.status.accessed", "catalog-service", { profileId: claims.profileId, mode: mock ? "simulated" : "institutional" }));
  res.json({ radicado: parsed.data.radicado, state: record.state, updatedAt: record.updatedAt, entity: record.entity, channel: record.channel, simulated: mock, notice: "Este sistema orienta y no reemplaza los canales oficiales." });
}));
app.use(errorHandler);
if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  const server = app.listen(Number(process.env.PORT ?? 3002)); process.once("SIGTERM", () => server.close()); process.once("SIGINT", () => server.close());
}
