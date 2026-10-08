import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["services/*/src/**/*.test.ts", "testing/integration/**/*.test.ts"],
    environment: "node", fileParallelism: false, testTimeout: 15000, hookTimeout: 20000,
    coverage: { provider: "v8", include: ["services/*/src/index.ts", "shared/src/security.ts", "shared/src/store.ts", "shared/src/http.ts", "shared/src/events.ts"], reporter: ["text", "json-summary", "json"], reportsDirectory: "research/evidence/coverage", thresholds: { statements: 80, lines: 80, functions: 80 } }
  }
});
