import { describe, expect, it } from "vitest";
import { anonymize } from "@ciudadano-ai/shared";
describe("profile privacy", () => { it("does not retain raw personal identifiers in shared anonymizer", () => expect(anonymize("CC 1012345678")).toContain("[ID_REDACTED]")); });
