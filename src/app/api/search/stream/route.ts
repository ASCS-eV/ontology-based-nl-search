import { NextRequest } from 'next/server'

import { generateStructuredSearch } from '@/lib/llm'
import { getInitializedStore } from '@/lib/search/init'
import { enforceSparqlPolicy } from '@/lib/sparql/policy'

/**
 * Streaming search endpoint using Server-Sent Events (SSE).
 * Progressively sends: interpretation → gaps → sparql → results → meta
 */
export async function POST(request: NextRequest) {
  let body: { query?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { query } = body

  if (!query || typeof query !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing or invalid "query" field' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const store = await getInitializedStore()
        const startTime = performance.now()

        // Phase 1: LLM generates interpretation + SPARQL
        send('status', {
          phase: 'interpreting',
          message: 'Interpreting query…',
        })

        const structured = await generateStructuredSearch(query)
        // Phase 2: Send interpretation immediately
        send('interpretation', structured.interpretation)

        // Phase 3: Send gaps
        send('gaps', structured.gaps)

        // Phase 4: Send SPARQL
        send('sparql', structured.sparql)

        // Phase 5: Enforce policy + execute SPARQL
        send('status', {
          phase: 'executing',
          message: 'Executing SPARQL query…',
        })

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

        send('results', { results, error: sparqlError })

        // Phase 6: Send meta
        let totalDatasets = 0
        try {
          const countResult = await store.query(
            'PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>\nSELECT (COUNT(DISTINCT ?s) AS ?count) WHERE { ?s a hdmap:HdMap }'
          )
          const countBinding = countResult.results.bindings[0]
          if (countBinding?.count) {
            totalDatasets = parseInt(countBinding.count.value, 10)
          }
        } catch {
          // Non-critical
        }

        const executionTimeMs = Math.round(performance.now() - startTime)

        send('meta', {
          totalDatasets,
          matchCount: results.length,
          executionTimeMs,
        })

        send('done', {})
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        send('error', { message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
