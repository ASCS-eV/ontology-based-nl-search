import { defineConfig, devices } from '@playwright/test'

const preview = process.env.DOCS_TEST_MODE === 'preview'

export default defineConfig({
  testDir: './docs-tests',
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5188/docs/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Use a dedicated port in either mode and do not reuse a developer's server.
  webServer: {
    command: preview
      ? 'pnpm --filter @ontology-search/docs exec vitepress preview --port 5188'
      : 'pnpm --filter @ontology-search/docs dev --host 127.0.0.1',
    env: { DOCS_PORT: '5188', VITEPRESS_BASE: '/docs/' },
    wait: {
      stdout: preview
        ? /Built site served at http:\/\/localhost:5188\/docs\//
        : /http:\/\/127\.0\.0\.1:5188\/docs\//,
    },
    timeout: 60_000,
    cwd: '../..',
  },
})
