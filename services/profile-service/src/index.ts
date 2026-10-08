import { randomUUID } from "node:crypto";
import { Router } from "express";
import { Store, CitizenProfile, Consent, asyncRoute, makeEvent, publishEvent, requireOwner, internalAccess, internalHeaders, identityHash, signToken } from "@ciudadano-ai/shared";
import { z } from "zod";

export const profiles = new Store<CitizenProfile>("profiles", "citizens");
export const profileRouter = Router();
const preferences = z.object({ fontScale: z.number().min(0.8).max(2).optional(), concise: z.boolean().optional(), highContrast: z.boolean().optional(), speechEnabled: z.boolean().optional() });
const profileInput = z.object({ preferences: preferences.default({}), techExperience: z.string().max(50).optional() });
const consentInput = z.object({ purpose: z.enum(["conversation_context", "usability_research", "analytics"]), version: z.literal("1.0"), granted: z.boolean() });
export async function profileConsent(id: string): Promise<boolean> {
  const profile = await profiles.get(id);
  return Boolean(profile?.consents.filter(c => c.purpose === "conversation_context").at(-1)?.granted);
}
const renewals = new Store<{ profileId: string }>("profiles", "renewals");
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/api/v1/profiles", maxAge: 30 * 86400000 });
const receipt = (operation: string) => ({ receiptId: randomUUID(), operation, completedAt: new Date().toISOString() });
async function conversationData(id: string, method = "GET") {
  const response = await fetch((process.env.CONVERSATION_URL ?? "http://localhost:3001") + "/internal/profiles/" + id + "/data", { method, headers: internalHeaders(), signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error("Conversation export/purge failed");
  return response.json();
}

profileRouter.post("/api/v1/profiles", asyncRoute(async (req, res) => {
  const parsed = profileInput.safeParse(req.body ?? {}); if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Perfil inválido." } });
  const profile: CitizenProfile = { id: randomUUID(), anonymous: true, ...parsed.data, consents: [] };
  await profiles.set(profile.id, profile);
  await publishEvent(makeEvent("profile.created", "auth-service", { profileId: profile.id, anonymous: true }));
  const renewal = randomUUID(); await renewals.set(identityHash(renewal), { profileId: profile.id });
  res.cookie("citizen_profile_renewal", renewal, cookieOptions());
  res.status(201).json({ ...profile, accessToken: signToken({ sub: profile.id, kind: "profile" }), expiresIn: 900 });
}));
profileRouter.post("/api/v1/profiles/token/refresh", asyncRoute(async (req, res) => {
  const token = /(?:^|; )citizen_profile_renewal=([a-f0-9-]{36})(?:;|$)/.exec(req.headers.cookie ?? "")?.[1];
  const entry = token ? await renewals.get(identityHash(token)) : undefined;
  if (!entry || !await profiles.get(entry.profileId)) return res.status(401).json({ error: { code: "PROFILE_EXPIRED", message: "Perfil expirado." } });
  res.json({ id: entry.profileId, accessToken: signToken({ sub: entry.profileId, kind: "profile" }), expiresIn: 900 });
}));
profileRouter.get("/internal/profiles/:id/consent", internalAccess, asyncRoute(async (req, res) => res.json({ granted: await profileConsent(req.params.id) })));
profileRouter.get("/api/v1/profiles/:id", requireOwner, asyncRoute(async (req, res) => {
  const profile = await profiles.get(req.params.id); if (!profile) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Perfil no encontrado." } }); res.json(profile);
}));
profileRouter.patch("/api/v1/profiles/:id", requireOwner, asyncRoute(async (req, res) => {
  const parsed = profileInput.partial().safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Preferencias inválidas." } });
  const updated = await profiles.mutate(req.params.id, async profile => {
    if (!profile) return { result: undefined };
    const value = { ...profile, ...parsed.data, preferences: { ...profile.preferences, ...parsed.data.preferences } };
    return { value, result: value };
  });
  if (!updated) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Perfil no encontrado." } });
  await publishEvent(makeEvent("profile.updated", "auth-service", { profileId: updated.id })); res.json(updated);
}));
profileRouter.get("/api/v1/profiles/:id/consents", requireOwner, asyncRoute(async (req, res) => {
  const profile = await profiles.get(req.params.id); if (!profile) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Perfil no encontrado." } }); res.json({ consents: profile.consents });
}));
profileRouter.post("/api/v1/profiles/:id/consents", requireOwner, asyncRoute(async (req, res) => {
  const parsed = consentInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Consentimiento inválido." } });
  const consent: Consent = { id: randomUUID(), ...parsed.data, createdAt: new Date().toISOString(), ...(!parsed.data.granted ? { revokedAt: new Date().toISOString() } : {}) };
  const found = await profiles.mutate(req.params.id, async profile => {
    if (!profile) return { result: false };
    profile.consents.push(consent); return { value: profile, result: true };
  });
  if (!found) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Perfil no encontrado." } });
  if (consent.purpose === "conversation_context" && !consent.granted) await conversationData(req.params.id, "DELETE");
  await publishEvent(makeEvent(consent.granted ? "consent.granted" : "consent.revoked", "auth-service", { profileId: req.params.id, consentId: consent.id, purpose: consent.purpose }));
  res.status(201).json(consent);
}));
profileRouter.delete("/api/v1/profiles/:id/consents/:consentId", requireOwner, asyncRoute(async (req, res) => {
  const consent = await profiles.mutate<Consent | undefined>(req.params.id, async profile => {
    const prior = profile?.consents.find(c => c.id === req.params.consentId || c.purpose === req.params.consentId);
    if (!profile || !prior) return { value: profile, result: undefined };
    const consent = { ...prior, id: randomUUID(), granted: false, createdAt: new Date().toISOString(), revokedAt: new Date().toISOString() };
    profile.consents.push(consent); return { value: profile, result: consent };
  });
  if (!consent) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Consentimiento no encontrado." } });
  if (consent.purpose === "conversation_context") await conversationData(req.params.id, "DELETE");
  await publishEvent(makeEvent("consent.revoked", "auth-service", { profileId: req.params.id, purpose: consent.purpose })); res.status(204).send();
}));
profileRouter.get("/api/v1/profiles/:id/export", requireOwner, asyncRoute(async (req, res) => {
  const profile = await profiles.get(req.params.id); if (!profile) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Perfil no encontrado." } });
  const conversations = await conversationData(profile.id);
  const proof = receipt("export");
  await publishEvent(makeEvent("profile.exported", "auth-service", { profileId: profile.id, receiptId: proof.receiptId }));
  res.json({ ...proof, retentionPolicy: "Sesión: 15 minutos sin actividad. Perfil: máximo 30 días sin actividad.", citizenData: { profileId: profile.id, anonymous: true, preferences: profile.preferences, consentHistory: profile.consents, activeConsents: profile.consents.filter((c,i,a) => c.granted && !a.slice(i+1).some(n => n.purpose === c.purpose)), revokedConsents: profile.consents.filter(c => !c.granted), totalConsentRecords: profile.consents.length }, conversations });
}));
profileRouter.delete(["/api/v1/profiles/:id/data", "/api/v1/profiles/:id"], requireOwner, asyncRoute(async (req, res) => {
  if (!await profiles.get(req.params.id)) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Perfil no encontrado." } });
  const pending = await profiles.get(req.params.id);
  if (pending) { pending.consents.forEach(c => { c.granted = false; c.revokedAt = new Date().toISOString(); }); await profiles.set(req.params.id, pending); }
  await conversationData(req.params.id, "DELETE"); await profiles.remove(req.params.id);
  for (const renewal of await renewals.list()) if (renewal.value.profileId === req.params.id) await renewals.remove(renewal.key);
  res.clearCookie("citizen_profile_renewal", { path: "/api/v1/profiles", sameSite: "strict", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  const proof = receipt("delete"); await publishEvent(makeEvent("profile.purged", "auth-service", { profileId: req.params.id, receiptId: proof.receiptId }));
  res.json({ success: true, ...proof, message: "Perfil, consentimientos, conversaciones y reportes asociados eliminados." });
}));

const renewalCleanup = setInterval(() => void renewals.cleanup(), 60000); renewalCleanup.unref();
