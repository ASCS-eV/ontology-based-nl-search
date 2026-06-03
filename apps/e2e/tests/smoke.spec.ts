import { expect, test } from '@playwright/test'

/**
 * Smoke test against the REAL stack — no network mocking.
 *
 * Playwright's `webServer` config boots the actual API + web servers and waits
 * for `/health` to report ready, so simply reaching these assertions proves
 * the backend warmed up: ontology submodules loaded, schema graph built, sample
 * data loaded. These checks then confirm the store is populated and the web
 * shell renders real data.
 *
 * The deterministic search-flow assertions (which depend on an LLM) live in
 * `search.spec.ts`, where the LLM-backed endpoints are mocked. This file
 * intentionally hits the live backend instead.
 */
const API_BASE = 'http://localhost:3003'

test.describe('smoke: real stack boots and serves', () => {
  test('API /health reports ready after warmup', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`)
    expect(res.status()).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok' })
  })

  test('API /stats returns a populated store', async ({ request }) => {
    const res = await request.get(`${API_BASE}/stats`)
    expect(res.ok()).toBeTruthy()
    const stats = (await res.json()) as { totalAssets: number }
    expect(stats.totalAssets).toBeGreaterThan(0)
  })

  test('web shell renders the real dataset count', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Simulation Asset Search')
    // Not mocked: the badge reflects the live /stats count, which is positive.
    await expect(page.getByText(/[1-9]\d* assets in graph/)).toBeVisible()
  })
})
