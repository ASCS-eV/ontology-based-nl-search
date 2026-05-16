import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const repoRoot = resolve(__dirname, '../..')

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    testTimeout: 60_000,
    env: {
      // ShaclValidator.fromWorkspace() resolves the ontology artefacts
      // relative to the workspace root; tests run from each package dir.
      ONTOLOGY_ROOT: repoRoot,
    },
  },
})
