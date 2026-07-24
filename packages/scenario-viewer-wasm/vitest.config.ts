import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // index.ts is a re-export barrel; load-esmini.ts is the browser-only glue
      // that instantiates the Emscripten module (cannot run under Node — it is
      // exercised by the apps/web island + its Playwright e2e in a real browser).
      // The leak-free extraction + lifecycle it delegates to ARE fully unit-tested
      // here against a faithful mock module.
      exclude: [
        'src/index.ts',
        'src/load-esmini.ts',
        'src/**/__tests__/**',
        'src/**/__fixtures__/**',
      ],
      reporter: ['text-summary'],
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 100,
      },
    },
  },
})
