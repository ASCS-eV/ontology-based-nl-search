import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    dedupe: ['graphql'],
    alias: [
      {
        find: '@ontology-search/graphql-ir',
        replacement: fileURLToPath(
          new URL('../../packages/graphql-ir/src/index.ts', import.meta.url)
        ),
      },
      {
        find: /^graphql$/,
        replacement: fileURLToPath(new URL('./node_modules/graphql/index.mjs', import.meta.url)),
      },
    ],
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/cli.ts', 'src/index.ts', 'src/**/__tests__/**'],
      reporter: ['text-summary'],
    },
  },
})
