import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "tests/empty.ts") } },
  test: { env: { PGLITE_DIR: "memory://" }, include: ["tests/**/*.test.ts"], environment: "node", testTimeout: 60_000, hookTimeout: 120_000, pool: "forks" },
});
