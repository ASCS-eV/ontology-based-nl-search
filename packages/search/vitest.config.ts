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
       */
      thresholds: {
        lines: 86,
        statements: 86,
        branches: 84,
        functions: 93,
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
