import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/index.ts"],
      reporter: ["text", "lcov"],
      thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
    },
  },
});
