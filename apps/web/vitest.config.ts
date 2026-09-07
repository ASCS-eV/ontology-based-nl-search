import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vitest/config'

import { activeDesignSystemPlugin } from './vite-plugins/active-design-system'

export default defineConfig({
  plugins: [activeDesignSystemPlugin(), react()],
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/routeTree.gen.ts',
        'src/main.tsx',
        'src/test-utils.tsx',
        'src/vite-env.d.ts',
      ],
      reporter: ['text-summary'],
      /**
       * Set at the rate measured when the floor was introduced (71.83 / 84.69 / 82.63
       * lines / branches / functions), minus one point of tolerance for
       * run-to-run variance. This is a ratchet: raise it when coverage
       * improves, never lower it to make a red build green.
       */
      thresholds: {
        lines: 70,
        statements: 70,
        branches: 83,
        functions: 81,
      },
    },
    passWithNoTests: true,
    // jsdom required for component tests; the lib/* tests run fine in it too
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
