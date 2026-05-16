/**
 * E2E regression coverage for the multi-country region case (R6).
 *
 * The original bug: typing "europa" produced a SPARQL query that filtered
 * by a single country (`country = "de"`) while the interpretation panel
 * said "multiple European countries" — the displayed intent diverged from
 * the executed query.
 *
 * After the fix, the LLM emits an array of ISO codes and the compiler
 * produces `FILTER(?country IN ("DE","FR","IT",...))`. This spec mocks
 * the SSE response to assert the UI faithfully renders the multi-element
 * IN clause and the array-shaped mapped term.
 *
 * Route mocks (not real LLM) keep the test fast and deterministic.
 */
import { expect, test } from '@playwright/test'

function buildSSE(data: {
  interpretation: unknown
  gaps: unknown
  sparql: string
  results: unknown[]
  meta: unknown
}): string {
  return [
    `event: status\ndata: ${JSON.stringify({ phase: 'interpreting', message: 'Interpreting…' })}\n\n`,
    `event: interpretation\ndata: ${JSON.stringify(data.interpretation)}\n\n`,
    `event: gaps\ndata: ${JSON.stringify(data.gaps)}\n\n`,
    `event: sparql\ndata: ${JSON.stringify(data.sparql)}\n\n`,
    `event: status\ndata: ${JSON.stringify({ phase: 'executing', message: 'Executing…' })}\n\n`,
    `event: results\ndata: ${JSON.stringify({ results: data.results })}\n\n`,
    `event: meta\ndata: ${JSON.stringify(data.meta)}\n\n`,
    `event: done\ndata: ${JSON.stringify({})}\n\n`,
  ].join('')
}

test.describe('Multi-country region regression (R6)', () => {
  /**
   * R6: When the server responds with a multi-country SPARQL clause, the UI
   * MUST render the FILTER ... IN (...) clause verbatim in the SPARQL panel
   * AND show > 0 results. No "unknown property" names should leak into the
   * displayed SPARQL.
   */
  test('renders multi-country IN clause and >0 results', async ({ page }) => {
    await page.route('/api/stats', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalAssets: 320, ontology: 'hdmap v6' }),
      })
    )

    await page.route('/api/search/stream', (route) => {
      const body = buildSSE({
        interpretation: {
          summary: 'European HD maps with > 3 lanes',
          mappedTerms: [
            { input: 'karten', mapped: 'hdmap', confidence: 'high', property: 'domains' },
            {
              input: 'europa',
              mapped: 'EU and adjacent countries',
              confidence: 'high',
              property: 'country',
            },
          ],
        },
        gaps: [],
        sparql: [
          'PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>',
          'PREFIX georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/>',
          'SELECT ?asset ?name ?country WHERE {',
          '  ?asset a hdmap:HdMap ;',
          '    rdfs:label ?name .',
          '  ?asset hdmap:hasDomainSpecification ?domSpec .',
          '  ?domSpec hdmap:hasGeoreference ?georef .',
          '  ?georef georeference:hasProjectLocation ?loc .',
          '  ?loc georeference:country ?country .',
          '  FILTER(?country IN ("DE", "FR", "IT", "ES", "NL"))',
          '}',
          'LIMIT 100',
        ].join('\n'),
        results: [
          { asset: 'http://example.org/de1', name: 'Berlin HD Map', country: 'DE' },
          { asset: 'http://example.org/fr1', name: 'Paris HD Map', country: 'FR' },
          { asset: 'http://example.org/it1', name: 'Milan HD Map', country: 'IT' },
        ],
        meta: { totalDatasets: 320, matchCount: 3, executionTimeMs: 250 },
      })
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body,
      })
    })

    await page.goto('/')

    const searchInput = page.getByLabel('Natural language search query')
    await searchInput.fill('gibt es karten mit mehr als 3 spuren in europa?')
    await searchInput.press('Enter')

    // R6.1 — UI shows > 0 result count
    await expect(page.getByText('3 matches')).toBeVisible()
    await expect(page.getByText('Berlin HD Map')).toBeVisible()
    await expect(page.getByText('Paris HD Map')).toBeVisible()
    await expect(page.getByText('Milan HD Map')).toBeVisible()

    // R6.2 — SPARQL panel renders the IN-clause verbatim (after expanding it).
    await page.getByText(/show generated sparql/i).click()
    const sparqlPanel = page.getByText(/FILTER\(\?country IN \(/i)
    await expect(sparqlPanel).toBeVisible()
    // R6.3 — Must contain multiple ISO codes (proof it's not single-country).
    await expect(page.getByText(/"DE", "FR", "IT"/)).toBeVisible()
    // R6.4 — Must NOT contain the regression key (no hallucinated property).
    const fullSparql = await page.locator('pre, code').first().innerText()
    expect(fullSparql).not.toContain('numberLanes')
  })
})
