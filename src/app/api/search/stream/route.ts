import { NextRequest } from 'next/server'

import { searchNl } from '@/lib/search/service'

/**
 * Streaming search endpoint using Server-Sent Events (SSE).
 * Thin HTTP adapter — delegates all orchestration to the search service.
 *
 * Progressively sends: status → interpretation → gaps → sparql → results → meta → done
 * Supports client-side abort via AbortSignal (request.signal).
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

  const signal = request.signal
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (signal.aborted) return
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        if (signal.aborted) {
          controller.close()
          return
        }

        send('status', { phase: 'interpreting', message: 'Interpreting query…' })

        const result = await searchNl({ query, signal })

        send('interpretation', result.interpretation)
        send('gaps', result.gaps)
        send('sparql', result.sparql)
        send('status', { phase: 'executing', message: 'Executing SPARQL query…' })
        send('results', {
          results: result.execution.results,
          error: result.execution.error,
        })
        send('meta', result.meta)
        send('done', {})
      } catch (error) {
        if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          // Client disconnected — silent close
        } else {
          const message = error instanceof Error ? error.message : 'Internal server error'
          send('error', { message })
        }
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
