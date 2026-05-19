import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    passWithNoTests: true,
    // jsdom required for component tests; the lib/* tests run fine in it too
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
