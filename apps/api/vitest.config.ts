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
       * Set at the rate measured when the floor was introduced (85.14 / 87.98 / 97.61
       * lines / branches / functions), minus one point of tolerance for
       * run-to-run variance. This is a ratchet: raise it when coverage
       * improves, never lower it to make a red build green.
       *
       * statements/branches/functions recalibrated for the vitest 3->4
       * upgrade (#195): the V8 coverage provider counts them more precisely
       * under 4.x — see packages/core/vitest.config.ts for the full
       * rationale. Re-measured at 85.43 / 73.06 / 81.01
       * lines / branches / functions (lines threshold unaffected — still
       * comfortably under the re-measured rate).
       */
      thresholds: {
        lines: 84,
        statements: 82,
        branches: 72,
        functions: 80,
      },
    },
    passWithNoTests: true,
  },
})
