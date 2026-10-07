import { describe, expect, it } from "vitest";
import { rankRecommendations } from "./index.js";
describe("deterministic recommendations", () => { it("returns only published, source-backed items", () => { const result = rankRecommendations("duplicado cédula"); expect(result[0]?.sourceUrls.length).toBeGreaterThan(0); expect(result.every((item) => item.published)).toBe(true); }); });
