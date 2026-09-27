import { expect, test } from '@playwright/test'

// Backup slides after each live demo, one per recorded step: full-page
// captures that scroll like the browser, and a recording of the preview.
const backups = [
  { slide: 8, media: 'capture' },
  { slide: 9, media: 'capture' },
  { slide: 10, media: 'capture' },
  { slide: 11, media: 'capture' },
  { slide: 16, media: 'capture' },
  { slide: 17, media: 'recording' },
] as const

test('backup slides show each recorded run: scrollable captures and a playing recording', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) =>
    errors.push(`${request.url()}: ${request.failure()?.errorText}`)
  )
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('slides/')

  for (const { slide, media } of backups) {
    await page.getByRole('tab', { name: `Slide ${slide}`, exact: true }).click()
    const active = page.locator('.slide--active')
    await expect(active.locator('.eyebrow')).toContainText('recorded run')

    if (media === 'recording') {
      // Muted autoplay loops the esmini recording without a click.
      const video = active.locator('.screen video')
      await expect
        .poll(() =>
          video.evaluate(
            (element: HTMLVideoElement) =>
              !element.paused && element.currentTime > 0 && element.videoWidth > 0
          )
        )
        .toBe(true)
      expect(await video.evaluate((element: HTMLVideoElement) => element.loop)).toBe(true)
      continue
    }

    const image = active.locator('.screen img')
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
    await expect(image).toHaveAttribute('alt', /\S/)

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
