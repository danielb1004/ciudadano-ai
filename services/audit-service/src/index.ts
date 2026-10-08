import { createHash, createHmac } from "node:crypto";
import { createBaseApp, eventSchema, EventEnvelope, logger, makeEvent, Store, asyncRoute, errorHandler, requireAccess, internalAccess, signingKey } from "@ciudadano-ai/shared";
import { Kafka } from "kafkajs";
export type AuditRecord = EventEnvelope & { hash: string; previousHash?: string; signature: string };
type Ledger = { records: AuditRecord[]; anchor?: string };
const ledger = new Store<Ledger>("audit", "ledger");
const canonical = (value: any): string => {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
};
const redact = (value: any): any => {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/^(text|message|content|comment|password|token|accessToken|refreshToken|code|contact|email|radicado)$/i.test(key)).map(([key,v]) => [key,redact(v)]));
};
const digest = (event: EventEnvelope, previousHash?: string) => createHash("sha256").update(canonical({ event, previousHash })).digest("hex");
const signature = (hash: string) => createHmac("sha256", process.env.AUDIT_SIGNING_KEY ?? signingKey()).update(hash).digest("hex");
export async function appendImmutable(event: EventEnvelope): Promise<AuditRecord> {
  eventSchema.parse(event); const safe = { ...event, payload: redact(event.payload) } as EventEnvelope;
  return ledger.mutate("chain", async old => {
    const next = old ?? { records: [] };
    const existing = next.records.find(r => r.eventId === safe.eventId);
    if (existing) return { value: next, ttlSeconds: 365 * 86400, result: existing };
    const previousHash = next.records.at(-1)?.hash ?? next.anchor;
    const hash = digest(safe, previousHash), record: AuditRecord = { ...safe, hash, previousHash, signature: signature(hash) };
    next.records.push(record);
    const cutoff = Date.now() - Number(process.env.AUDIT_RETENTION_DAYS ?? 365) * 86400000;
    while (next.records.length > 1 && Date.parse(next.records[0].occurredAt) < cutoff) next.anchor = next.records.shift()?.hash;
    return { value: next, ttlSeconds: 365 * 86400, result: record };
  });
}
export function verifyRecords(records: AuditRecord[], anchor?: string) {
  let previousHash = anchor;
  for (const record of records) {
    const { hash, signature: signed, previousHash: storedPrevious, ...event } = record;
    if (storedPrevious !== previousHash || digest(event, storedPrevious) !== hash || signature(hash) !== signed) return { valid: false, brokenAt: record.eventId };
    previousHash = hash;
  }
  return { valid: true, brokenAt: null };
}
export const app = createBaseApp("audit-service");
app.post("/internal/events", internalAccess, asyncRoute(async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_EVENT", message: "Evento inválido." } }); res.status(201).json(await appendImmutable(parsed.data));
}));
app.use("/api/v1/audit", requireAccess("admin", "audit_read"));
app.get("/api/v1/audit/events", asyncRoute(async (req, res) => {
  const records = (await ledger.get("chain"))?.records ?? [];
  const limit = Math.max(1, Math.min(Number(req.query.limit ?? 100) || 100, 500));
  const events = records.filter(e => (!req.query.type || e.eventType === req.query.type) && (!req.query.producer || e.producer === req.query.producer)).slice(-limit).reverse();
  res.json({ events, totalRecords: records.length, retentionDays: Number(process.env.AUDIT_RETENTION_DAYS ?? 365) });
}));
app.get("/api/v1/audit/conversations/:id", asyncRoute(async (req, res) => res.json({ events: ((await ledger.get("chain"))?.records ?? []).filter(e => e.conversationId === req.params.id) })));
app.get("/api/v1/audit/security", asyncRoute(async (_req, res) => res.json({ events: ((await ledger.get("chain"))?.records ?? []).filter(e => e.eventType.startsWith("security.")) })));
app.get("/api/v1/audit/verify-integrity", asyncRoute(async (_req, res) => {
  const chain = await ledger.get("chain") ?? { records: [] };
  res.json({ ...verifyRecords(chain.records, chain.anchor), chainLength: chain.records.length, algorithm: "SHA-256 + HMAC-SHA-256", verifiedAt: new Date().toISOString() });
}));
app.get("/api/v1/audit/stats", asyncRoute(async (_req, res) => {
  const records = (await ledger.get("chain"))?.records ?? [], byType: { [key: string]: number } = {}, byProducer: { [key: string]: number } = {};
  for (const event of records) { byType[event.eventType] = (byType[event.eventType] ?? 0) + 1; byProducer[event.producer] = (byProducer[event.producer] ?? 0) + 1; }
  res.json({ totalEvents: records.length, securityEvents: records.filter(r => r.eventType.startsWith("security.")).length, byType, byProducer, lastEventAt: records.at(-1)?.occurredAt ?? null });
}));
async function consumeEvents() {
  const brokers = (process.env.KAFKA_BROKERS ?? "").split(",").filter(Boolean); if (!brokers.length) return;
  const kafka = new Kafka({ clientId: "audit-consumer", brokers }), consumer = kafka.consumer({ groupId: "audit-service-v1" });
  await consumer.connect(); await consumer.subscribe({ topics: [/^(conversation|profile|consent|recommendation|procedure|request|security)-/], fromBeginning: true });
  await consumer.run({ eachMessage: async ({ topic, message }) => {
    if (!message.value || topic.endsWith(".DLQ")) return;
    try { await appendImmutable(JSON.parse(message.value.toString()) as EventEnvelope); }
    catch (error) {
      logger.error({ err: error }, "invalid audit event");
      const dlq = kafka.producer(); await dlq.connect();
      try { await dlq.send({ topic: topic + ".DLQ", messages: [{ key: message.key, value: JSON.stringify({ reason: "invalid-event", sourceTopic: topic }) }] }); } finally { await dlq.disconnect(); }
    }
  } });
  const shutdown = () => { void consumer.disconnect(); }; process.once("SIGTERM", shutdown); process.once("SIGINT", shutdown);
}
app.use(errorHandler);
if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  void appendImmutable(makeEvent("audit.service.started", "audit-service", { environment: process.env.NODE_ENV ?? "development" })).catch(error => logger.error({ err: error }, "audit startup failed"));
  void consumeEvents().catch(error => { logger.error({ err: error }, "Kafka consumer failed"); process.exitCode = 1; });
  const server = app.listen(Number(process.env.PORT ?? 3005)); process.once("SIGTERM", () => server.close()); process.once("SIGINT", () => server.close());
}
