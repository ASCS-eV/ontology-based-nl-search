import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    // The prebuilt Emscripten ESM glue must be imported by Node as-is, not
    // transformed by Vite (it uses import.meta.url to locate the .wasm binary).
    server: {
      deps: {
        external: [/[\\/]wasm[\\/]osc-engine\.mjs$/],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // index.ts is a re-export barrel; the generated wasm glue is not ours.
      exclude: ['src/index.ts', 'src/**/__tests__/**', 'src/**/__fixtures__/**'],
      reporter: ['text-summary'],
      thresholds: {
        lines: 85,
        functions: 90,
        statements: 85,
        // Recalibrated for the vitest 3->4 upgrade (#195): the V8 coverage
        // provider counts branches more precisely under 4.x (re-measured
        // 70% here, same tests) — see packages/core/vitest.config.ts for
        // the full rationale.
        branches: 69,
      },
    },
  },
})
