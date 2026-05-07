import { NextRequest } from 'next/server'

import { badRequest } from '@/lib/errors'
import { generateRequestId, REQUEST_ID_HEADER, RequestLogger } from '@/lib/logging'
import { searchNl } from '@/lib/search/service'

/**
 * Streaming search endpoint using Server-Sent Events (SSE).
 * Thin HTTP adapter — delegates all orchestration to the search service.
 *
 * Progressively sends: status → interpretation → gaps → sparql → results → meta → done
 * Supports client-side abort via AbortSignal (request.signal).
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId()

  let body: { query?: unknown }
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const { query } = body

  if (!query || typeof query !== 'string') {
    return badRequest('Missing or invalid "query" field')
  }

  const logger = new RequestLogger({ requestId, query: String(query) })
  logger.info('Stream search started')

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

        logger.info('Stream search completed', {
          matchCount: result.meta.matchCount,
          totalMs: result.meta.executionTimeMs,
        })
      } catch (error) {
        if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          logger.info('Stream aborted by client')
        } else {
          logger.error('Stream search failed', error)
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
      [REQUEST_ID_HEADER]: requestId,
    },
  })
}
