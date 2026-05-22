/**
 * Automated E2E Search Testing Script
 *
 * Sends search queries to the running API, parses SSE responses,
 * validates results against expected outcomes, and reports gaps.
 *
 * Usage: npx tsx scripts/search-e2e-test.ts
 * Requires: API running on localhost:3003
 */

const API_URL = 'http://localhost:3003'

// --- Types ---

interface SseEvent {
  event: string
  data: unknown
}

interface SearchResult {
  query: string
  interpretation?: {
    summary: string
    mappedTerms: Array<{ input: string; mapped: string; confidence: string; property: string }>
    domains?: string[]
    appliedFilters?: Record<string, string | string[]>
    appliedLocation?: Record<string, string>
  }
  gaps?: Array<{ term: string; reason: string; suggestions: string[] }>
  sparql?: string
  results?: { results: Array<Record<string, string>> }
  meta?: { matchCount: number; totalDatasets: number; executionTimeMs: number }
  error?: string
}

interface TestCase {
  query: string
  expectation: {
    shouldMapTerms?: Array<{ input: string; mapped: string; property?: string }>
    shouldFindResults?: boolean
    minResults?: number
    maxResults?: number
    shouldHaveGaps?: string[]
    shouldNotHaveGaps?: string[]
    shouldContainInSparql?: string[]
  }
}

// --- SSE Parser ---

