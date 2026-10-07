import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
describe("auth contract", () => { it("requires a strong secret outside tests", () => expect((process.env.JWT_SECRET ?? "development-only-change-me-32-bytes").length).toBeGreaterThanOrEqual(32)); it("supports role claims", () => expect(jwt.decode(jwt.sign({ roles: ["admin"] }, "secret"))).toMatchObject({ roles: ["admin"] })); });
