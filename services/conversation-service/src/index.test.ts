import { describe, expect, it } from "vitest";
import { anonymize, CircuitBreaker } from "@ciudadano-ai/shared";
describe("conversation safety", () => {
  it("anonymizes identifiers before NLP", () => expect(anonymize("Mi cédula 1234567890 es x@y.co")).not.toContain("1234567890"));
  it("opens after repeated failures and uses fallback", async () => { const cb = new CircuitBreaker(2, 1000); await expect(cb.execute(async () => { throw new Error("x"); }, () => "fallback")).resolves.toBe("fallback"); await cb.execute(async () => { throw new Error("x"); }, () => "fallback"); expect(cb.status).toBe("OPEN"); });
});
