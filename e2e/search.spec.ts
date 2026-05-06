import { test, expect } from '@playwright/test'

test.describe('Search Page', () => {
  test('should load the homepage with search bar', async ({ page }) => {
    await page.goto('/')

    // Title is visible
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'ENVITED-X Simulation Asset Search'
    )

    // Search bar is present and empty
    const searchInput = page.getByPlaceholder(/show me all/i)
    await expect(searchInput).toBeVisible()
    await expect(searchInput).toHaveValue('')

    // Search button is present
    await expect(page.getByRole('button', { name: /search/i })).toBeVisible()
  })

  test('should show search button disabled when input is empty', async ({ page }) => {
    await page.goto('/')
    const button = page.getByRole('button', { name: /search/i })
    await expect(button).toBeDisabled()
  })

  test('should enable search button when text is entered', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.getByPlaceholder(/show me all/i)
    await searchInput.fill('German highways')

    const button = page.getByRole('button', { name: /search/i })
    await expect(button).toBeEnabled()
  })

  test('should show error when API is unavailable', async ({ page }) => {
    // Mock the API to return an error
    await page.route('/api/search', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'LLM provider not configured' }),
      })
    })

    await page.goto('/')

    const searchInput = page.getByPlaceholder(/show me all/i)
    await searchInput.fill('show me all highways')
    await searchInput.press('Enter')

    // Error message should appear
    await expect(page.getByText('LLM provider not configured')).toBeVisible()
  })

  test('should display results when search succeeds', async ({ page }) => {
    // Mock the API response
    await page.route('/api/search', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sparql: 'SELECT ?asset WHERE { ?asset a envx:SimulationAsset }',
          results: [
            { asset: 'http://example.org/asset1', name: 'Highway A9', country: 'Germany' },
            { asset: 'http://example.org/asset2', name: 'Urban B27', country: 'Germany' },
          ],
        }),
      })
    })

    await page.goto('/')

    const searchInput = page.getByPlaceholder(/show me all/i)
    await searchInput.fill('German roads')
    await searchInput.press('Enter')

    // Results should appear
    await expect(page.getByText('2 matches')).toBeVisible()
    await expect(page.getByText('Highway A9')).toBeVisible()
    await expect(page.getByText('Urban B27')).toBeVisible()
  })

  test('should show and hide SPARQL preview', async ({ page }) => {
    await page.route('/api/search', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sparql:
            'PREFIX envx: <https://w3id.org/2024/2/2/envited-x/>\nSELECT ?asset WHERE { ?asset a envx:SimulationAsset }',
          results: [{ asset: 'http://example.org/asset1' }],
        }),
      })
    })

    await page.goto('/')

    const searchInput = page.getByPlaceholder(/show me all/i)
    await searchInput.fill('anything')
    await searchInput.press('Enter')

    // SPARQL preview toggle should appear
    const toggle = page.getByText(/show generated sparql/i)
    await expect(toggle).toBeVisible()

    // Click to expand
    await toggle.click()
    await expect(page.getByText('PREFIX envx:')).toBeVisible()

    // Click to collapse
    await page.getByText(/hide generated sparql/i).click()
    await expect(page.getByText('PREFIX envx:')).not.toBeVisible()
  })

  test('should handle empty results gracefully', async ({ page }) => {
    await page.route('/api/search', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sparql: 'SELECT ?asset WHERE { ?asset a envx:NonExistent }',
          results: [],
        }),
      })
    })

    await page.goto('/')

    const searchInput = page.getByPlaceholder(/show me all/i)
    await searchInput.fill('non-existent assets')
    await searchInput.press('Enter')

    await expect(page.getByText(/no results found/i)).toBeVisible()
  })
})
