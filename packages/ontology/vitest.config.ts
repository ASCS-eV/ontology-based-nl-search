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
       *
       * Recalibrated for the vitest 3->4 upgrade (#195): the V8 coverage
       * provider counts branches/statements more precisely under 4.x — see
       * packages/core/vitest.config.ts for the full rationale. Re-measured
       * at 84.89 / 74.83 / 86.91 lines / branches / functions.
       */
      thresholds: {
        lines: 83,
        statements: 81,
        branches: 73,
        functions: 85,
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
