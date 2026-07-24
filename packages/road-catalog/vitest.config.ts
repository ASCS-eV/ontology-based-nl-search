import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // The machine-generated data module and the pure type declarations carry no
      // runtime logic; the resolver + topology accessors in index.ts are covered.
      exclude: ['src/types.ts', 'src/road-data.generated.ts', 'src/**/__tests__/**'],
      reporter: ['text-summary'],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 90,
      },
    },
  },
})
