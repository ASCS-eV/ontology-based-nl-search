import { expect, test } from '@playwright/test'

test('development docs render and link to working slides and diagrams', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) =>
    errors.push(`${request.url()}: ${request.failure()?.errorText}`)
  )

  await page.goto('./')
  // HTTP 200 alone misses module-loading failures that leave #app empty.
  expect(errors).toEqual([])
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ontology-Based NL Search')

  await page.getByRole('link', { name: 'View Presentation' }).click()
  await expect(page.getByRole('button', { name: 'Next slide', exact: true })).toBeVisible()
  await expect(page.locator('.counter')).toHaveText('1 / 19')
  await page.getByRole('button', { name: 'Next slide', exact: true }).click()
  await expect(page.locator('.counter')).toHaveText('2 / 19')
  // Let the slide assets finish loading: leaving mid-request aborts them.
  await page.waitForLoadState('networkidle')

  await page.goto('architecture')
  await expect(page.locator('.mermaid svg').first()).toBeVisible()

  // The appendix decks link to the architecture page relative to the site, so
  // the link also resolves under the GitHub Pages base path. Each page settles
  // before the next navigation, which would otherwise abort its prefetches.
  await page.waitForLoadState('networkidle')
  for (const deck of ['slides/architecture', 'slides/authoring']) {
    await page.goto(deck)
    const link = page.getByRole('link', { name: 'Read the architecture →' })
    // The server-rendered deck is visible before its script handles keys;
    // repeat End until the hydrated deck has moved to the last slide.
    await expect(async () => {
      await page.keyboard.press('End')
      await expect(link).toBeVisible({ timeout: 1_000 })
    }).toPass()
    const target = new URL((await link.getAttribute('href'))!, page.url()).toString()
    expect((await page.request.get(target)).status(), `${deck} links ${target}`).toBe(200)
    await page.waitForLoadState('networkidle')
  }
  expect(errors).toEqual([])
})
