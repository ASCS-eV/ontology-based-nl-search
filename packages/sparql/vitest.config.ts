import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/__tests__/**'],
      reporter: ['text-summary'],
      /**
       * Set at the rate measured when the floor was introduced (77.60 / 89.09 / 90.00
       * lines / branches / functions), minus one point of tolerance for
       * run-to-run variance. This is a ratchet: raise it when coverage
       * improves, never lower it to make a red build green.
       *
       * Recalibrated for the vitest 3->4 upgrade (#195): the V8 coverage
       * provider counts branches/statements more precisely under 4.x — see
       * packages/core/vitest.config.ts for the full rationale. Re-measured
       * at 74.38 / 71.87 / 81.01 lines / branches / functions.
       */
      thresholds: {
        lines: 73,
        statements: 73,
        branches: 70,
        functions: 80,
      },
    },
  },
})
