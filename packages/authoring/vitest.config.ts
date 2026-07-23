import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    // The golden-conformance test loads the real engine via
    // @ontology-search/authoring-wasm, whose prebuilt Emscripten ESM glue must
    // be imported by Node as-is (it uses import.meta.url to locate the .wasm),
    // not transformed by Vite.
    server: {
      deps: {
        external: [/[\\/]wasm[\\/]osc-engine\.mjs$/],
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
