import { expect, test } from '@playwright/test'

const headings = [
  'Formal models are the dictionary. LLMs are the translator.',
  'Formal modelling is nothing new. Writing it just got cheap.',
  'Agents excel against specs. Specs keep humans in the loop.',
  'Build circles, not pipelines.',
  'Stop building proprietary tools. Plug into open standards.',
  'LLMs translate. OWL + SHACL are dictionary and grammar.',
  'Ask in your own words.',
  'motorway HD maps in Germany',
  'HD-Karten von Autobahnen in Deutschland',
  'motorway HD maps in Germany with potholes',
  'cut-in scenarios and the HD maps they reference',
  'Every gap shows what the ontology cannot say yet.',
  'Data lineage has never been easier.',
  'If we can search it, we can generate it.',
  'Describe it. Get a valid OpenSCENARIO file.',
  "A cut-in on a highway: a vehicle 30 m ahead of the ego vehicle in the neighbouring lane changes into the ego's lane.",
  'The generated scenario, played by esmini',
  'Standardize in models, not in prose.',
  'Model. Generate. Validate. Translate. Create. Standardize.',
]
// Live-demo slides and their recorded backups: their notes are a click
// script, not spoken text, and the backups take no time unless a demo fails.
const unscriptedSlides = new Set([6, 7, 8, 9, 10, 14, 15, 16])
const SLOT_SECONDS = 25 * 60

test('conference storyline keeps synchronized scripts inside the 25-minute slot', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) =>
    errors.push(`${request.url()}: ${request.failure()?.errorText}`)
  )

  await page.goto('slides/')
  await expect(page.locator('.slide--active h1')).toBeVisible()
  await expect(page.locator('.slide')).toHaveCount(headings.length)
  const notes = await page.locator('.slide-notes-source').evaluateAll((elements) =>
    elements.map((element) => ({
      index: Number(element.getAttribute('data-slide-note')),
      title: element.getAttribute('data-title'),
      timing: element.getAttribute('data-timing') ?? '',
      spoken: Array.from(element.querySelectorAll('p'))
        .map((paragraph) => paragraph.textContent?.trim() ?? '')
        .filter((paragraph) => !paragraph.startsWith('[Cue:'))
        .join(' '),
    }))
  )
  expect(notes.map((note) => note.index)).toEqual(headings.map((_, index) => index))
  expect(notes.map((note) => note.title)).toEqual(headings)

  // Contiguous timings, speakable at ~110 words per minute, ending before the slot.
  let elapsed = 0
  let spokenWords = 0
  for (const [index, note] of notes.entries()) {
    const timing = note.timing.match(/^(\d+):(\d+)–(\d+):(\d+)/)
    expect(timing, `Timing for slide ${index + 1}`).not.toBeNull()
    const start = Number(timing![1]) * 60 + Number(timing![2])
    const end = Number(timing![3]) * 60 + Number(timing![4])
    expect(start, `slide ${index + 1} starts where the previous ended`).toBe(elapsed)
    const words = note.spoken.split(/\s+/).length
    if (!unscriptedSlides.has(index)) {
      spokenWords += words
      expect(words, `slide ${index + 1} fits its time`).toBeLessThanOrEqual(
        ((end - start) / 60) * 130
      )
    }
    elapsed = end
  }
  expect(elapsed).toBeLessThan(SLOT_SECONDS)
  expect(spokenWords).toBeGreaterThanOrEqual(1400)

  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Open presenter notes (P)' }).click()
  const popup = await popupPromise
  popup.on('pageerror', (error) => errors.push(error.message))
  for (const [index, title] of headings.entries()) {
    await expect
      // textContent, not innerText: headings are uppercased by CSS only.
      .poll(async () =>
        ((await page.locator('.slide--active').getByRole('heading').first().textContent()) ?? '')
          .replace(/\s+/g, ' ')
          .trim()
      )
      .toBe(title)
    await expect(popup.locator('#presenter-title')).toHaveText(title)
    await expect(popup.locator('#presenter-position')).toHaveText(
      `Slide ${index + 1} of ${headings.length}`
    )
    await expect(popup.locator('#presenter-script')).toContainText(
      notes[index]!.spoken.slice(0, 70)
    )
    if (index < headings.length - 1) await popup.getByRole('button', { name: 'Next slide' }).click()
  }
  await popup.close()
  expect(errors).toEqual([])
})
