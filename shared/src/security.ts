import { createHmac, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export interface Claims { sub: string; kind: "profile" | "citizen" | "admin"; profileId?: string; identityHash?: string; roles?: string[]; permissions?: string[]; }
export function signingKey(): string {
  const key = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && (!key || key.length < 32 || /change|replace|development/i.test(key))) throw new Error("Configura JWT_SECRET con al menos 32 caracteres aleatorios.");
  return key ?? "development-only-change-me-32-bytes";
}
export const signToken = (claims: Claims, seconds = 900) => jwt.sign(claims, signingKey(), { expiresIn: seconds, issuer: "ciudadano-ai", audience: "ciudadano-ai", jwtid: randomUUID(), algorithm: "HS256" });
export const verifyToken = (token: string) => jwt.verify(token, signingKey(), { issuer: "ciudadano-ai", audience: "ciudadano-ai", algorithms: ["HS256"] }) as Claims;
export function bearer(req: Request): Claims | undefined {
  try { return verifyToken(String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "")); } catch { return undefined; }
}
export function requireAccess(kind: Claims["kind"], permission?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const claims = bearer(req);
    if (!claims) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Autenticación requerida o sesión expirada." } });
    if (claims.kind !== kind || (permission && !claims.permissions?.includes(permission))) return res.status(403).json({ error: { code: "FORBIDDEN", message: "No tienes permiso para esta operación." } });
    res.locals.claims = claims; next();
  };
}
export function requireOwner(req: Request, res: Response, next: NextFunction) {
  const claims = bearer(req);
  if (!claims) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Inicia una sesión para acceder a tus datos." } });
  const owner = claims.profileId ?? claims.sub;
  if (claims.kind === "admin" || (req.params.id && req.params.id !== owner)) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Sólo puedes acceder a tus propios datos." } });
  res.locals.claims = claims; next();
}
export const identityHash = (contact: string) => {
  const key = process.env.IDENTITY_HASH_KEY ?? (process.env.NODE_ENV !== "production" ? process.env.INTERNAL_API_KEY ?? signingKey() : undefined);
  if (!key || (process.env.NODE_ENV === "production" && key.length < 32)) throw new Error("Configura IDENTITY_HASH_KEY independiente de JWT_SECRET.");
  return createHmac("sha256", key).update(contact.trim().toLowerCase()).digest("hex");
};
export const internalAccess = (req: Request, res: Response, next: NextFunction) => {
  const key = process.env.INTERNAL_API_KEY;
  if (!key || req.header("x-internal-key") !== key) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Acceso interno requerido." } });
  next();
};
export const internalHeaders = () => ({ "content-type": "application/json", "x-internal-key": process.env.INTERNAL_API_KEY ?? "" });

/** Academic deployment exposes only labeled synthetic OTP/status records. */
export const institutionalMockEnabled = () => process.env.INSTITUTIONAL_MODE === "mock" && (process.env.NODE_ENV !== "production" || process.env.DEPLOYMENT_MODE === "academic");
