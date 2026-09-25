import { expect, test } from '@playwright/test'

test('conference evidence separates recorded observations from the pending live rehearsal', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) =>
    errors.push(`${request.url()}: ${request.failure()?.errorText}`)
  )

  await page.goto('slides/rehearsal')
  const content = page.locator('.vp-doc')
  await expect(content).toContainText('Status: recorded technical rehearsal.')
  await expect(content).toContainText(
    'A full spoken ten-minute rehearsal and physical-projector check remain pending.'
  )
  await expect(content).not.toContainText('real-run evidence pending')
  for (const heading of [
    'What was requested',
    'What the output contains',
    'What the checks established',
    'Engineering decision',
    'Provenance and timing',
  ]) {
    // VitePress includes the permalink's accessible label in the heading name.
    await expect(content.getByRole('heading', { name: new RegExp(`^${heading}`) })).toBeVisible()
  }
  await expect(content).toContainText('country = DE')
  await expect(content).toContainText('81 metadata matches out of 358 assets')
  await expect(content).toContainText('german_highway_short.xodr')
  await expect(content).toContainText('two driving lanes per direction')
  await expect(content.getByRole('row').filter({ hasText: 'Both initial speeds' })).toContainText(
    '25 m/s'
  )
  await expect(
    content.getByRole('row').filter({ hasText: 'Maneuver start / duration' })
  ).toContainText('2 s / 3 s')
  const gateRows = content.getByRole('row')
  await expect(gateRows.filter({ hasText: 'Semantic gate' })).toContainText('Pass; 0 gaps')
  await expect(gateRows.filter({ hasText: 'Structural gate' })).toContainText('Pass; 0 gaps')
  await expect(gateRows.filter({ hasText: 'Residual geometry gate' })).toContainText(
    '2 skipped rules'
  )
  await expect(content).toContainText('.playground/conference-rehearsal-2026-09-24/')
  await expect(content).toContainText('gitignored directory')
  await expect(content).toContainText('not bundled or published with the documentation')

  await page.goto('slides/')
  await expect(page.locator('.slide--active h1')).toBeVisible()
  for (let index = 0; index < 8; index++) {
    const active = page.locator('.slide--active')
    await expect(page.locator('.counter')).toHaveText(`${index + 1} / 8`)
    if (index === 2) await expect(active).toContainText('Schematic')
    if ([3, 4, 5].includes(index)) await expect(active).toContainText('Excerpt from recorded run')
    for (const img of await active.locator('img').all()) {
      await expect(img).toHaveAttribute('alt', /\S/)
      await expect.poll(() => img.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0)
    }
    if (index === 4) {
      const evidence = active.getByRole('link', { name: 'Recorded evidence', exact: true })
      await expect(evidence).toBeVisible()
      expect(await evidence.evaluate((link) => new URL(link.href).pathname)).toMatch(
        /^\/docs\/slides\/rehearsal(?:\.html)?$/
      )
      const popupPromise = page.waitForEvent('popup')
      await evidence.click()
      const popup = await popupPromise
      popup.on('pageerror', (error) => errors.push(error.message))
      await expect(popup.locator('.vp-doc h1')).toContainText('Rehearsal evidence')
      await expect(popup.locator('.vp-doc')).toContainText('Status: recorded technical rehearsal.')
      await expect(popup.locator('.vp-doc')).toContainText('german_highway_short.xodr')
      await popup.close()
    }
    if (index < 7) await page.getByRole('button', { name: 'Next slide', exact: true }).click()
  }
  expect(errors).toEqual([])
})