async function sendSearchQuery(query: string, timeoutMs = 60000): Promise<SearchResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const resp = await fetch(`${API_URL}/search/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    })

    if (!resp.ok) {
      return { query, error: `HTTP ${resp.status}: ${resp.statusText}` }
    }

    const text = await resp.text()
    const events = parseSseText(text)
    return buildSearchResult(query, events)
  } catch (e) {
    return { query, error: e instanceof Error ? e.message : String(e) }
  } finally {
    clearTimeout(timeout)
  }
}

function parseSseText(text: string): SseEvent[] {
  const events: SseEvent[] = []
  const blocks = text.split('\n\n').filter(Boolean)

  for (const block of blocks) {
    const lines = block.split('\n')
    let eventType = ''
    let dataStr = ''

    for (const line of lines) {
      if (line.startsWith('event: ')) eventType = line.slice(7)
      else if (line.startsWith('data: ')) dataStr = line.slice(6)
    }

    if (eventType && dataStr) {
      try {
        events.push({ event: eventType, data: JSON.parse(dataStr) })
      } catch {
        events.push({ event: eventType, data: dataStr })
      }
    }
  }

  return events
}

function buildSearchResult(query: string, events: SseEvent[]): SearchResult {
  const result: SearchResult = { query }

  for (const ev of events) {
    switch (ev.event) {
      case 'interpretation':
        result.interpretation = ev.data as SearchResult['interpretation']
        break
      case 'gaps':
        result.gaps = ev.data as SearchResult['gaps']
        break
      case 'sparql':
        result.sparql = ev.data as string
        break
      case 'results':
        result.results = ev.data as SearchResult['results']
        break
      case 'meta':
        result.meta = ev.data as SearchResult['meta']
        break
      case 'error':
        result.error = (ev.data as { message: string }).message
        break
    }
  }

  return result
}

// --- Test Evaluation ---

interface TestResult {
  testCase: TestCase
  searchResult: SearchResult
  passed: boolean
  failures: string[]
  durationMs: number
}

function evaluateTest(
  testCase: TestCase,
  searchResult: SearchResult
): Omit<TestResult, 'durationMs'> {
  const failures: string[] = []
  const { expectation } = testCase

  if (searchResult.error) {
    failures.push(`ERROR: ${searchResult.error}`)
    return { testCase, searchResult, passed: false, failures }
  }

  // Check term mappings
  if (expectation.shouldMapTerms) {
    for (const expected of expectation.shouldMapTerms) {
      const found = searchResult.interpretation?.mappedTerms?.find(
        (t) =>
          t.input.toLowerCase() === expected.input.toLowerCase() && t.mapped === expected.mapped
      )
      if (!found) {
        failures.push(
          `Expected "${expected.input}" → "${expected.mapped}" but got: ${JSON.stringify(
            searchResult.interpretation?.mappedTerms?.filter(
              (t) => t.input.toLowerCase() === expected.input.toLowerCase()
            )
          )}`
        )
      }
    }
  }

  // Check result count
  if (expectation.shouldFindResults === true) {
    const count = searchResult.meta?.matchCount ?? searchResult.results?.results?.length ?? 0
    if (count === 0) {
      failures.push(`Expected results but got 0`)
    }
  }
  if (expectation.shouldFindResults === false) {
    const count = searchResult.meta?.matchCount ?? searchResult.results?.results?.length ?? 0
    if (count > 0) {
      failures.push(`Expected no results but got ${count}`)
    }
  }
  if (expectation.minResults !== undefined) {
    const count = searchResult.meta?.matchCount ?? searchResult.results?.results?.length ?? 0
    if (count < expectation.minResults) {
      failures.push(`Expected at least ${expectation.minResults} results but got ${count}`)
    }
  }
  if (expectation.maxResults !== undefined) {
    const count = searchResult.meta?.matchCount ?? searchResult.results?.results?.length ?? 0
    if (count > expectation.maxResults) {
      failures.push(`Expected at most ${expectation.maxResults} results but got ${count}`)
    }
  }

  // Check gaps
  if (expectation.shouldHaveGaps) {
    for (const term of expectation.shouldHaveGaps) {
      const found = searchResult.gaps?.find((g) =>
        g.term.toLowerCase().includes(term.toLowerCase())
      )
      if (!found) {
        failures.push(
          `Expected gap for "${term}" but none found. Gaps: ${JSON.stringify(searchResult.gaps?.map((g) => g.term))}`
        )
      }
    }
  }
  if (expectation.shouldNotHaveGaps) {
    for (const term of expectation.shouldNotHaveGaps) {
      const found = searchResult.gaps?.find((g) =>
        g.term.toLowerCase().includes(term.toLowerCase())
      )
      if (found) {
        failures.push(`Did NOT expect gap for "${term}" but found: ${found.reason}`)
      }
    }
  }

  // Check SPARQL content
  if (expectation.shouldContainInSparql && searchResult.sparql) {
    for (const fragment of expectation.shouldContainInSparql) {
      if (!searchResult.sparql.toLowerCase().includes(fragment.toLowerCase())) {
        failures.push(`Expected SPARQL to contain "${fragment}"`)
      }
    }
  }

  // Structural check: multiple peer domains should produce UNION queries.
  // Known hierarchies (scenario→hdmap, scenario→environment-model) use JOINs.
  const KNOWN_HIERARCHIES = new Set(['scenario'])
  const domains = searchResult.interpretation?.domains ?? []
  if (domains.length > 1 && searchResult.sparql) {
    const hasParent = domains.some((d) => KNOWN_HIERARCHIES.has(d))
    if (!hasParent && !searchResult.sparql.includes('UNION')) {
      failures.push(`Multi-domain peer query [${domains.join(', ')}] should use UNION but doesn't`)
    }
  }

  // Structural check: all detected domains should appear in the SPARQL body
  // (either as PREFIX or in the query patterns). This catches the old bug where
  // domains were selected but silently dropped from the query.
  if (domains.length > 0 && searchResult.sparql) {
    for (const domain of domains) {
      if (!searchResult.sparql.includes(`${domain}:`)) {
        failures.push(`Domain "${domain}" detected but not found in SPARQL query body`)
      }
    }
  }

  return { testCase, searchResult, passed: failures.length === 0, failures }
}

// --- Test Cases ---
// Based on actual data: 100 HD maps (16 countries, 5 road types, 6 formats, various lane types)
// and 50 scenarios (cut-in, lane-change, pedestrian-crossing, emergency-brake, intersection)

