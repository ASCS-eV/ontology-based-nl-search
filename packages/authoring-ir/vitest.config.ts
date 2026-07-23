import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // index.ts is a re-export barrel (no logic); tests cover the real modules.
      exclude: ['src/index.ts', 'src/**/__tests__/**'],
      reporter: ['text-summary'],
      // Per-package floor (ADR 0003). authoring-ir is pure types + Zod, fast and
      // instrumentation-safe, so it carries a real enforced floor. Ratchet up,
      // never down.
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 90,
      },
    },
  },
})
