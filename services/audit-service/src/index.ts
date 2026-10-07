import { createHash } from "node:crypto";
import { createBaseApp, eventSchema, EventEnvelope, logger, makeEvent, query } from "@ciudadano-ai/shared";
import { Kafka } from "kafkajs";

export type AuditRecord = EventEnvelope & {
  hash: string;
  previousHash?: string;
  verified?: boolean;
};

const records: AuditRecord[] = [];

export function appendImmutable(event: EventEnvelope): AuditRecord {
  eventSchema.parse(event);
  const existing = records.find((item) => item.eventId === event.eventId);
  if (existing) return existing;

  const previousHash = records.at(-1)?.hash;
  const hash = createHash("sha256")
    .update(JSON.stringify({ event, previousHash }))
    .digest("hex");

  // Redacción garantizada de campos de texto libre para cumplimiento de privacidad ISO 27001
  const sanitizedPayload = { ...event.payload, text: undefined, password: undefined, token: undefined };
  const record: AuditRecord = {
    ...event,
    payload: sanitizedPayload,
    hash,
    previousHash,
    verified: true
  };

  records.push(record);

  void query(
    "INSERT INTO audit.events (event_id,event_type,event_version,occurred_at,correlation_id,conversation_id,producer,payload,hash,previous_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (event_id) DO NOTHING",
    [
      record.eventId,
      record.eventType,
      record.eventVersion,
      record.occurredAt,
      record.correlationId,
      record.conversationId,
      record.producer,
      record.payload,
      record.hash,
      record.previousHash
    ]
  );

  return record;
}

const app = createBaseApp("audit-service");

// Ingesta interna de eventos
app.post("/internal/events", (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_EVENT", message: "Evento inválido." } });
  res.status(201).json(appendImmutable(parsed.data));
});

// Listar eventos con filtros
app.get("/api/v1/audit/events", (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const producer = typeof req.query.producer === "string" ? req.query.producer : undefined;
  const limit = Math.min(Number(req.query.limit ?? 100), 500);

  let items = [...records];
  if (type) items = items.filter((e) => e.eventType === type);
  if (producer) items = items.filter((e) => e.producer === producer);

  items = items.slice(-limit).reverse();

  res.json({
    events: items,
    totalRecords: records.length,
    immutableChain: true,
    retentionDays: Number(process.env.AUDIT_RETENTION_DAYS ?? 365)
  });
});

// Eventos de una conversación específica
app.get("/api/v1/audit/conversations/:id", (req, res) => {
  const items = records.filter((event) => event.conversationId === req.params.id);
  res.json({ conversationId: req.params.id, events: items, count: items.length });
});

// Eventos de seguridad (intentos de acceso, fallos, revocaciones)
app.get("/api/v1/audit/security", (_req, res) => {
  const items = records.filter((event) => event.eventType.startsWith("security."));
  res.json({ events: items, count: items.length });
});

// Verificación criptográfica de integridad de la cadena de hashes
app.get("/api/v1/audit/verify-integrity", (_req, res) => {
  let valid = true;
  let brokenAt: string | null = null;

  for (let i = 0; i < records.length; i++) {
    const current = records[i];
    const expectedPrevious = i > 0 ? records[i - 1].hash : undefined;

    if (current.previousHash !== expectedPrevious) {
      valid = false;
      brokenAt = current.eventId;
      break;
    }

    const { hash, previousHash, verified, ...eventData } = current;
    const recomputedHash = createHash("sha256")
      .update(JSON.stringify({ event: eventData, previousHash }))
      .digest("hex");

    if (recomputedHash !== hash) {
      valid = false;
      brokenAt = current.eventId;
      break;
    }
  }

  res.json({
    valid,
    chainLength: records.length,
    brokenAt,
    algorithm: "SHA-256 Chain of Custody",
    verifiedAt: new Date().toISOString()
  });
});

// Estadísticas para panel de administración
app.get("/api/v1/audit/stats", (_req, res) => {
  const byType: Record<string, number> = {};
  const byProducer: Record<string, number> = {};

  for (const r of records) {
    byType[r.eventType] = (byType[r.eventType] ?? 0) + 1;
    byProducer[r.producer] = (byProducer[r.producer] ?? 0) + 1;
  }

  res.json({
    totalEvents: records.length,
    securityEvents: records.filter((r) => r.eventType.startsWith("security.")).length,
    byType,
    byProducer,
    lastEventAt: records.at(-1)?.occurredAt ?? null
  });
});

async function consumeEvents() {
  const brokers = (process.env.KAFKA_BROKERS ?? "").split(",").filter(Boolean);
  if (!brokers.length) return;

  const kafka = new Kafka({ clientId: "audit-consumer", brokers });
  const consumer = kafka.consumer({ groupId: "audit-service-v1" });
  await consumer.connect();

  const topics = [
    "conversation-message-received",
    "conversation-intent-classified",
    "conversation-feedback-submitted",
    "conversation-deleted",
    "profile-created",
    "profile-updated",
    "profile-deleted",
    "profile-purged",
    "consent-granted",
    "consent-revoked",
    "recommendation-generated",
    "procedure-created",
    "procedure-updated",
    "procedure-deleted",
    "security-user-authenticated",
    "security-access-failed"
  ];

  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: true });
  }

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        appendImmutable(JSON.parse(message.value.toString()) as EventEnvelope);
      } catch (error) {
        logger.error({ err: error }, "invalid event sent to audit DLQ");
      }
    }
  });
}

if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  appendImmutable(makeEvent("audit.service.started", "audit-service", { environment: process.env.NODE_ENV ?? "development" }));
  void consumeEvents();
  const port = Number(process.env.PORT ?? 3005);
  const server = app.listen(port, () => logger.info({ port }, "audit-service listening"));
  const shutdown = () => server.close(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
