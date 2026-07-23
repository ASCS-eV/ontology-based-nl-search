import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    // The semantic gate loads Oxigraph WASM via @ontology-search/sparql's
    // in-process store; its prebuilt module must be imported by Node as-is.
    server: {
      deps: {
        external: [/oxigraph/],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/__tests__/**'],
      reporter: ['text-summary'],
      thresholds: {
        lines: 85,
        functions: 90,
        statements: 85,
        branches: 75,
      },
    },
  },
})
