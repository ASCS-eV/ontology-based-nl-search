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
       * Set at the rate measured when the floor was introduced (85.55 / 88.55 / 87.93
       * lines / branches / functions), minus one point of tolerance for
       * run-to-run variance. This is a ratchet: raise it when coverage
       * improves, never lower it to make a red build green.
       *
       * Recalibrated for the vitest 3->4 upgrade (#195): vitest 4's V8
       * coverage provider attributes branches/statements more precisely
       * than 3.x did (e.g. it now correctly shows `errors/index.ts`'s
       * untested `CredentialsPermissionError` / `StoreCapabilityError` /
       * `BackendCapabilityError` classes as uncovered, where 3.x silently
       * under-counted the gap). Re-measured at 80.75 / 78.66 / 85.45
       * lines / branches / functions — same tests, more honest numbers.
       */
      thresholds: {
        lines: 79,
        statements: 79,
        branches: 77,
        functions: 84,
      },
    },
  },
})
