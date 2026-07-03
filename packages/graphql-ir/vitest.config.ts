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
      // Per-package floor (ADR 0003 step 5). The codec is pure, fast, and
      // instrumentation-safe — no oxigraph cold start — so it carries a real
      // enforced floor rather than the aspirational global target. Ratchet up,
      // never down.
      thresholds: {
        lines: 90,
        functions: 95,
        statements: 90,
        branches: 80,
      },
    },
  },
})
