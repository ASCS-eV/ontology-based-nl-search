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
       */
      thresholds: {
        lines: 84,
        statements: 84,
        branches: 86,
        functions: 96,
      },
    },
    passWithNoTests: true,
  },
})
