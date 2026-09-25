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
  await expect(page.locator('.counter')).toHaveText('1 / 8')
  await page.getByRole('button', { name: 'Next slide', exact: true }).click()
  await expect(page.locator('.counter')).toHaveText('2 / 8')

  await page.goto('architecture')
  await expect(page.locator('.mermaid svg').first()).toBeVisible()
  expect(errors).toEqual([])
})
