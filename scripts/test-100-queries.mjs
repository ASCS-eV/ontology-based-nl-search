/**
 * Search test harness — 100 AV engineer queries
 * Sends each query to the SSE endpoint, collects results, and reports.
 */

const API = 'http://localhost:3003'

const queries = [
  // === HD Map basics (road types) ===
  '1. motorway HD maps',
  '2. urban road maps',
  '3. rural road maps',
  '4. highway maps',
  '5. interstate maps',
  '6. country road maps',
  '7. pedestrian zone maps',
  '8. bicycle path maps',
  '9. parking area maps',
  '10. ramp maps',

  // === Country-specific ===
  '11. HD maps from Germany',
  '12. maps from the United States',
  '13. Japanese road maps',
  '14. Chinese highway maps',
  '15. maps from France',
  '16. Italian motorway maps',
  '17. maps from Austria',
  '18. Swedish road maps',
  '19. Korean maps',
  '20. maps from the Netherlands',

  // === Lane count ===
  '21. maps with 3 lanes',
  '22. maps with at least 4 lanes',
  '23. single lane roads',
  '24. two lane highways',
  '25. maps with more than 5 lanes',

  // === Combined filters ===
  '26. German motorways with 3 lanes',
  '27. US interstate with 4 lanes',
  '28. urban roads in Japan',
  '29. rural roads in Germany',
  '30. French highways with 2 lanes',

  // === Format-specific ===
  '31. OpenDRIVE format maps',
  '32. lanelet2 format maps',
  '33. ASAM OpenDRIVE HD maps',
  '34. maps in lanelet2 from Germany',
  '35. OpenDRIVE motorway maps',

  // === Natural language synonyms ===
  '36. Autobahn maps',
  '37. Autobahnen in Deutschland',
  '38. show me all German highways',
  '39. find maps of freeways',
  '40. I need highway maps for testing ADAS',

  // === Scenario queries ===
  '41. driving scenarios',
  '42. traffic scenarios',
  '43. weather scenarios',
  '44. night driving scenarios',
  '45. rain scenarios',

  // === Scenario categories ===
  '46. overtaking scenarios',
  '47. lane change scenarios',
  '48. intersection scenarios',
  '49. emergency braking scenarios',
  '50. car following scenarios',

  // === Cross-domain ===
  '51. scenarios on German motorways',
  '52. scenarios with HD maps that have 3 lanes',
  '53. scenarios on urban roads in Japan',
  '54. weather scenarios on highways',
  '55. night scenarios on rural roads',

  // === Georeference ===
  '56. maps from Bavaria',
  '57. maps from California',
  '58. roads near Munich',
  '59. Tokyo road maps',
  '60. Berlin urban maps',

  // === Quality / data source ===
  '61. high accuracy HD maps',
  '62. lidar-based maps',
  '63. camera-based road maps',
  '64. satellite imagery maps',
  '65. survey grade maps',

  // === Quantity / numeric ===
  '66. maps longer than 10 km',
  '67. short road segments under 1 km',
  '68. maps with at least 5 intersections',
  '69. roads with speed limit above 100 km/h',
  '70. maps with many traffic signs',

  // === Traffic direction ===
  '71. right-hand traffic maps',
  '72. left-hand traffic maps',
  '73. right-hand driving German maps',
  '74. left-hand driving UK maps',
  '75. right-hand traffic motorways',

  // === Multi-language ===
  '76. Zeige mir alle Autobahnkarten',
  '77. cartes routières françaises',
  '78. 日本の高速道路マップ',
  '79. mapas de autopistas alemanas',
  '80. mappe stradali italiane',

  // === Edge cases ===
  '81. all maps',
  '82. everything',
  '83. maps with ADAS testing capability',
  '84. V2X communication scenarios',
  '85. autonomous driving test tracks',

  // === Specific use cases ===
  '86. maps for highway pilot testing',
  '87. maps for ACC validation',
  '88. urban maps for parking assist',
  '89. maps for lane keeping assist testing',
  '90. scenarios for AEB testing',

  // === Complex multi-filter ===
  '91. German motorways in OpenDRIVE with 3 lanes and right-hand traffic',
  '92. US interstate maps with 4 lanes in lanelet2 format',
  '93. urban maps from Japan with left-hand traffic',
  '94. rural French roads with 2 lanes',
  '95. motorway maps from Germany or Austria',

  // === Negation / exclusion ===
  '96. maps that are not urban',
  '97. non-German maps',
  '98. all maps except parking areas',
  '99. motorway maps without ramps',
  '100. scenarios without weather conditions',
]

async function parseSSE(response) {
  const text = await response.text()
  const events = {}
  const lines = text.split('\n')
  let currentEvent = null
  let currentData = ''

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim()
    } else if (line.startsWith('data: ')) {
      currentData = line.slice(6)
      if (currentEvent) {
        try {
          events[currentEvent] = JSON.parse(currentData)
        } catch {
          events[currentEvent] = currentData
        }
        currentEvent = null
        currentData = ''
      }
    }
  }
  return events
}

