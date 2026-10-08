import { describe, expect, it } from "vitest";
import { appendImmutable } from "./index.js";
import { makeEvent } from "@ciudadano-ai/shared";
describe("audit event sourcing", () => { it("links immutable events by hash", async () => { const a = await appendImmutable(makeEvent("test.a", "test", {})); const b = await appendImmutable(makeEvent("test.b", "test", {})); expect(b.previousHash).toBe(a.hash); expect(b.hash).not.toBe(a.hash); }); });
