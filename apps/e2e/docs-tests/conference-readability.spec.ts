import { expect, test } from '@playwright/test'

const sizes = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
] as const

for (const colorScheme of ['light', 'dark'] as const) {
  for (const size of sizes) {
    test(`conference readability: ${colorScheme} at ${size.width}x${size.height}`, async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('requestfailed', (request) =>
        errors.push(`${request.url()}: ${request.failure()?.errorText}`)
      )
      await page.setViewportSize(size)
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await page.goto('slides/')
      await expect(page.locator('.counter')).toHaveText('1 / 8')

      for (let slideNumber = 1; slideNumber <= 8; slideNumber++) {
        await page.getByRole('tab', { name: `Slide ${slideNumber}`, exact: true }).click()
        const active = page.locator('.conference-page .slide--active')
        await expect(active).toHaveAttribute('aria-hidden', 'false')
        await expect(active.locator('h1, h2')).toBeVisible()
        await page.waitForTimeout(800)

        const report = await active.evaluate((slide) => {
          const parse = (value: string) => {
            const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(value)
            if (!match) throw new Error(`Unsupported rendered color: ${value}`)
            return {
              rgb: [Number(match[1]), Number(match[2]), Number(match[3])],
              alpha: match[4] === undefined ? 1 : Number(match[4]),
            }
          }
          const luminance = (rgb: number[]) => {
            const linear = rgb.map((channel) => {
              const s = channel / 255
              return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
            })
            return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
          }
          const background = (element: Element) => {
            for (let current: Element | null = element; current; current = current.parentElement) {
              const style = getComputedStyle(current)
              if (style.backgroundImage !== 'none') {
                throw new Error(`Unsupported image background at ${current.tagName}`)
              }
              const color = parse(style.backgroundColor)
              if (color.alpha === 1) return color.rgb
              if (color.alpha !== 0) {
                throw new Error(`Unsupported translucent background at ${current.tagName}`)
              }
            }
            throw new Error('No opaque ancestor background')
          }
          const slideStyle = getComputedStyle(slide)
          const slideBackground = parse(slideStyle.backgroundColor)
          const controls = document.querySelector('.slide-controls')?.getBoundingClientRect()
          if (!controls) throw new Error('Slide controls missing')
          const textElements = Array.from(
            slide.querySelectorAll<HTMLElement>(
              'h1, h2, .accent, .eyebrow, .takeaway, .source-line, .journey span, .schema-spine, .pipeline strong, .pipeline small, .search-proof strong, .search-proof small, .evidence-steps strong, .evidence-steps span, .demo-route strong, .demo-route small, .road-sketch figcaption span'
            )
          )
          const results = textElements.map((element) => {
            const style = getComputedStyle(element)
            const foreground = parse(style.color)
            if (foreground.alpha !== 1) throw new Error(`Translucent text: ${element.textContent}`)
            const light = luminance(foreground.rgb)
            const dark = luminance(background(element))
            const rect = element.getBoundingClientRect()
            return {
              text: element.textContent?.trim() ?? '',
              fontSize: Number.parseFloat(style.fontSize),
              contrast: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05),
              withinSlide:
                rect.left >= -1 &&
                rect.right <= innerWidth + 1 &&
                rect.top >= -1 &&
                rect.bottom < controls.top - 1,
              secondary: element.matches(
                '.takeaway, .journey span, .schema-spine, .pipeline strong, .pipeline small, .search-proof strong, .search-proof small, .evidence-steps strong, .evidence-steps span, .demo-route strong, .demo-route small, .road-sketch figcaption span'
              ),
              source: element.matches('.source-line'),
            }
          })
          return { slideBackground, results }
        })

        expect(report.slideBackground, `slide ${slideNumber} background`).toEqual({
          rgb: [255, 255, 255],
          alpha: 1,
        })
        expect(report.results.length).toBeGreaterThan(0)
        for (const result of report.results) {
          const label = `slide ${slideNumber}: ${result.text}`
          expect(result.contrast, `${label} contrast`).toBeGreaterThanOrEqual(
            result.source ? 4.5 : 7
          )
          if (result.secondary && size.width === 1280) {
            expect(result.fontSize, `${label} size`).toBeGreaterThanOrEqual(24)
          }
          if (result.source)
            expect(result.fontSize, `${label} source size`).toBeGreaterThanOrEqual(18)
          expect(result.withinSlide, `${label} must clear controls and viewport`).toBe(true)
        }
        if (
          process.env.DOCS_CAPTURE_SLIDES === '1' &&
          colorScheme === 'light' &&
          [1, 5, 6, 7, 8].includes(slideNumber)
        ) {
          await page.screenshot({
            path: `/tmp/conference-readability-${size.width}x${size.height}-slide-${slideNumber}.png`,
          })
        }
      }
      expect(errors).toEqual([])
    })
  }
}

test('conference readability: presenter notes remain readable and synchronized', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('slides/')
  await expect(page.locator('.counter')).toHaveText('1 / 8')
  const popupPromise = page.waitForEvent('popup')
  await page.keyboard.press('p')
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')
  await expect(popup.locator('#presenter-title')).not.toBeEmpty()
  const styles = await popup.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const body = getComputedStyle(document.body)
    const heading = document.querySelector('header h1')?.getBoundingClientRect()
    const timing = document.querySelector('#presenter-timing')?.getBoundingClientRect()
    return {
      rootBackground: root.backgroundColor,
      bodyBackground: body.backgroundColor,
      bodyColor: body.color,
      bodySize: Number.parseFloat(body.fontSize),
      overlap: Boolean(
        heading &&
        timing &&
        heading.left < timing.right &&
        heading.right > timing.left &&
        heading.top < timing.bottom &&
        heading.bottom > timing.top
      ),
    }
  })
  expect(styles.rootBackground).toBe('rgb(255, 255, 255)')
  expect(styles.bodyBackground).toBe('rgb(255, 255, 255)')
  expect(styles.bodyColor).toBe('rgb(23, 32, 51)')
  expect(styles.bodySize).toBeGreaterThanOrEqual(20)
  expect(styles.overlap).toBe(false)
  if (process.env.DOCS_CAPTURE_SLIDES === '1') {
    await popup.screenshot({ path: '/tmp/conference-readability-notes.png' })
  }
  await expect(popup.getByRole('button', { name: 'Next slide' })).toBeVisible()
  await popup.keyboard.press('ArrowRight')
  await expect(page.locator('.counter')).toHaveText('2 / 8')
  await expect(popup.locator('#presenter-position')).toHaveText('Slide 2 of 8')
  await popup.setViewportSize({ width: 480, height: 400 })
  expect(
    await popup.evaluate(() => {
      const heading = document.querySelector('header h1')?.getBoundingClientRect()
      const timing = document.querySelector('#presenter-timing')?.getBoundingClientRect()
      return Boolean(
        heading &&
        timing &&
        heading.left < timing.right &&
        heading.right > timing.left &&
        heading.top < timing.bottom &&
        heading.bottom > timing.top
      )
    })
  ).toBe(false)
  expect(await popup.evaluate(() => document.body.scrollHeight > innerHeight)).toBe(true)
  await popup.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect(popup.getByRole('button', { name: 'Previous slide' })).toBeVisible()
  expect(errors).toEqual([])
  await popup.close()
})
