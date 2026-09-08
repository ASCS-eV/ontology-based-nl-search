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
       *
       * Recalibrated for the vitest 3->4 upgrade (#195): the V8 coverage
       * provider counts branches/statements more precisely under 4.x —
       * JSX conditionals (`&&`, `??`, ternaries) produce far more branch
       * points than 3.x attributed. See packages/core/vitest.config.ts for
       * the full rationale. Re-measured at 69.07 / 58.96 / 72.58
       * lines / branches / functions.
       */
      thresholds: {
        lines: 68,
        statements: 65,
        branches: 57,
        functions: 71,
      },
    },
    passWithNoTests: true,
    // jsdom required for component tests; the lib/* tests run fine in it too
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
