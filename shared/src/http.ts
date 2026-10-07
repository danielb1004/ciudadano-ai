import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { errorBody, logger } from "./index.js";

export function createBaseApp(serviceName: string): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: process.env.PUBLIC_ORIGIN ?? "http://localhost:5173", credentials: true }));
  app.use(express.json({ limit: "64kb" }));
  app.use((req, res, next) => { const correlationId = String(req.header("x-correlation-id") ?? randomUUID()); res.setHeader("x-correlation-id", correlationId); res.locals.correlationId = correlationId; logger.info({ serviceName, method: req.method, path: req.path, correlationId }, "request"); next(); });
  app.get("/health", (_req, res) => res.json({ status: "ok", service: serviceName, uptimeSeconds: Math.round(process.uptime()) }));
  app.get("/ready", (_req, res) => res.json({ status: "ready", dependencies: { postgres: "unknown", redis: "unknown", kafka: "unknown" } }));
  app.get("/metrics", (_req, res) => res.type("text/plain").send(`# HELP http_requests_total Total HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total{service="${serviceName}"} 1\n`));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => { logger.error({ err: error }, "unhandled request error"); res.status(500).json(errorBody("INTERNAL_ERROR", "Error interno. Intenta nuevamente.", res.locals.correlationId)); });
  return app;
}

export const requireJson = (schema: { safeParse: (value: unknown) => { success: boolean; data?: unknown } }) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body); if (!result.success) return res.status(400).json(errorBody("VALIDATION_ERROR", "La solicitud no tiene un formato válido.", res.locals.correlationId)); req.body = result.data; next();
};

export function rateLimit(maxRequests = 60, windowMs = 60_000) {
  const requests = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => { const key = req.ip ?? "unknown"; const now = Date.now(); const current = requests.get(key); const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current; entry.count++; requests.set(key, entry); res.setHeader("x-ratelimit-limit", maxRequests); if (entry.count > maxRequests) return res.status(429).json(errorBody("RATE_LIMITED", "Demasiadas solicitudes. Intenta más tarde.", res.locals.correlationId)); next(); };
}
