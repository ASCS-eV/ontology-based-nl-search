import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const repoRoot = resolve(__dirname, '../..')

export default defineConfig({
  test: {
    globals: true,
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
