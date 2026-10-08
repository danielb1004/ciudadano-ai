import { createBaseApp, asyncRoute, errorHandler, publishEvent, makeEvent, Recommendation, seedCatalog, Intent } from "@ciudadano-ai/shared";
import { z } from "zod";
export const app = createBaseApp("recommendation-service");
const stopwords = new Set(["de", "la", "el", "en", "un", "una", "para", "por", "que", "como", "mi", "necesito", "quiero", "me", "y", "es", "los", "las", "del", "se", "sacar", "hola", "buenas", "puedo", "favor", "podria", "tengo"]);
const terms = (s: string) => (s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]+/g) ?? []).filter(w => !stopwords.has(w));
export function rankRecommendations(query: string, intent?: string, catalog: Recommendation[] = seedCatalog): Recommendation[] {
  const words = new Set(terms(query));
  return catalog.filter(p => p.published).map(p => {
    const title = terms(p.title), entity = terms(p.entity), description = terms(p.description);
    let score = 0, matches = 0; for (const word of words) { if (title.includes(word)) score += 3; if (title.includes(word) || entity.includes(word) || description.includes(word)) matches++; if (entity.includes(word)) score += 2; if (description.includes(word)) score += 1; }
    return { ...p, score: words.size && matches / words.size < 0.4 ? 0 : score };
  }).filter(p => (p.score ?? 0) > 0).sort((a,b) => (b.score ?? 0) - (a.score ?? 0)).slice(0,3);
}
const input = z.object({ query: z.string().max(1500), intent: Intent.optional(), entities: z.record(z.unknown()).default({}) });
let cached: { items: Recommendation[]; synchronizedAt: string; expiresAt: number } | undefined;
app.post("/api/v1/recommendations", asyncRoute(async (req, res) => {
  const parsed = input.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Consulta inválida." } });
  let items: Recommendation[], fromCache = false;
  try {
    const response = await fetch((process.env.CATALOG_URL ?? "http://localhost:3002") + "/api/v1/procedures", { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error("Catalog unavailable");
    const body = await response.json() as { procedures: Recommendation[]; synchronizedAt: string };
    items = body.procedures; cached = { items, synchronizedAt: body.synchronizedAt, expiresAt: Date.now() + 300000 };
  } catch {
    if (!cached || cached.expiresAt <= Date.now()) return res.status(503).json({ error: { code: "CATALOG_UNAVAILABLE", message: "Catálogo temporalmente no disponible. Usa el canal oficial." } });
    items = cached.items; fromCache = true;
  }
  const recommendations = rankRecommendations(parsed.data.query, parsed.data.intent, items);
  await publishEvent(makeEvent("recommendation.generated", "recommendation-service", { count: recommendations.length, intent: parsed.data.intent, fromCache }));
  res.json({ recommendations, fromCache, synchronizedAt: cached?.synchronizedAt, generatedAt: new Date().toISOString() });
}));
app.use(errorHandler);
if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  const server = app.listen(Number(process.env.PORT ?? 3003)); process.once("SIGTERM", () => server.close()); process.once("SIGINT", () => server.close());
}
