import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: {
    environment: "node",
    include: ["tests/integracion/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
