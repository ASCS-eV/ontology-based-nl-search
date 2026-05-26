import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const repoRoot = resolve(__dirname, '../..')

export default defineConfig({
  test: {
    globals: true,
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
