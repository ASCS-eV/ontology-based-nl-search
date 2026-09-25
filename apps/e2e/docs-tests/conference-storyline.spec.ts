import { expect, test } from '@playwright/test'

const headings = [
  'Is this the scenario I meant?',
  'Two capabilities. One engineering task.',
  'Make the interpretation inspectable.',
  'Why did this asset match?',
  'What did the model decide?',
  'Valid structure is not verified intent.',
  'What this prototype demonstrates—and what remains open.',
  'Judge the demo on three questions.',
]

test('conference storyline keeps eight synchronized scripts and an honest handoff', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) =>
    errors.push(`${request.url()}: ${request.failure()?.errorText}`)
  )

  await page.goto('slides/')
  await expect(page.locator('.slide--active h1')).toBeVisible()
  await expect(page.locator('.slide')).toHaveCount(8)
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
  expect(notes).toHaveLength(8)
  expect(notes.map((note) => note.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  expect(notes.map((note) => note.title)).toEqual(headings)

  let elapsed = 0
  for (const [index, note] of notes.entries()) {
    const timing = note.timing.match(/^(\d+):(\d+)–(\d+):(\d+)/)
    expect(timing, `Timing for slide ${index + 1}`).not.toBeNull()
    const start = Number(timing![1]) * 60 + Number(timing![2])
    const end = Number(timing![3]) * 60 + Number(timing![4])
    expect(start).toBe(elapsed)
    expect(end - start).toBe(index === 0 || index === 7 ? 90 : 120)
    elapsed = end
    expect(note.spoken.split(/\s+/).length).toBeGreaterThanOrEqual(140)
  }
  expect(elapsed).toBe(900)
  const words = notes
    .map((note) => note.spoken)
    .join(' ')
    .split(/\s+/).length
  expect(words).toBeGreaterThanOrEqual(1300)
  expect(words).toBeLessThanOrEqual(1800)

  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Open presenter notes (P)' }).click()
  const popup = await popupPromise
  popup.on('pageerror', (error) => errors.push(error.message))
  for (const [index, title] of headings.entries()) {
    await expect
      .poll(async () =>
        (await page.locator('.slide--active').getByRole('heading').innerText())
          .replace(/\s+/g, ' ')
          .trim()
      )
      .toBe(title)
    await expect(popup.locator('#presenter-title')).toHaveText(title)
    await expect(popup.locator('#presenter-position')).toHaveText(`Slide ${index + 1} of 8`)
    await expect(popup.locator('#presenter-script')).toContainText(
      notes[index]!.spoken.slice(0, 70)
    )
    if (index === 1) {
      await expect(page.locator('.slide--active')).toContainText(
        'Separate paths today; no selected-road handoff.'
      )
    }
    if (index === 5) {
      await expect(page.locator('.slide--active')).toContainText('Reference integrity')
      await expect(page.locator('.slide--active')).not.toContainText('Meaning')
    }
    if (index < 7) await popup.getByRole('button', { name: 'Next slide' }).click()
  }
  await popup.close()
  expect(errors).toEqual([])
})
