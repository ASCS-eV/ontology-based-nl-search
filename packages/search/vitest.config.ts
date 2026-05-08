import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const repoRoot = resolve(__dirname, '../..')

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30_000,
    env: {
      ONTOLOGY_ROOT: repoRoot,
    },
  },
})
