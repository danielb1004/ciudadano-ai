import express from "express";
import { randomUUID } from "node:crypto";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { anonymize, cacheJson, CircuitBreaker, ConversationState, createBaseApp, logger, makeEvent, publishEvent, readJson, Recommendation } from "@ciudadano-ai/shared";
import { z } from "zod";

const sessions = new Map<string, ConversationState>();
const feedbackStore = new Map<string, Array<{ id: string; rating: string; comment?: string; createdAt: string }>>();
const nlpBreaker = new CircuitBreaker(3, 15_000);

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
  anonymousUserId: z.string().uuid().optional()
});

const feedbackSchema = z.object({
  rating: z.enum(["positive", "negative", "helpful", "unhelpful"]),
  comment: z.string().max(500).optional(),
  messageIndex: z.number().int().nonnegative().optional()
});

const conversationAnnotation = Annotation.Root({
  conversationId: Annotation<string>(),
  anonymousUserId: Annotation<string | undefined>(),
  messages: Annotation<any[]>({ reducer: (_a, b) => b ?? _a, default: () => [] }),
  currentMessage: Annotation<string>({ reducer: (_a, b) => b ?? _a, default: () => "" }),
  sanitizedMessage: Annotation<string>({ reducer: (_a, b) => b ?? _a, default: () => "" }),
  intent: Annotation<string | undefined>(),
  confidence: Annotation<number | undefined>(),
  entities: Annotation<Record<string, unknown>>({ reducer: (_a, b) => b ?? _a, default: () => ({}) }),
  missingInformation: Annotation<string[]>({ reducer: (_a, b) => b ?? _a, default: () => [] }),
  profile: Annotation<any>(),
  recommendations: Annotation<Recommendation[]>({ reducer: (_a, b) => b ?? _a, default: () => [] }),
  selectedRecommendation: Annotation<Recommendation | undefined>(),
  requiresClarification: Annotation<boolean>({ reducer: (_a, b) => b ?? _a, default: () => false }),
  requiresReferral: Annotation<boolean>({ reducer: (_a, b) => b ?? _a, default: () => false }),
  sourceUrls: Annotation<string[]>({ reducer: (_a, b) => b ?? _a, default: () => [] }),
  response: Annotation<string | undefined>(),
  errors: Annotation<any[]>({ reducer: (_a, b) => b ?? _a, default: () => [] })
});
type GraphState = typeof conversationAnnotation.State;

const safeCall = async <T>(url: string, init: RequestInit, fallback: T): Promise<T> =>
  nlpBreaker.execute(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }, () => fallback);

const graph = new StateGraph(conversationAnnotation)
  .addNode("receive_message", async (s: GraphState) => {
    await publishEvent(
      makeEvent("conversation.message.received", "conversation-service", { messageLength: s.currentMessage.length }, s.conversationId, s.conversationId)
    );
    return {};
  })
  .addNode("sanitize_message", async (s) => ({
    sanitizedMessage: anonymize(s.currentMessage).replace(/[<>]/g, "")
  }))
  .addNode("load_context", async (s) => ({
    messages: (await readJson<ConversationState>(`conversation:${s.conversationId}`))?.messages ?? sessions.get(s.conversationId)?.messages ?? []
  }))
  .addNode("classify_intent", async (s) =>
    safeCall<{ intent: string; confidence: number; entities: Record<string, unknown> }>(
      `${process.env.NLP_URL ?? "http://localhost:8001"}/api/v1/classify`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: s.sanitizedMessage }) },
      { intent: "CONSULTA_INFORMATIVA", confidence: 0.45, entities: {} }
    )
  )
  .addNode("extract_entities", async (s) => ({ entities: s.entities ?? {} }))
  .addNode("evaluate_confidence", async (s) => ({ requiresClarification: (s.confidence ?? 0) < 0.50 }))
  .addNode("request_clarification", async () => ({
    response: "Quiero ayudarte con precisión. ¿Podrías indicarme con más detalle qué trámite, entidad o documento necesitas consultar?",
    requiresClarification: true
  }))
  .addNode("load_profile", async (s) => {
    const id = s.anonymousUserId;
    if (!id) return {};
    const profile = await safeCall(`${process.env.PROFILE_URL ?? "http://localhost:3002"}/api/v1/profiles/${id}`, {}, undefined);
    return profile ? { profile } : {};
  })
  .addNode("get_recommendations", async (s) =>
    safeCall<{ recommendations: Recommendation[] }>(
      `${process.env.RECOMMENDATION_URL ?? "http://localhost:3003"}/api/v1/recommendations`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: s.intent, entities: s.entities, query: s.sanitizedMessage })
      },
      { recommendations: [] }
    )
  )
  .addNode("validate_response", async (s) => {
    const recommendations = s.recommendations ?? [];
    const sourceUrls = recommendations.flatMap((r) => r.sourceUrls ?? []);
    if (recommendations.length > 0) {
      const top = recommendations[0];
      const stepsText = top.steps?.length ? ` Pasos clave: ${top.steps.slice(0, 2).join(", ")}.` : "";
      return {
        sourceUrls,
        requiresReferral: false,
        response: `Orientación oficial encontrada: ${top.title} (${top.entity}). ${top.description}${stepsText} Consulta los requisitos completos en los enlaces oficiales verificados a continuación.`
      };
    }
    return {
      sourceUrls,
      requiresReferral: true,
      response: "No encontré un trámite oficial específico que coincida exactamente con tu consulta. Te sugiero verificar el nombre del trámite o acudir directamente al portal oficial de la entidad correspondiente."
    };
  })
  .addNode("save_context", async (s) => {
    const next: ConversationState = {
      ...s,
      messages: [
        ...(s.messages ?? []),
        { role: "user", content: s.sanitizedMessage, createdAt: new Date().toISOString() },
        ...(s.response ? [{ role: "assistant" as const, content: s.response, createdAt: new Date().toISOString() }] : [])
      ]
    };
    sessions.set(s.conversationId, next);
    await cacheJson(`conversation:${s.conversationId}`, next, 900);
    return {};
  })
  .addNode("publish_events", async (s) => {
    await publishEvent(
      makeEvent(
        "conversation.intent.classified",
        "conversation-service",
        { intent: s.intent, confidence: s.confidence, recommendationCount: s.recommendations?.length ?? 0 },
        s.conversationId,
        s.conversationId
      )
    );
    return {};
  })
  .addNode("return_response", async () => ({}))
  .addEdge(START, "receive_message")
  .addEdge("receive_message", "sanitize_message")
  .addEdge("sanitize_message", "load_context")
  .addEdge("load_context", "classify_intent")
  .addEdge("classify_intent", "extract_entities")
  .addEdge("extract_entities", "evaluate_confidence")
  .addConditionalEdges("evaluate_confidence", (s) => (s.requiresClarification ? "clarification" : "valid"), {
    clarification: "request_clarification",
    valid: "load_profile"
  })
  .addEdge("request_clarification", "save_context")
  .addEdge("load_profile", "get_recommendations")
  .addEdge("get_recommendations", "validate_response")
  .addEdge("validate_response", "save_context")
  .addEdge("save_context", "publish_events")
  .addEdge("publish_events", "return_response")
  .addEdge("return_response", END)
  .compile();