async function runQuery(query, index) {
  const start = Date.now()
  try {
    const res = await fetch(`${API}/search/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })

    if (!res.ok) {
      return { query, index, status: 'HTTP_ERROR', httpCode: res.status, ms: Date.now() - start }
    }

    const events = await parseSSE(res)
    const ms = Date.now() - start

    const interpretation = events.interpretation || {}
    const gaps = events.gaps || []
    const results = events.results || {}
    const meta = events.meta || {}
    const error = events.error

    if (error) {
      return { query, index, status: 'ERROR', error: error.message || error, ms }
    }

    return {
      query,
      index,
      status: 'OK',
      ms,
      matchCount: meta.matchCount ?? results.results?.length ?? 0,
      domains: interpretation.domains || [],
      filters: interpretation.filters || {},
      ranges: interpretation.ranges || {},
      gapCount: gaps.length,
      gaps: gaps.map((g) => g.term || g),
      hasResults: (results.results?.length ?? 0) > 0,
      sparqlError: results.error || null,
    }
  } catch (err) {
    return { query, index, status: 'NETWORK_ERROR', error: err.message, ms: Date.now() - start }
  }
}

async function main() {
  // Verify API is up
  try {
    const health = await fetch(`${API}/health`)
    if (!health.ok) throw new Error(`Health check failed: ${health.status}`)
  } catch (e) {
    console.error(`API not reachable at ${API}: ${e.message}`)
    process.exit(1)
  }

  console.log(`Running ${queries.length} search queries against ${API}...\n`)

  const results = []
  const BATCH_SIZE = 3 // concurrent queries to avoid overwhelming the LLM

  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map((q, j) => runQuery(q, i + j + 1))
    )
    results.push(...batchResults)

    // Progress
    const done = Math.min(i + BATCH_SIZE, queries.length)
    const ok = results.filter((r) => r.status === 'OK').length
    const err = results.filter((r) => r.status !== 'OK').length
    process.stdout.write(`\r[${done}/${queries.length}] OK: ${ok} | Errors: ${err}`)
  }

  console.log('\n\n=== RESULTS SUMMARY ===\n')

  // Group by status
  const ok = results.filter((r) => r.status === 'OK')
  const errors = results.filter((r) => r.status !== 'OK')
  const withResults = ok.filter((r) => r.hasResults)
  const noResults = ok.filter((r) => !r.hasResults)
  const withGaps = ok.filter((r) => r.gapCount > 0)
  const withSparqlError = ok.filter((r) => r.sparqlError)

  console.log(`Total queries:     ${results.length}`)
  console.log(`Successful:        ${ok.length}`)
  console.log(`  With results:    ${withResults.length}`)
  console.log(`  No results:      ${noResults.length}`)
  console.log(`  With gaps:       ${withGaps.length}`)
  console.log(`  SPARQL errors:   ${withSparqlError.length}`)
  console.log(`Failed:            ${errors.length}`)

  // Timing
  const times = ok.map((r) => r.ms)
  if (times.length) {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    const min = Math.min(...times)
    const max = Math.max(...times)
    const p50 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.5)]
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)]
    console.log(`\nLatency (ms):  avg=${avg}  min=${min}  max=${max}  p50=${p50}  p95=${p95}`)
  }

  // Details: errors
  if (errors.length) {
    console.log('\n--- ERRORS ---')
    for (const r of errors) {
      console.log(`  #${r.index} [${r.status}] "${r.query}" → ${r.error || r.httpCode}`)
    }
  }

  // Details: no results
  if (noResults.length) {
    console.log('\n--- NO RESULTS (query succeeded but 0 matches) ---')
    for (const r of noResults) {
      console.log(`  #${r.index} "${r.query}" → domains=${JSON.stringify(r.domains)} filters=${JSON.stringify(r.filters)} gaps=${JSON.stringify(r.gaps)}`)
    }
  }

  // Details: SPARQL errors
  if (withSparqlError.length) {
    console.log('\n--- SPARQL EXECUTION ERRORS ---')
    for (const r of withSparqlError) {
      console.log(`  #${r.index} "${r.query}" → ${r.sparqlError}`)
    }
  }

  // Details: gaps (terms not in ontology)
  if (withGaps.length) {
    console.log('\n--- QUERIES WITH GAPS (unmatched terms) ---')
    for (const r of withGaps) {
      console.log(`  #${r.index} "${r.query}" → gaps: ${JSON.stringify(r.gaps)} (${r.matchCount} results)`)
    }
  }

  // Details: all successful with result counts
  console.log('\n--- ALL SUCCESSFUL QUERIES ---')
  for (const r of ok) {
    const flag = r.hasResults ? '✅' : '⚠️'
    const gapFlag = r.gapCount > 0 ? ` [${r.gapCount} gaps]` : ''
    console.log(`  ${flag} #${r.index} (${r.ms}ms, ${r.matchCount} results${gapFlag}) "${r.query}"`)
  }
}

main()
