import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const repoRoot = resolve(__dirname, '../..')

export default defineConfig({
  test: {
    globals: true,
    include: ['src/__tests__/**/*.test.ts'],
    env: {
      ONTOLOGY_ROOT: repoRoot,
    },
  },
})
