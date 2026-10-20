import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "src/test/server-only.ts") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Postgres-backed suites create real databases; give them room.
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
