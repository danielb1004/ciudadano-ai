import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { institutionalMockEnabled, createBaseApp, logger, makeEvent, publishEvent, Store, signToken, signingKey, identityHash, requireAccess, requireOwner, bearer, asyncRoute, errorHandler } from "@ciudadano-ai/shared";
import { profileRouter, profiles, profileConsent } from "profile-service";
import { z } from "zod";

export type Admin = { id: string; email: string; name: string; passwordHash: string; roles: string[]; permissions: string[]; revoked: boolean; createdAt: string; };
export const admins = new Store<Admin>("auth", "admins");
const refreshTokens = new Store<{ adminId: string }>("auth", "refresh");
type Challenge = { id: string; profileId: string; identityHash: string; codeHash: string; expiresAt: number; attempts: number; blockedUntil: number; };
export const challenges = new Store<Challenge>("auth", "otp");
const failedLogins = new Store<{ count: number; blockedUntil: number }>("auth", "login-attempts");
const codeHash = (id: string, code: string) => createHmac("sha256", signingKey()).update(id + ":" + code).digest("hex");
export const app = createBaseApp("auth-service");
app.use(profileRouter);
export const initialized = (async () => {
  const password = process.env.DEFAULT_ADMIN_PASSWORD ?? (process.env.NODE_ENV !== "production" ? "AdminCiudadano2026!" : undefined);
  if (!password) return;
  if (!await admins.get("admin-system-master")) await admins.set("admin-system-master", { id: "admin-system-master", email: "admin@ciudadano.gov.co", name: "Administrador", passwordHash: await bcrypt.hash(password, 12), roles: ["super_admin"], permissions: ["catalog_read", "catalog_write", "audit_read", "ml_manage", "users_manage"], revoked: false, createdAt: new Date().toISOString() }, 365 * 86400);
})();
async function issueTokens(admin: Admin) {
  const refreshToken = randomUUID(); await refreshTokens.set(identityHash(refreshToken), { adminId: admin.id }, 7 * 86400);
  return { accessToken: signToken({ sub: admin.id, kind: "admin", roles: admin.roles, permissions: admin.permissions }), refreshToken, expiresIn: 900, user: { id: admin.id, email: admin.email, name: admin.name, roles: admin.roles, permissions: admin.permissions } };
}
app.post("/api/v1/auth/login", asyncRoute(async (req, res) => {
  await initialized;
  const parsed = z.object({ email: z.string().email().max(160), password: z.string().min(8).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Credenciales inválidas." } });
  const key = identityHash(parsed.data.email), attempt = await failedLogins.get(key);
  if (attempt && attempt.blockedUntil > Date.now()) return res.status(429).json({ error: { code: "ACCOUNT_LOCKED", message: "Espera cinco minutos antes de intentar de nuevo." } });
  const admin = (await admins.list()).map(x => x.value).find(a => a.email.toLowerCase() === parsed.data.email.toLowerCase());
  if (!admin || admin.revoked || !await bcrypt.compare(parsed.data.password, admin.passwordHash)) {
    const count = (attempt?.count ?? 0) + 1; await failedLogins.set(key, { count, blockedUntil: count >= 3 ? Date.now() + 300000 : 0 }, 300);
    await publishEvent(makeEvent("security.access.failed", "auth-service", { identityHash: key, attemptCount: count }));
    return res.status(count >= 3 ? 429 : 401).json({ error: { code: count >= 3 ? "ACCOUNT_LOCKED" : "UNAUTHORIZED", message: count >= 3 ? "Tres intentos fallidos. Espera cinco minutos." : "Correo o contraseña incorrectos." } });
  }
  await failedLogins.remove(key); await publishEvent(makeEvent("security.user.authenticated", "auth-service", { adminId: admin.id }));
  res.json(await issueTokens(admin));
}));
app.post("/api/v1/auth/refresh", asyncRoute(async (req, res) => {
  const token = String(req.body?.refreshToken ?? "");
  const entry = await refreshTokens.mutate(identityHash(token), async old => ({ result: old }));
  const admin = entry ? await admins.get(entry.adminId) : undefined;
  if (!admin || admin.revoked) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Refresh token inválido o expirado." } });
  res.json(await issueTokens(admin));
}));
app.post("/api/v1/auth/logout", asyncRoute(async (req, res) => { if (req.body?.refreshToken) await refreshTokens.remove(identityHash(req.body.refreshToken)); res.status(204).send(); }));
app.get("/api/v1/auth/me", (req, res) => { const claims = bearer(req); if (!claims) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Autenticación requerida." } }); res.json(claims); });
app.get("/api/v1/auth/admins", requireAccess("admin", "users_manage"), asyncRoute(async (_req, res) => res.json({ admins: (await admins.list()).map(({ value: { passwordHash, ...admin } }) => admin) })));
app.post("/api/v1/auth/admins", requireAccess("admin", "users_manage"), asyncRoute(async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(12).max(200), name: z.string().min(2), roles: z.array(z.string()), permissions: z.array(z.string()) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Datos de administrador inválidos." } });
  if ((await admins.list()).some(x => x.value.email === parsed.data.email)) return res.status(409).json({ error: { code: "CONFLICT", message: "El correo ya está registrado." } });
  const { password, ...data } = parsed.data, admin = { ...data, id: randomUUID(), passwordHash: await bcrypt.hash(password, 12), revoked: false, createdAt: new Date().toISOString() };
  await admins.set(admin.id, admin, 365 * 86400); res.status(201).json({ id: admin.id, email: admin.email });
}));
app.post("/api/v1/auth/otp/request", requireOwner, asyncRoute(async (req, res) => {
  const parsed = z.object({ contact: z.string().email().max(160) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Introduce un correo válido." } });
  const profileId = res.locals.claims.profileId ?? res.locals.claims.sub;
  if (!await profiles.get(profileId)) return res.status(401).json({ error: { code: "PROFILE_EXPIRED", message: "Inicia de nuevo tu sesión." } });
  if (!await profileConsent(profileId)) return res.status(403).json({ error: { code: "CONSENT_REQUIRED", message: "Acepta el consentimiento antes de verificar tu identidad." } });
  const mock = institutionalMockEnabled();
  if (!mock && !process.env.OTP_DELIVERY_URL) return res.status(503).json({ error: { code: "OTP_UNAVAILABLE", message: "Verificación de identidad no disponible. Consulta el canal oficial." } });
  const key = identityHash(parsed.data.contact), code = String(randomInt(100000, 1000000));
  const result = await challenges.mutate(key, async old => {
    if (old && old.blockedUntil > Date.now()) return { value: old, ttlSeconds: 600, result: { blocked: true, challenge: old } };
    const next: Challenge = { id: randomUUID(), profileId, identityHash: key, codeHash: "", expiresAt: Date.now() + 300000, attempts: old && old.expiresAt > Date.now() ? old.attempts : 0, blockedUntil: 0 };
    next.codeHash = codeHash(next.id, code); return { value: next, ttlSeconds: 600, result: { blocked: false, challenge: next } };
  });
  if (result.blocked) return res.status(429).json({ error: { code: "ACCOUNT_LOCKED", message: "Espera cinco minutos. Canal alterno: https://www.gov.co/" } });
  if (!mock) {
    const delivered = await fetch(process.env.OTP_DELIVERY_URL!, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + (process.env.OTP_DELIVERY_TOKEN ?? "") }, body: JSON.stringify({ contact: parsed.data.contact, code, expiresIn: 300 }), signal: AbortSignal.timeout(3000) });
    if (!delivered.ok) { await challenges.remove(key); throw new Error("OTP delivery failed"); }
  }
  await publishEvent(makeEvent("security.otp.requested", "auth-service", { profileId }));
  res.status(201).json({ challengeId: result.challenge.id, expiresIn: 300, mode: mock ? "simulated" : "provider", ...(mock ? { demoCode: code } : {}) });
}));
app.post("/api/v1/auth/otp/verify", requireOwner, asyncRoute(async (req, res) => {
  const parsed = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Código inválido." } });
  const profileId = res.locals.claims.profileId ?? res.locals.claims.sub;
  const found = (await challenges.list()).find(x => x.value.id === parsed.data.challengeId && x.value.profileId === profileId);
  if (!found) return res.status(401).json({ error: { code: "INVALID_CODE", message: "Código inválido, usado o expirado." } });
  const result = await challenges.mutate(found.key, async current => {
    if (!current || current.id !== parsed.data.challengeId || current.profileId !== profileId) return { value: current, result: { status: 401, hash: "" } };
    if (current.blockedUntil > Date.now()) return { value: current, ttlSeconds: 600, result: { status: 429, hash: "" } };
    if (current.expiresAt <= Date.now()) return { result: { status: 401, hash: "" } };
    if (timingSafeEqual(Buffer.from(current.codeHash, "hex"), Buffer.from(codeHash(current.id, parsed.data.code), "hex"))) return { result: { status: 200, hash: current.identityHash } };
    current.attempts++;
    if (current.attempts >= 3) current.blockedUntil = Date.now() + 300000;
    return { value: current, ttlSeconds: 600, result: { status: current.attempts >= 3 ? 429 : 401, hash: "" } };
  });
  if (result.status !== 200) {
    await publishEvent(makeEvent("security.otp.failed", "auth-service", { profileId }));
    return res.status(result.status).json({ error: { code: result.status === 429 ? "ACCOUNT_LOCKED" : "INVALID_CODE", message: result.status === 429 ? "Tres intentos fallidos. Bloqueo de cinco minutos. Usa el canal oficial." : "Código inválido o expirado." } });
  }
  await publishEvent(makeEvent("security.citizen.authenticated", "auth-service", { profileId }));
  res.json({ accessToken: signToken({ sub: profileId, profileId, kind: "citizen", identityHash: result.hash }), expiresIn: 900 });
}));
app.use(errorHandler);
const cleanup = setInterval(() => { void Promise.all([profiles.cleanup(), challenges.cleanup(), refreshTokens.cleanup(), failedLogins.cleanup()]).catch(error => logger.error({ err: error }, "retention cleanup failed")); }, 60000); cleanup.unref();
if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  const server = app.listen(Number(process.env.PORT ?? 3004));
  process.once("SIGTERM", () => server.close()); process.once("SIGINT", () => server.close());
}
