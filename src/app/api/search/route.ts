import { NextRequest, NextResponse } from 'next/server'

import { generateStructuredSearch } from '@/lib/llm'
import type { SearchResponse } from '@/lib/llm/types'
import { getInitializedStore } from '@/lib/search/init'
import { enforceSparqlPolicy } from '@/lib/sparql/policy'

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "query" field' }, { status: 400 })
    }

    const store = await getInitializedStore()
    const startTime = performance.now()

    // Generate structured interpretation + SPARQL from natural language
    const structured = await generateStructuredSearch(query)

    // Execute the SPARQL query (with policy enforcement)
    const policy = enforceSparqlPolicy(structured.sparql)
    let results: Record<string, string>[] = []
    let sparqlError: string | undefined

    if (!policy.allowed) {
      sparqlError = `Query policy violation: ${policy.violations.join('; ')}`
    } else {
      try {
        const sparqlResults = await store.query(policy.query)
        results = sparqlResults.results.bindings.map((binding) => {
          const row: Record<string, string> = {}
          for (const [key, value] of Object.entries(binding)) {
            row[key] = value.value
          }
          return row
        })
      } catch (err) {
        sparqlError = err instanceof Error ? err.message : 'SPARQL execution failed'
      }
    }

    // Count total datasets in the graph
    let totalDatasets = 0
    try {
      const countResult = await store.query(
        'SELECT (COUNT(DISTINCT ?s) AS ?count) WHERE { ?s a ?type }'
      )
      const countBinding = countResult.results.bindings[0]
      if (countBinding?.count) {
        totalDatasets = parseInt(countBinding.count.value, 10)
      }
    } catch {
      // Non-critical — continue without count
    }

    const executionTimeMs = Math.round(performance.now() - startTime)

    const response: SearchResponse = {
      interpretation: structured.interpretation,
      gaps: structured.gaps,
      sparql: structured.sparql,
      results,
      meta: {
        totalDatasets,
        matchCount: results.length,
        executionTimeMs,
      },
    }

    if (sparqlError) {
      return NextResponse.json({ ...response, error: sparqlError }, { status: 200 })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Search API error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
