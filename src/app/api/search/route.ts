import { NextRequest, NextResponse } from 'next/server'
import { generateSparql } from '@/lib/llm'
import { getSparqlStore } from '@/lib/sparql'
import { loadSampleData } from '@/lib/data/loader'

let dataLoaded = false

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "query" field' },
        { status: 400 }
      )
    }

    // Ensure sample data is loaded in memory mode
    const store = getSparqlStore()
    if (process.env.SPARQL_MODE !== 'remote' && !dataLoaded) {
      await loadSampleData(store)
      dataLoaded = true
    }

    // Generate SPARQL from natural language
    const sparql = await generateSparql(query)

    // Execute the SPARQL query
    const sparqlResults = await store.query(sparql)

    // Flatten results to simple key-value objects
    const results = sparqlResults.results.bindings.map((binding) => {
      const row: Record<string, string> = {}
      for (const [key, value] of Object.entries(binding)) {
        row[key] = value.value
      }
      return row
    })

    return NextResponse.json({ sparql, results })
  } catch (error) {
    console.error('Search API error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
