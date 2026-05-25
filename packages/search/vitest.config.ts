import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const repoRoot = resolve(__dirname, '../..')

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30_000,
    // Test files share a singleton WorkerOxigraphStore. Parallel file
    // execution overwhelms the WASM worker with concurrent heavy queries.
    fileParallelism: false,
    env: {
      ONTOLOGY_ROOT: repoRoot,
    },
  },
})
