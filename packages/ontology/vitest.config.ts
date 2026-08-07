import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

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
       * Set at the rate measured when the floor was introduced (86.92 / 86.71 / 90.78
       * lines / branches / functions), minus one point of tolerance for
       * run-to-run variance. This is a ratchet: raise it when coverage
       * improves, never lower it to make a red build green.
       */
      thresholds: {
        lines: 85,
        statements: 85,
        branches: 85,
        functions: 89,
      },
    },
    include: ['src/__tests__/**/*.test.ts'],
    // Cold-start parsing of the full workspace SHACL graph (45 files,
    // 22 domains) can exceed 30s on slow CI shapes — particularly the
    // SHACL validator's RDF-JS dataset build and the property-path BFS.
    // 120s leaves comfortable headroom without masking real regressions
    // (the hot-path tests complete in < 5s once the cache warms).
    testTimeout: 120_000,
    env: {
      ONTOLOGY_ROOT: repoRoot,
    },
  },
})
