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
      //
      // branches recalibrated for the vitest 3->4 upgrade (#195): the V8
      // coverage provider counts branches more precisely under 4.x
      // (re-measured 78.89% here, same tests) — see
      // packages/core/vitest.config.ts for the full rationale.
      thresholds: {
        lines: 90,
        functions: 95,
        statements: 90,
        branches: 77,
      },
    },
  },
})
