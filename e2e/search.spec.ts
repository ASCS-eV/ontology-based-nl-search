import { test, expect } from '@playwright/test'

/**
 * Helper to create a mock SSE stream response from structured data.
 */
function buildSSE(data: {
  interpretation: unknown
  gaps: unknown
  sparql: string
  results: unknown[]
  meta: unknown
}): string {
  const events = [
    `event: status\ndata: ${JSON.stringify({ phase: 'interpreting', message: 'Interpreting…' })}\n\n`,
    `event: interpretation\ndata: ${JSON.stringify(data.interpretation)}\n\n`,
    `event: gaps\ndata: ${JSON.stringify(data.gaps)}\n\n`,
    `event: sparql\ndata: ${JSON.stringify(data.sparql)}\n\n`,
    `event: status\ndata: ${JSON.stringify({ phase: 'executing', message: 'Executing…' })}\n\n`,
    `event: results\ndata: ${JSON.stringify({ results: data.results })}\n\n`,
    `event: meta\ndata: ${JSON.stringify(data.meta)}\n\n`,
    `event: done\ndata: ${JSON.stringify({})}\n\n`,
  ]
  return events.join('')
}

test.describe('Search Page', () => {
  test('should load the homepage with search bar and dataset count', async ({ page }) => {
    await page.route('/api/stats', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalAssets: 8, ontology: 'hdmap v6' }),
      })
    })

    await page.goto('/')

    // Title is visible
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Simulation Asset Search')

    // Dataset count badge
    await expect(page.getByText('8 HD map assets in graph')).toBeVisible()

    // Search bar is present and empty
    const searchInput = page.getByLabel('Natural language search query')
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

    const searchInput = page.getByLabel('Natural language search query')
    await searchInput.fill('German highways')

    const button = page.getByRole('button', { name: /search/i })
    await expect(button).toBeEnabled()
  })

  test('should show error when API is unavailable', async ({ page }) => {
    await page.route('/api/search/stream', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'LLM provider not configured' }),
      })
    })

    await page.goto('/')

    const searchInput = page.getByLabel('Natural language search query')
    await searchInput.fill('show me all highways')
    await searchInput.press('Enter')

    // Error message should appear
    await expect(page.getByText('LLM provider not configured')).toBeVisible()
  })

  test('should display interpretation, gaps, and results on successful search', async ({
    page,
  }) => {
    await page.route('/api/search/stream', (route) => {
      const body = buildSSE({
        interpretation: {
          summary: 'Looking for HD maps in Germany with motorway road type',
          mappedTerms: [
            {
              input: 'German',
              mapped: 'country code DE',
              confidence: 'high',
              property: 'georeference:country',
            },
            {
              input: 'highways',
              mapped: 'motorway road type',
              confidence: 'medium',
              property: 'hdmap:roadTypes',
            },
          ],
        },
        gaps: [
          {
            term: 'cats',
            reason: 'Animals are not defined in the HD map ontology',
            suggestions: ['hdmap:numberObjects'],
          },
        ],
        sparql:
          'PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>\nSELECT ?asset WHERE { ?asset a hdmap:HdMap }',
        results: [
          { asset: 'http://example.org/asset1', name: 'A9 Autobahn' },
          { asset: 'http://example.org/asset2', name: 'A5 Highway' },
        ],
        meta: { totalDatasets: 8, matchCount: 2, executionTimeMs: 150 },
      })

      route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        body,
      })
    })

    await page.goto('/')

    const searchInput = page.getByLabel('Natural language search query')
    await searchInput.fill('German highways and cats')
    await searchInput.press('Enter')

    // Interpretation section
    await expect(
      page.getByText('Looking for HD maps in Germany with motorway road type')
    ).toBeVisible()
    await expect(page.getByText('German', { exact: true })).toBeVisible()
    await expect(page.getByText('country code DE')).toBeVisible()

    // Confidence badges
    await expect(page.getByText('high').first()).toBeVisible()
    await expect(page.getByText('medium').first()).toBeVisible()

    // Ontology gaps — component uses smart quotes (ldquo/rdquo)
    await expect(page.getByText('\u201Ccats\u201D')).toBeVisible()
    await expect(page.getByText('Animals are not defined in the HD map ontology')).toBeVisible()

    // Results
    await expect(page.getByText('2 matches')).toBeVisible()
    await expect(page.getByText('A9 Autobahn')).toBeVisible()
    await expect(page.getByText('A5 Highway')).toBeVisible()

    // Meta info
    await expect(page.getByText('2 results')).toBeVisible()
    await expect(page.getByText('150ms')).toBeVisible()
  })

  test('should show and hide SPARQL preview', async ({ page }) => {
    await page.route('/api/search/stream', (route) => {
      const body = buildSSE({
        interpretation: { summary: 'Test query', mappedTerms: [] },
        gaps: [],
        sparql:
          'PREFIX envx: <https://w3id.org/2024/2/2/envited-x/>\nSELECT ?asset WHERE { ?asset a envx:SimulationAsset }',
        results: [{ asset: 'http://example.org/asset1' }],
        meta: { totalDatasets: 8, matchCount: 1, executionTimeMs: 50 },
      })

      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body,
      })
    })

    await page.goto('/')

    const searchInput = page.getByLabel('Natural language search query')
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

  test('should handle empty results with helpful guidance', async ({ page }) => {
    await page.route('/api/search/stream', (route) => {
      const body = buildSSE({
        interpretation: { summary: 'Looking for non-existent assets', mappedTerms: [] },
        gaps: [],
        sparql: 'SELECT ?asset WHERE { ?asset a <http://nothing> }',
        results: [],
        meta: { totalDatasets: 8, matchCount: 0, executionTimeMs: 30 },
      })

      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body,
      })
    })

    await page.goto('/')

    const searchInput = page.getByLabel('Natural language search query')
    await searchInput.fill('non-existent assets')
    await searchInput.press('Enter')

    await expect(page.getByText(/no results found/i)).toBeVisible()
    await expect(page.getByText(/try broadening your search/i)).toBeVisible()
  })

  test('should show export buttons when results exist', async ({ page }) => {
    await page.route('/api/search/stream', (route) => {
      const body = buildSSE({
        interpretation: { summary: 'All assets', mappedTerms: [] },
        gaps: [],
        sparql: 'SELECT ?asset WHERE { ?asset a hdmap:HdMap }',
        results: [{ asset: 'http://example.org/asset1', name: 'Test Asset' }],
        meta: { totalDatasets: 8, matchCount: 1, executionTimeMs: 20 },
      })

      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body,
      })
    })

    await page.goto('/')

    const searchInput = page.getByLabel('Natural language search query')
    await searchInput.fill('all assets')
    await searchInput.press('Enter')

    await expect(page.getByLabel('Export results as CSV')).toBeVisible()
    await expect(page.getByLabel('Export results as JSON-LD')).toBeVisible()
  })
})
