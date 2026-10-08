import { startEventDelivery } from "./events.js";
import express, { Express, Request, Response, NextFunction, RequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { errorBody, logger, postgres, redis } from "./index.js";

export const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler => (req, res, next) => { Promise.resolve(fn(req, res)).catch(next); };
export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError && "body" in error) return res.status(400).json(errorBody("VALIDATION_ERROR", "JSON inválido.", res.locals.correlationId));
  logger.error({ err: error }, "request failed"); res.status(503).json(errorBody("SERVICE_UNAVAILABLE", "Servicio temporalmente no disponible. Intenta de nuevo o usa el canal oficial.", res.locals.correlationId));
};
export function createBaseApp(serviceName: string): Express {
  startEventDelivery(serviceName);
  const app = express(); app.disable("x-powered-by");
  if (process.env.TRUSTED_PROXIES) app.set("trust proxy", process.env.TRUSTED_PROXIES.split(","));
  app.use(helmet()); app.use(cors({ origin: process.env.PUBLIC_ORIGIN ?? "http://localhost:5173", credentials: true }));
  app.use(express.json({ limit: "64kb" }));
  const stats = { count: 0, totalMs: 0, failures: 0 };
  app.use((req, res, next) => {
    const supplied = String(req.header("x-correlation-id") ?? ""), correlationId = /^[\da-f-]{36}$/i.test(supplied) ? supplied : randomUUID();
    res.setHeader("x-correlation-id", correlationId); res.locals.correlationId = correlationId;
    const started = performance.now();
    res.on("finish", () => { stats.count++; stats.totalMs += performance.now() - started; if (res.statusCode >= 500) stats.failures++; });
    logger.info({ serviceName, method: req.method, correlationId }, "request"); next();
  });
  app.use("/api/v1", rateLimit(60, 60_000));
  app.get("/health", (_req, res) => res.json({ status: "ok", service: serviceName, uptimeSeconds: Math.round(process.uptime()) }));
  app.get("/ready", asyncRoute(async (_req, res) => {
    if (postgres) await postgres.query("SELECT 1"); if (redis) await redis.ping();
    if (process.env.NODE_ENV === "production" && !postgres) return res.status(503).json({ status: "not_ready", reason: "PostgreSQL required in production" });
    res.json({ status: "ready", storage: postgres ? "postgres" : "local-memory", cache: redis ? "redis" : "local-memory" });
  }));
  app.get("/metrics", (_req, res) => res.type("text/plain").send(
    '# TYPE http_requests_total counter\nhttp_requests_total{service="' + serviceName + '"} ' + stats.count +
    '\n# TYPE http_request_duration_ms_sum counter\nhttp_request_duration_ms_sum{service="' + serviceName + '"} ' + stats.totalMs +
    '\n# TYPE http_failures_total counter\nhttp_failures_total{service="' + serviceName + '"} ' + stats.failures + '\n'));
  return app;
}
export const requireJson = (schema: { safeParse: (value: unknown) => { success: boolean; data?: unknown } }) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body); if (!result.success) return res.status(400).json(errorBody("VALIDATION_ERROR", "La solicitud no tiene un formato válido.", res.locals.correlationId)); req.body = result.data; next();
};
export function rateLimit(maxRequests = 60, windowMs = 60_000) {
  const requests = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown", now = Date.now(), current = requests.get(key);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    entry.count++; requests.set(key, entry);
    if (requests.size > 5000) for (const [ip, item] of requests) if (item.resetAt <= now) requests.delete(ip);
    res.setHeader("x-ratelimit-limit", maxRequests);
    if (entry.count > maxRequests) { res.setHeader("retry-after", Math.ceil((entry.resetAt - now) / 1000)); return res.status(429).json(errorBody("RATE_LIMITED", "Demasiadas solicitudes. Intenta más tarde.", res.locals.correlationId)); } next();
  };
}
