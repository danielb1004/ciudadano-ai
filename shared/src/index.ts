import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pino from "pino";
import { Redis } from "ioredis";
import { z } from "zod";
import { Pool } from "pg";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["req.headers.authorization", "password", "token", "payload.text", "message"]
});

export const Intent = z.enum([
  "CONSULTA_INFORMATIVA", "SOLICITUD_TRAMITE", "VERIFICACION_ESTADO",
  "REPORTE_PROBLEMA", "DERIVACION_ENTIDAD"
]);
export type Intent = z.infer<typeof Intent>;

export interface ConversationMessage { role: "user" | "assistant" | "system"; content: string; createdAt: string; }
export interface CitizenProfile { id: string; anonymous: boolean; preferences: { fontScale?: number; concise?: boolean; highContrast?: boolean; speechEnabled?: boolean }; techExperience?: string; consents: Consent[]; }
export interface Consent { id: string; purpose: string; granted: boolean; version: string; createdAt: string; revokedAt?: string; }
export interface Recommendation { id: string; title: string; entity: string; description: string; requirements: string[]; steps: string[]; channels: string[]; sourceUrls: string[]; verifiedAt: string; published: boolean; score?: number; category?: string; cost?: string; estimatedTime?: string; hours?: string; version?: number; stale?: boolean; }
export interface WorkflowError { code: string; message: string; retryable: boolean; }
export interface ConversationState {
  conversationId: string; anonymousUserId?: string; messages: ConversationMessage[]; currentMessage: string;
  sanitizedMessage: string; intent?: string; confidence?: number; entities: Record<string, unknown>;
  missingInformation: string[]; profile?: CitizenProfile; recommendations: Recommendation[];
  selectedRecommendation?: Recommendation; requiresClarification: boolean; requiresReferral: boolean;
  sourceUrls: string[]; response?: string; errors: WorkflowError[];
}

export const eventSchema = z.object({
  eventId: z.string().uuid(), eventType: z.string().min(1), eventVersion: z.string(), occurredAt: z.string(),
  correlationId: z.string().uuid(), conversationId: z.string().uuid().optional(), producer: z.string(), payload: z.record(z.unknown())
});
export type EventEnvelope = z.infer<typeof eventSchema>;
export const makeEvent = (eventType: string, producer: string, payload: Record<string, unknown>, correlationId: string = randomUUID(), conversationId?: string): EventEnvelope => ({
  eventId: randomUUID(), eventType, eventVersion: "1.0", occurredAt: new Date().toISOString(), correlationId, conversationId, producer, payload
});

export async function publishEvent(event: EventEnvelope): Promise<void> {
  eventSchema.parse(event);
  if (process.env.KAFKA_BROKERS) { await (await import("./events.js")).enqueueEvent(event); return; }
  if (process.env.AUDIT_URL && event.producer !== "audit-service") {
    const response = await fetch(process.env.AUDIT_URL + "/internal/events", { method: "POST", headers: { "content-type": "application/json", "x-internal-key": process.env.INTERNAL_API_KEY ?? "" }, body: JSON.stringify(event), signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error("Audit persistence unavailable");
  } else logger.info({ eventType: event.eventType, eventId: event.eventId }, "event (local mode without audit collector)");
}

export const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }) : undefined;
export const postgres = process.env.POSTGRES_HOST ? new Pool({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT ?? 5432), user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB, ...(process.env.POSTGRES_SSL_CA ? { ssl: { rejectUnauthorized: true, ca: readFileSync(process.env.POSTGRES_SSL_CA, "utf8") } } : {}) }) : undefined;
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> { if (!postgres) return []; const result = await postgres.query<T>(text, values); return result.rows; }
export async function cacheJson(key: string, value: unknown, ttlSeconds = 900): Promise<void> { if (!redis) return; await redis.set(key, (await import("./store.js")).encode(value), "EX", ttlSeconds); }
export async function readJson<T>(key: string): Promise<T | undefined> { if (!redis) return; const value = await redis.get(key); return value ? (await import("./store.js")).decode<T>(value) : undefined; }

export class CircuitBreaker {
  private failures = 0; private openedAt = 0; private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  constructor(private readonly threshold = 3, private readonly recoveryMs = 10_000) {}
  get status() { return this.state; }
  async execute<T>(operation: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.state === "OPEN") { if (Date.now() - this.openedAt < this.recoveryMs) return fallback(); this.state = "HALF_OPEN"; }
    try { const result = await operation(); this.failures = 0; this.state = "CLOSED"; return result; }
    catch (error) { this.failures++; if (this.failures >= this.threshold) { this.state = "OPEN"; this.openedAt = Date.now(); } logger.warn({ err: error, state: this.state }, "circuit breaker failure"); return fallback(); }
  }
}

export const anonymize = (input: string) => input
  .replace(/(?:\+?57[ .-]?)?3(?:[ .-]?\d){9}\b/g, "[PHONE_REDACTED]")
  .replace(/\b\d{6,12}\b/g, "[ID_REDACTED]")
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[EMAIL_REDACTED]")
  .replace(/\+?57\s?3\d{9}/g, "[PHONE_REDACTED]");

export const errorBody = (code: string, message: string, correlationId: string) => ({ error: { code, message, correlationId } });
export * from "./http.js";

export * from "./security.js";
export * from "./store.js";

export * from "./catalog.js";
