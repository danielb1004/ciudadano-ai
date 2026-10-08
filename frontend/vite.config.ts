/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { ProxyOptions } from "vite";
const localProxy = (target: string): ProxyOptions => ({ target, configure(server) {
  server.on("proxyReq", (request, source) => {
    request.setHeader("X-Forwarded-For", source.socket.remoteAddress ?? "127.0.0.1");
  });
} });
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, headers: {
    "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  }, proxy: {
    "/api/v1/conversations": "http://localhost:3001",
    "/api/v1/profiles": localProxy("http://localhost:3004"),
    "/api/v1/auth": localProxy("http://localhost:3004"),
    "/api/v1/procedures": localProxy("http://localhost:3002"),
    "/api/v1/requests": localProxy("http://localhost:3002"),
    "/api/v1/entities": "http://localhost:3002",
    "/api/v1/categories": localProxy("http://localhost:3002"),
    "/api/v1/recommendations": "http://localhost:3003",
    "/api/v1/audit": localProxy("http://localhost:3005"),
    "/api/v1/models": localProxy("http://localhost:8001"),
    "/api/v1/classify": localProxy("http://localhost:8001")
  } },
  test: { environment: "jsdom", globals: true }
});
