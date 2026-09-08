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
       * Set at the rate measured when the floor was introduced (87.39 / 85.91 / 94.59
       * lines / branches / functions), minus one point of tolerance for
       * run-to-run variance. This is a ratchet: raise it when coverage
       * improves, never lower it to make a red build green.
       *
       * Recalibrated for the vitest 3->4 upgrade (#195): the V8 coverage
       * provider counts branches/statements more precisely under 4.x — see
       * packages/core/vitest.config.ts for the full rationale. Re-measured
       * at 85.8 / 74.45 / 90.34 lines / branches / functions.
       */
      thresholds: {
        lines: 84,
        statements: 82,
        branches: 73,
        functions: 89,
      },
    },
    // Cold-start cost on the full workspace SHACL graph (~45 files,
    // 22 domains) — buildPropertyPaths BFS plus enrichLeafKinds against
    // the real Oxigraph WASM store can exceed 30s on slow shapes.
    // 120s leaves comfortable headroom; hot-path tests complete in
    // < 5s once the singleton store is warm.
    testTimeout: 120_000,
    // Test files share a singleton WorkerOxigraphStore. Parallel file
    // execution overwhelms the WASM worker with concurrent heavy queries.
    fileParallelism: false,
    env: {
      ONTOLOGY_ROOT: repoRoot,
    },
  },
})