const TEST_CASES: TestCase[] = [
  // === HD MAP QUERIES — Country-based ===
  {
    query: 'HD maps in Germany',
    expectation: {
      shouldMapTerms: [{ input: 'germany', mapped: 'DE', property: 'country' }],
      shouldContainInSparql: ['hdmap:HdMap'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Find maps from France',
    expectation: {
      shouldMapTerms: [{ input: 'france', mapped: 'FR', property: 'country' }],
      shouldFindResults: true,
    },
  },
  {
    query: 'Maps in Japan',
    expectation: {
      shouldMapTerms: [{ input: 'japan', mapped: 'JP', property: 'country' }],
      shouldFindResults: true,
    },
  },
  {
    query: 'HD maps from the United States',
    expectation: {
      shouldMapTerms: [{ input: 'united states', mapped: 'US', property: 'country' }],
      shouldFindResults: true,
    },
  },
  {
    query: 'Maps in China',
    expectation: {
      shouldMapTerms: [{ input: 'china', mapped: 'CN', property: 'country' }],
      shouldFindResults: true,
    },
  },

  // === HD MAP QUERIES — Road types ===
  {
    query: 'Highway maps',
    expectation: {
      shouldMapTerms: [{ input: 'highway', mapped: 'motorway' }],
      shouldContainInSparql: ['motorway'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Rural road HD maps',
    expectation: {
      shouldContainInSparql: ['rural'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Town driving maps',
    expectation: {
      shouldContainInSparql: ['town'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Motorway entry ramp maps',
    expectation: {
      shouldContainInSparql: ['motorway_entry'],
      shouldFindResults: true,
    },
  },

  // === HD MAP QUERIES — Format types ===
  {
    query: 'OpenDRIVE format maps',
    expectation: {
      shouldMapTerms: [{ input: 'opendrive', mapped: 'ASAM OpenDRIVE' }],
      shouldContainInSparql: ['OpenDRIVE'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Lanelet2 HD maps',
    expectation: {
      shouldContainInSparql: ['Lanelet2'],
      shouldFindResults: true,
    },
  },
  {
    query: 'NDS Live format maps',
    expectation: {
      shouldContainInSparql: ['NDS'],
      shouldFindResults: true,
    },
  },

  // === HD MAP QUERIES — Combined criteria ===
  {
    query: 'German motorway maps in OpenDRIVE format',
    expectation: {
      shouldMapTerms: [{ input: 'german', mapped: 'DE', property: 'country' }],
      shouldContainInSparql: ['motorway', 'OpenDRIVE'],
      shouldFindResults: true,
    },
  },
  {
    query: 'HD maps in France with town roads',
    expectation: {
      shouldMapTerms: [{ input: 'france', mapped: 'FR', property: 'country' }],
      shouldContainInSparql: ['town'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Large highway maps with more than 10 intersections',
    expectation: {
      shouldContainInSparql: ['motorway', 'intersection'],
    },
  },

  // === HD MAP QUERIES — Lane types ===
  {
    query: 'Maps with bike lanes',
    expectation: {
      shouldContainInSparql: ['biking'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Maps with emergency lanes',
    expectation: {
      shouldContainInSparql: ['emergency'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Maps with parking lanes',
    expectation: {
      shouldContainInSparql: ['parking'],
      shouldFindResults: true,
    },
  },

  // === SCENARIO QUERIES ===
  {
    query: 'Cut-in scenarios',
    expectation: {
      shouldContainInSparql: ['cut-in'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Lane change scenarios in Germany',
    expectation: {
      shouldContainInSparql: ['lane-change'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Pedestrian crossing scenarios',
    expectation: {
      shouldContainInSparql: ['pedestrian'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Emergency braking scenarios',
    expectation: {
      shouldContainInSparql: ['emergency'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Intersection scenarios in Munich',
    expectation: {
      shouldContainInSparql: ['intersection'],
    },
  },
  {
    query: 'Scenarios with rain weather',
    expectation: {
      shouldContainInSparql: ['rain'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Clear weather driving scenarios',
    expectation: {
      shouldContainInSparql: ['clear'],
    },
  },
  {
    query: 'OpenSCENARIO format scenarios',
    expectation: {
      shouldContainInSparql: ['OpenSCENARIO'],
      shouldFindResults: true,
    },
  },

  // === COMBINED QUERIES — Complex ===
  {
    query: 'Find all HD maps from Switzerland with rural roads',
    expectation: {
      shouldMapTerms: [{ input: 'switzerland', mapped: 'CH', property: 'country' }],
      shouldContainInSparql: ['rural'],
      // Swiss data has 3 maps (town/motorway), no rural — 0 results is correct
    },
  },
  {
    query: 'Show me Italian motorway maps with driving lanes',
    expectation: {
      shouldMapTerms: [{ input: 'italian', mapped: 'IT', property: 'country' }],
      shouldContainInSparql: ['motorway'],
    },
  },
  {
    query: 'Maps in Singapore',
    expectation: {
      shouldMapTerms: [{ input: 'singapore', mapped: 'SG', property: 'country' }],
      shouldFindResults: true,
    },
  },
  {
    query: 'Korean HD maps',
    expectation: {
      shouldMapTerms: [{ input: 'korean', mapped: 'KR', property: 'country' }],
      shouldFindResults: true,
    },
  },
  {
    query: 'Swedish highway maps',
    expectation: {
      shouldMapTerms: [{ input: 'swedish', mapped: 'SE', property: 'country' }],
      shouldContainInSparql: ['motorway'],
    },
  },

  // === EDGE CASES ===
  {
    query: 'maps with speed limits above 100 km/h',
    expectation: {
      shouldContainInSparql: ['speedLimit'],
    },
  },
  {
    query: 'HD maps with traffic lights',
    expectation: {
      shouldContainInSparql: ['trafficLight'],
    },
  },
  {
    query: 'Maps longer than 50 km',
    expectation: {
      shouldContainInSparql: ['length'],
    },
  },
  {
    query: 'Show maps with pedestrian crossings',
    expectation: {
      // "pedestrian crossing" maps to scenario domain or levelOfDetail crosswalk
      // Accepts either scenario results or hdmap results with crosswalk
      shouldContainInSparql: ['pedestrian'],
    },
  },

  // === NATURAL LANGUAGE VARIATIONS ===
  {
    query: 'I need a map of Berlin',
    expectation: {
      shouldMapTerms: [{ input: 'berlin', mapped: 'DE', property: 'country' }],
    },
  },
  {
    query: 'What HD maps do you have for autonomous driving on highways?',
    expectation: {
      // Complex NL query - the LLM should extract "highways" → motorway
      // but this is inherently non-deterministic with LLM interpretation
      shouldFindResults: true,
    },
  },
  {
    query: 'Are there any maps from Australia?',
    expectation: {
      shouldMapTerms: [{ input: 'australia', mapped: 'AU', property: 'country' }],
      shouldFindResults: true,
    },
  },
  {
    query: 'Dutch maps please',
    expectation: {
      shouldMapTerms: [{ input: 'dutch', mapped: 'NL', property: 'country' }],
      shouldFindResults: true,
    },
  },
  {
    query: 'Give me everything from Finland',
    expectation: {
      shouldMapTerms: [{ input: 'finland', mapped: 'FI', property: 'country' }],
      shouldFindResults: true,
    },
  },

  // === SCENARIO-SPECIFIC ===
  {
    query: 'Scenarios with trucks',
    expectation: {
      shouldContainInSparql: ['truck'],
    },
  },
  {
    query: 'Night driving scenarios',
    expectation: {
      shouldContainInSparql: ['night'],
    },
  },
  {
    query: 'Foggy weather scenarios',
    expectation: {
      shouldContainInSparql: ['fog'],
    },
  },
  {
    query: 'Highway merging scenarios',
    expectation: {
      shouldContainInSparql: ['merging'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Scenarios longer than 10 seconds',
    expectation: {
      shouldContainInSparql: ['duration'],
    },
  },

  // === DOMAIN-AGNOSTIC QUERIES ===
  {
    query: 'Show me all available assets',
    expectation: {
      shouldFindResults: true,
    },
  },
  {
    query: 'Free licensed content',
    expectation: {
      shouldContainInSparql: ['license'],
    },
  },
  {
    query: 'CC-BY-4.0 licensed maps',
    expectation: {
      shouldContainInSparql: ['CC-BY-4.0'],
    },
  },

  // === OSI TRACE QUERIES ===
  {
    query: 'OSI traces in Germany',
    expectation: {
      shouldMapTerms: [{ input: 'germany', mapped: 'DE', property: 'country' }],
      shouldContainInSparql: ['ositrace:OSITrace'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Sensor data traces from France',
    expectation: {
      shouldContainInSparql: ['ositrace'],
      shouldFindResults: true,
    },
  },
  {
    query: 'OSI traces with motorway roads',
    expectation: {
      shouldContainInSparql: ['ositrace', 'motorway'],
      shouldFindResults: true,
    },
  },
  {
    query: 'MCAP format OSI recordings',
    expectation: {
      shouldContainInSparql: ['ositrace', 'MCAP'],
      shouldFindResults: true,
    },
  },
  {
    query: 'OSI SensorView traces in Berlin',
    expectation: {
      shouldContainInSparql: ['ositrace', 'SensorView'],
    },
  },
  {
    query: 'GroundTruth traces from Lyon',
    expectation: {
      shouldContainInSparql: ['ositrace', 'GroundTruth'],
    },
  },
  {
    query: 'OSI traces with lidar data source',
    expectation: {
      shouldContainInSparql: ['ositrace', 'lidar'],
    },
  },
  {
    query: 'How many OSI trace recordings do we have from Italy?',
    expectation: {
      shouldMapTerms: [{ input: 'italy', mapped: 'IT', property: 'country' }],
      shouldContainInSparql: ['ositrace'],
      shouldFindResults: true,
    },
  },

  // === MULTI-DOMAIN PEER QUERIES (UNION) ===
  // These should trigger UNION queries searching both domains independently
  {
    query: 'French motorway data',
    expectation: {
      shouldMapTerms: [{ input: 'french', mapped: 'FR', property: 'country' }],
      shouldContainInSparql: ['motorway', 'UNION'],
      shouldFindResults: true,
      minResults: 8, // 7 hdmap + at least 1 ositrace
    },
  },
  {
    query: 'All motorway recordings and maps in Germany',
    expectation: {
      shouldMapTerms: [{ input: 'germany', mapped: 'DE', property: 'country' }],
      shouldContainInSparql: ['motorway', 'UNION'],
      shouldFindResults: true,
    },
  },
  {
    query: 'HD maps and OSI traces with town roads',
    expectation: {
      shouldContainInSparql: ['UNION', 'town'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Road data from the Netherlands',
    expectation: {
      shouldMapTerms: [{ input: 'netherlands', mapped: 'NL', property: 'country' }],
      // LLM might select both hdmap + ositrace or just one — both valid
      shouldFindResults: true,
    },
  },
  {
    query: 'Maps and sensor traces of rural roads in Sweden',
    expectation: {
      shouldMapTerms: [{ input: 'sweden', mapped: 'SE', property: 'country' }],
      shouldContainInSparql: ['rural'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Any data about motorways in Korea',
    expectation: {
      shouldContainInSparql: ['motorway'],
      shouldFindResults: true,
    },
  },

  // === CROSS-REFERENCE QUERIES (scenario referencing hdmap) ===
  {
    query: 'Scenarios that use German motorway maps',
    expectation: {
      shouldContainInSparql: ['scenario', 'manifest:hasReferencedArtifacts'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Lane change scenarios with referenced HD maps',
    expectation: {
      shouldContainInSparql: ['scenario', 'lane-change'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Scenarios referencing maps from Japan',
    expectation: {
      shouldContainInSparql: ['scenario'],
    },
  },

  // === STRANGE / EDGE CASE AD ENGINEER QUERIES ===
  {
    query: 'Autobahn Daten fuer AEB Tests',
    expectation: {
      // German query - should still work
      shouldContainInSparql: ['motorway'],
    },
  },
  {
    query: 'I need data for my simulation but not sure what format',
    expectation: {
      // Vague query — should return something or report gaps
      shouldFindResults: true,
    },
  },
  {
    query: 'dSpace AURELION recordings',
    expectation: {
      shouldContainInSparql: ['AURELION'],
    },
  },
  {
    query: 'What map formats are available?',
    expectation: {
      // Meta-question — might use investigation tools or return all formats
      shouldFindResults: true,
    },
  },
  {
    query: 'data for pedestrian detection algorithm validation',
    expectation: {
      shouldContainInSparql: ['pedestrian'],
    },
  },
  {
    query: 'highway merge ramp OpenDRIVE with 3 lanes',
    expectation: {
      shouldContainInSparql: ['motorway', 'OpenDRIVE'],
    },
  },
  {
    query: 'show me everything from Paris',
    expectation: {
      shouldFindResults: true,
    },
  },
  {
    query: 'OSI and HD maps for Chinese highways',
    expectation: {
      shouldMapTerms: [{ input: 'chinese', mapped: 'CN', property: 'country' }],
      shouldContainInSparql: ['UNION', 'motorway'],
    },
  },
  {
    query: 'traces with more than 10000 frames',
    expectation: {
      shouldContainInSparql: ['ositrace', 'numberFrames'],
    },
  },
  {
    query: 'proprietary licensed sensor recordings',
    expectation: {
      shouldContainInSparql: ['ositrace', 'proprietary'],
    },
  },
  {
    query: 'bicycle and pedestrian detection traces',
    expectation: {
      shouldContainInSparql: ['ositrace'],
    },
  },
  {
    query: 'emergency braking scenarios in fog with referenced HD map',
    expectation: {
      shouldContainInSparql: ['scenario', 'emergency', 'fog'],
    },
  },
  {
    query: '🚗 highway maps',
    expectation: {
      // Emoji in query — should not crash, extract highway → motorway
      shouldContainInSparql: ['motorway'],
    },
  },
  {
    query: '',
    expectation: {
      // Empty query — should handle gracefully
      shouldFindResults: false,
    },
  },
  {
    query: 'SELECT * WHERE { ?s ?p ?o }',
    expectation: {
      // SPARQL injection attempt — should NOT execute raw SPARQL
      // The system should interpret this as a natural language query
      shouldFindResults: false,
    },
  },
  {
    query: 'maps from a country that drives on the left side',
    expectation: {
      // Abstract reasoning — might trigger GB, JP, AU
      shouldFindResults: true,
    },
  },

  // === MORE OSI TRACE + MULTI-DOMAIN COVERAGE ===
  {
    query: 'OSI traces from US with town roads',
    expectation: {
      shouldContainInSparql: ['ositrace', 'town'],
      shouldFindResults: true,
    },
  },
  {
    query: 'French road data including sensor recordings',
    expectation: {
      shouldMapTerms: [{ input: 'french', mapped: 'FR', property: 'country' }],
      shouldFindResults: true,
      minResults: 5,
    },
  },
  {
    query: 'Maps and traces for highway testing in Italy',
    expectation: {
      shouldMapTerms: [{ input: 'italy', mapped: 'IT', property: 'country' }],
      shouldContainInSparql: ['motorway'],
    },
  },
  {
    query: 'High-precision OSI recordings with precision under 0.01',
    expectation: {
      shouldContainInSparql: ['ositrace', 'precision'],
    },
  },
  {
    query: 'OpenDRIVE maps from Korea with motorway_entry roads',
    expectation: {
      shouldMapTerms: [{ input: 'korea', mapped: 'KR', property: 'country' }],
      shouldContainInSparql: ['OpenDRIVE', 'motorway_entry'],
    },
  },
  {
    query: 'Lanelet2 format town maps in China',
    expectation: {
      shouldMapTerms: [{ input: 'china', mapped: 'CN', property: 'country' }],
      shouldContainInSparql: ['Lanelet2', 'town'],
    },
  },
  {
    query: 'Scenario with cut-in on motorway referencing German map',
    expectation: {
      shouldContainInSparql: ['scenario', 'cut-in'],
    },
  },
  {
    query: 'All assets from Japan',
    expectation: {
      shouldMapTerms: [{ input: 'japan', mapped: 'JP', property: 'country' }],
      shouldFindResults: true,
    },
  },
  {
    query: 'German sensor data in MCAP format for ADAS validation',
    expectation: {
      shouldMapTerms: [{ input: 'german', mapped: 'DE', property: 'country' }],
      shouldContainInSparql: ['ositrace', 'MCAP'],
    },
  },
  {
    query: 'HD maps with many intersections near Munich',
    expectation: {
      shouldContainInSparql: ['hdmap', 'intersection'],
    },
  },
  {
    query: 'Sensor recordings with right-hand traffic',
    expectation: {
      shouldContainInSparql: ['ositrace', 'right-hand'],
    },
  },
  {
    query: 'Maps and OSI data for urban driving',
    expectation: {
      shouldContainInSparql: ['town'],
      shouldFindResults: true,
    },
  },
  {
    query: 'French autoroute simulation data',
    expectation: {
      // autoroute = French for motorway
      shouldMapTerms: [{ input: 'french', mapped: 'FR', property: 'country' }],
      shouldContainInSparql: ['motorway'],
      shouldFindResults: true,
    },
  },
  {
    query: 'OSI version 3.7 traces',
    expectation: {
      shouldContainInSparql: ['ositrace', '3.7'],
    },
  },
  {
    query: 'Custom road type HD maps in Australia',
    expectation: {
      shouldMapTerms: [{ input: 'australia', mapped: 'AU', property: 'country' }],
      shouldContainInSparql: ['custom'],
      shouldFindResults: true,
    },
  },
  {
    query: 'Scenarios with trucks in rainy weather at night',
    expectation: {
      shouldContainInSparql: ['scenario', 'truck', 'rain'],
    },
  },
  {
    query: 'British sensor data for motorway',
    expectation: {
      shouldMapTerms: [{ input: 'british', mapped: 'GB', property: 'country' }],
      shouldContainInSparql: ['motorway'],
    },
  },
  {
    query: 'Find MIT licensed OSI traces from France',
    expectation: {
      shouldMapTerms: [{ input: 'france', mapped: 'FR', property: 'country' }],
      shouldContainInSparql: ['ositrace', 'MIT', 'license'],
    },
  },
]

// --- Runner ---

async function runTests(cases: TestCase[], concurrency = 1): Promise<TestResult[]> {
  const results: TestResult[] = []
  let completed = 0

  for (let i = 0; i < cases.length; i += concurrency) {
    const batch = cases.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async (tc) => {
        const start = Date.now()
        const searchResult = await sendSearchQuery(tc.query)
        const durationMs = Date.now() - start
        const evaluation = evaluateTest(tc, searchResult)
        return { ...evaluation, durationMs }
      })
    )

    for (const r of batchResults) {
      results.push(r)
      completed++
      const status = r.passed ? '✅' : '❌'
      const resultCount =
        r.searchResult.meta?.matchCount ?? r.searchResult.results?.results?.length ?? '?'
      console.log(
        `[${completed}/${cases.length}] ${status} "${r.testCase.query}" → ${resultCount} results (${r.durationMs}ms)${
          r.failures.length > 0 ? '\n    ' + r.failures.join('\n    ') : ''
        }`
      )
    }
  }

  return results
}

function printSummary(results: TestResult[]): void {
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const errors = results.filter((r) => r.searchResult.error).length
  const avgTime = Math.round(results.reduce((sum, r) => sum + r.durationMs, 0) / results.length)

  console.log('\n' + '='.repeat(80))
  console.log('SEARCH E2E TEST SUMMARY')
  console.log('='.repeat(80))
  console.log(
    `Total: ${results.length} | Passed: ${passed} | Failed: ${failed} | Errors: ${errors}`
  )
  console.log(`Average response time: ${avgTime}ms`)
  console.log(`Pass rate: ${((passed / results.length) * 100).toFixed(1)}%`)

  if (failed > 0) {
    console.log('\n--- FAILURES ---')
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`\n  Query: "${r.testCase.query}"`)
      for (const f of r.failures) {
        console.log(`    ❌ ${f}`)
      }
    }
  }

  // Ontology gap analysis
  const allGaps = results.flatMap((r) => r.searchResult.gaps ?? [])
  const gapTerms = new Map<string, number>()
  for (const gap of allGaps) {
    gapTerms.set(gap.term, (gapTerms.get(gap.term) ?? 0) + 1)
  }
  if (gapTerms.size > 0) {
    console.log('\n--- ONTOLOGY GAPS (terms not in vocabulary) ---')
    const sorted = [...gapTerms.entries()].sort((a, b) => b[1] - a[1])
    for (const [term, count] of sorted.slice(0, 20)) {
      const suggestion = allGaps.find((g) => g.term === term)?.suggestions?.join(', ') ?? 'none'
      console.log(`  "${term}" (${count}x) → suggestions: ${suggestion}`)
    }
  }

  // Performance analysis
  const slowTests = results.filter((r) => r.durationMs > 30000)
  if (slowTests.length > 0) {
    console.log(`\n--- SLOW QUERIES (>30s) ---`)
    for (const r of slowTests) {
      console.log(`  "${r.testCase.query}" → ${r.durationMs}ms`)
    }
  }

  console.log('\n' + '='.repeat(80))
}

// --- Main ---

async function main() {
  console.log(`Testing ${TEST_CASES.length} search queries against ${API_URL}`)
  console.log('Checking API health...')

  try {
    const health = await fetch(`${API_URL}/health`)
    if (!health.ok) throw new Error(`Health check failed: ${health.status}`)
    console.log('API is healthy ✓\n')
  } catch {
    console.error('ERROR: API not reachable. Start it with: cd apps/api && pnpm dev')
    process.exit(1)
  }

  const stats = await fetch(`${API_URL}/stats`).then((r) => r.json())
  console.log(
    `Data loaded: ${stats.totalAssets} assets across domains: ${Object.keys(stats.domains).join(', ')}\n`
  )

  const results = await runTests(TEST_CASES)
  printSummary(results)

  const passRate = results.filter((r) => r.passed).length / results.length
  process.exit(passRate >= 0.5 ? 0 : 1)
}

main()