const app = createBaseApp("conversation-service");

// Iniciar nueva conversación
app.post("/api/v1/conversations", (_req, res) => {
  const id = randomUUID();
  sessions.set(id, {
    conversationId: id,
    messages: [],
    currentMessage: "",
    sanitizedMessage: "",
    entities: {},
    missingInformation: [],
    recommendations: [],
    requiresClarification: false,
    requiresReferral: false,
    sourceUrls: [],
    errors: []
  });
  res.status(201).json({ conversationId: id });
});

// Enviar mensaje en una conversación
app.post("/api/v1/conversations/:id/messages", (req, res, next) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Escribe un mensaje válido." } });

  void graph
    .invoke({
      conversationId: req.params.id,
      currentMessage: parsed.data.message,
      anonymousUserId: parsed.data.anonymousUserId,
      messages: [],
      sanitizedMessage: "",
      entities: {},
      missingInformation: [],
      recommendations: [],
      requiresClarification: false,
      requiresReferral: false,
      sourceUrls: [],
      errors: []
    })
    .then((result) =>
      res.json({
        conversationId: req.params.id,
        response: result.response,
        intent: result.intent,
        confidence: result.confidence,
        recommendations: result.recommendations,
        requiresClarification: result.requiresClarification,
        requiresReferral: result.requiresReferral,
        sources: result.sourceUrls
      })
    )
    .catch(next);
});

// Obtener estado de la conversación
app.get("/api/v1/conversations/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversación no encontrada." } });
  res.json({
    conversationId: session.conversationId,
    messages: session.messages,
    recommendations: session.recommendations,
    requiresReferral: session.requiresReferral
  });
});

// Eliminar conversación (privacidad)
app.delete("/api/v1/conversations/:id", async (req, res) => {
  sessions.delete(req.params.id);
  feedbackStore.delete(req.params.id);
  await publishEvent(makeEvent("conversation.deleted", "conversation-service", {}, req.params.id, req.params.id));
  res.status(204).send();
});

// Registrar feedback ciudadano
app.post("/api/v1/conversations/:id/feedback", (req, res) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Formato de feedback inválido." } });
  }

  const feedbackId = randomUUID();
  const entry = {
    id: feedbackId,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    createdAt: new Date().toISOString()
  };

  const list = feedbackStore.get(req.params.id) ?? [];
  list.push(entry);
  feedbackStore.set(req.params.id, list);

  void publishEvent(
    makeEvent(
      "conversation.feedback.submitted",
      "conversation-service",
      {
        conversationId: req.params.id,
        feedbackId,
        rating: parsed.data.rating,
        commentLength: parsed.data.comment?.length ?? 0
      },
      req.params.id,
      req.params.id
    )
  );

  res.status(202).json({
    accepted: true,
    feedbackId,
    correlationId: res.locals.correlationId
  });
});

// Estadísticas de uso conversacional (Admin)
app.get("/api/v1/conversations/metrics/summary", (_req, res) => {
  const allSessions = [...sessions.values()];
  const totalMessages = allSessions.reduce((acc, s) => acc + (s.messages?.length ?? 0), 0);
  const totalFeedback = [...feedbackStore.values()].reduce((acc, list) => acc + list.length, 0);

  res.json({
    activeSessions: allSessions.length,
    totalMessages,
    totalFeedback,
    timestamp: new Date().toISOString()
  });
});

if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3001);
  const server = app.listen(port, () => logger.info({ port }, "conversation-service listening"));
  const shutdown = () => server.close(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
