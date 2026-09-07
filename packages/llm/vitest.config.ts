import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const repoRoot = resolve(__dirname, '../..')

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/__tests__/**'],
      reporter: ['text-summary'],
      /**
       * Set at the rate measured when the floor was introduced (78.32 / 81.53 / 80.70
       * lines / branches / functions), minus one point of tolerance for
       * run-to-run variance. This is a ratchet: raise it when coverage
       * improves, never lower it to make a red build green.
       */
      thresholds: {
        lines: 77,
        statements: 77,
        branches: 80,
        functions: 79,
      },
    },
    passWithNoTests: true,
    testTimeout: 60_000,
    env: {
      // ShaclValidator.fromWorkspace() resolves the ontology artefacts
      // relative to the workspace root; tests run from each package dir.
      ONTOLOGY_ROOT: repoRoot,
    },
  },
})
