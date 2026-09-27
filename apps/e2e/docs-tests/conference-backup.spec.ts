import { expect, test } from '@playwright/test'

// Backup slides after each live demo, one per recorded step.
const backups = [
  { slide: 8, scrolls: true },
  { slide: 9, scrolls: true },
  { slide: 10, scrolls: true },
  { slide: 11, scrolls: true },
  { slide: 16, scrolls: true },
  { slide: 17, scrolls: false },
] as const

test('backup slides show each recorded run in a frame that scrolls like the browser', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) =>
    errors.push(`${request.url()}: ${request.failure()?.errorText}`)
  )
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('slides/')

  for (const { slide, scrolls } of backups) {
    await page.getByRole('tab', { name: `Slide ${slide}`, exact: true }).click()
    const active = page.locator('.slide--active')
    await expect(active.locator('.eyebrow')).toContainText('recorded run')
    const image = active.locator('.screen img')
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
    await expect(image).toHaveAttribute('alt', /\S/)
    if (!scrolls) continue

    // The wheel scrolls the screenshot, not the deck.
    const screen = active.locator('.screen')
    expect(await screen.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      true
    )
    await screen.hover()
    await page.mouse.wheel(0, 800)
    await expect.poll(() => screen.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await expect(page.locator('.counter')).toHaveText(`${slide} / 19`)
  }
  expect(errors).toEqual([])
})
