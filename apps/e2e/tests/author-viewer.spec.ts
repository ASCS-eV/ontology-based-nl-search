import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

/**
 * The canonical cut-in scenario the authoring tests use — a real,
 * esmini-parseable `.xosc` that references `german_highway_short.xodr` (the
 * road bound into the catalog). Reusing it keeps the viewer preview on the SAME
 * bytes the gates and self-test validate ("what you validate is what you see").
 */
const CUT_IN_XOSC = readFileSync(
  fileURLToPath(
    new URL('../../../packages/authoring/src/__tests__/fixtures/cut-in.xosc', import.meta.url)
  ),
  'utf8'
)

/** The scene IR the stream would emit alongside the `.xosc`. */
const SCENE = {
  entities: [
    { ref: 'Ego', type: 'Vehicle', properties: { vehicleCategory: 'car' } },
    { ref: 'A1', type: 'Vehicle', properties: { vehicleCategory: 'car' } },
  ],
  actions: [
    {
      actor: 'A1',
      kind: 'LaneChangeAction',
      properties: { value: '0' },
      references: { entityRef: 'Ego' },
    },
  ],
  roadNetwork: { logicFile: 'german_highway_short.xodr' },
}

function buildAuthoringSSE(xosc: string): string {
  return [
    `event: status\ndata: ${JSON.stringify({ phase: 'authoring', message: 'Authoring…' })}\n\n`,
    `event: interpretation\ndata: ${JSON.stringify({ summary: 'Cut-in on a German highway', mappedTerms: [] })}\n\n`,
    `event: scene\ndata: ${JSON.stringify(SCENE)}\n\n`,
    `event: validation\ndata: ${JSON.stringify({ trace: [], gaps: [], valid: true })}\n\n`,
    `event: xosc\ndata: ${JSON.stringify({ xosc })}\n\n`,
    `event: meta\ndata: ${JSON.stringify({ valid: true, attempts: 1, reportedGaps: [], trace: [] })}\n\n`,
    `event: done\ndata: ${JSON.stringify({})}\n\n`,
  ].join('')
}

// The viewer needs a working WebGL context. On headless CI there is no GPU, so
// enable Chromium's software renderer (SwiftShader) — otherwise `getContext`
// returns null and three.js cannot initialise. Must be top-level (a worker-scoped
// option), not inside the describe block.
test.use({
  launchOptions: { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
})

test.describe('Authoring scenario viewer', () => {
  test('renders and plays the validated scenario below the result', async ({ page }) => {
    await page.route('/api/author/stream', (route) => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: buildAuthoringSSE(CUT_IN_XOSC),
      })
    })

    await page.goto('/author')

    await page
      .getByLabel('Natural language scenario description')
      .fill('a cut-in on a three-lane highway')
    await page.getByRole('button', { name: /author/i }).click()

    const viewer = page.getByRole('region', { name: 'Scenario preview' })
    await expect(viewer).toBeVisible()

    // The canvas mounts as soon as a bundled road is resolved…
    await expect(page.getByLabel('OpenSCENARIO playback')).toBeVisible()

    // …and once esmini has parsed the scenario + road in the browser and the
    // three.js loop starts, the status flips to "playing". WASM init + parse can
    // take a few seconds, so allow a generous timeout.
    await expect(viewer).toHaveAttribute('data-viewer-status', 'playing', { timeout: 30_000 })
  })

  test('degrades honestly (no substitution) when no bundled road matches', async ({ page }) => {
    const scene = { ...SCENE, roadNetwork: { logicFile: 'no_such_road.xodr' } }
    const body = [
      `event: scene\ndata: ${JSON.stringify(scene)}\n\n`,
      `event: validation\ndata: ${JSON.stringify({ trace: [], gaps: [], valid: true })}\n\n`,
      `event: xosc\ndata: ${JSON.stringify({ xosc: CUT_IN_XOSC })}\n\n`,
      `event: meta\ndata: ${JSON.stringify({ valid: true, attempts: 1, reportedGaps: [], trace: [] })}\n\n`,
      `event: done\ndata: ${JSON.stringify({})}\n\n`,
    ].join('')

    await page.route('/api/author/stream', (route) => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body,
      })
    })

    await page.goto('/author')
    await page.getByLabel('Natural language scenario description').fill('cut-in on an unknown road')
    await page.getByRole('button', { name: /author/i }).click()

    const viewer = page.getByRole('region', { name: 'Scenario preview' })
    await expect(viewer).toHaveAttribute('data-viewer-status', 'no-road')
    await expect(page.getByText(/no bundled road matches/i)).toBeVisible()
    await expect(page.getByLabel('OpenSCENARIO playback')).toHaveCount(0)
  })
})
