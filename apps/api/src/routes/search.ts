import { badRequest, internalError, unprocessable } from '@ontology-search/core/errors'
import { REQUEST_ID_HEADER, RequestLogger } from '@ontology-search/core/logging'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'

import { searchNl, searchRefine } from '../search-factory.js'
import type { AppEnv } from '../types.js'

const searchSlotsSchema = z.object({
  domains: z.array(z.string()).default([]),
  filters: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  ranges: z
    .record(z.string(), z.object({ min: z.number().optional(), max: z.number().optional() }))
    .default({}),
  location: z
    .object({
      // Each field accepts a single value or an array of values. Arrays let
      // a refine caller express a region (e.g. country: ["DE","FR","IT"])
      // and have the compiler emit `FILTER(?country IN (...))`.
      country: z.union([z.string(), z.array(z.string())]).optional(),
      state: z.union([z.string(), z.array(z.string())]).optional(),
      region: z.union([z.string(), z.array(z.string())]).optional(),
      city: z.union([z.string(), z.array(z.string())]).optional(),
    })
    .optional(),
  license: z.string().optional(),
})

export const searchRoutes = new Hono<AppEnv>()

/**
 * Streaming search: SSE endpoint that progressively sends results.
 */
searchRoutes.post('/stream', (c) => {
  const requestId = c.get('requestId')
  const streamLogger = new RequestLogger({ requestId })

  // Compose two abort sources into a single signal that propagates to the
  // service: the underlying HTTP request signal (client closes the connection
  // mid-flight) and the SSE write-side abort (Hono detects the writer is gone).
  // Either source cancels the LLM call, store query, and count loop downstream
  // so we don't burn compute on a request whose results no one is reading.
  const controller = new AbortController()
  const requestSignal = c.req.raw.signal
  if (requestSignal.aborted) {
    controller.abort()
  } else {
    requestSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  return streamSSE(
    c,
    async (stream) => {
      stream.onAbort(() => controller.abort())

      let body: { query?: unknown }
      try {
        body = await c.req.json()
      } catch {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify(badRequest('Invalid JSON body').body),
        })
        return
      }

      const { query } = body
      if (!query || typeof query !== 'string') {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify(badRequest('Missing or invalid "query" field').body),
        })
        return
      }

      const logger = new RequestLogger({ requestId, query: String(query) })
      logger.info('Stream search started')

      try {
        await stream.writeSSE({
          event: 'status',
          data: JSON.stringify({ phase: 'interpreting', message: 'Interpreting query…' }),
        })

        const result = await searchNl({ query, signal: controller.signal, requestId })

        if (controller.signal.aborted) return

        await stream.writeSSE({
          event: 'interpretation',
          data: JSON.stringify(result.interpretation),
        })
        await stream.writeSSE({ event: 'gaps', data: JSON.stringify(result.gaps) })
        await stream.writeSSE({ event: 'sparql', data: JSON.stringify(result.sparql) })
        await stream.writeSSE({
          event: 'status',
          data: JSON.stringify({ phase: 'executing', message: 'Executing SPARQL query…' }),
        })
        await stream.writeSSE({
          event: 'results',
          data: JSON.stringify({
            results: result.execution.results,
            error: result.execution.error ? 'Query execution failed' : undefined,
          }),
        })
        await stream.writeSSE({ event: 'meta', data: JSON.stringify(result.meta) })
        await stream.writeSSE({ event: 'done', data: '{}' })

        logger.info('Stream search completed', {
          matchCount: result.meta.matchCount,
          totalMs: result.meta.executionTimeMs,
        })
      } catch (error) {
        // Client-side abort isn't a server error — log at info and exit quietly.
        if (error instanceof DOMException && error.name === 'AbortError') {
          logger.info('Stream search aborted by client')
          return
        }
        logger.error('Stream search failed', error)
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: 'Search failed' }),
        })
      }
    },
    async (err, stream) => {
      streamLogger.error('SSE stream error', err)
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ message: 'Stream error' }) })
    }
  )
})

/**
 * Refine endpoint: takes pre-filled slots, compiles SPARQL, executes.
 */
searchRoutes.post('/refine', async (c) => {
  const requestId = c.get('requestId')
  const logger = new RequestLogger({ requestId })

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    const err = badRequest('Invalid JSON body')
    return c.json(err.body, err.status)
  }

  if (!body || typeof body !== 'object' || !('slots' in body)) {
    const err = badRequest('Missing "slots" field in request body')
    return c.json(err.body, err.status)
  }

  const parseResult = searchSlotsSchema.safeParse((body as { slots: unknown }).slots)
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    const err = unprocessable('Invalid slots', issues)
    return c.json(err.body, err.status)
  }

  try {
    logger.info('Refine search started', { slots: parseResult.data })
    const result = await searchRefine({
      slots: parseResult.data,
      signal: c.req.raw.signal,
      requestId,
    })

    if (result.execution.error) {
      logger.warn('Refine query failed', { error: result.execution.error })
      const err = unprocessable('Query could not be executed')
      return c.json(err.body, err.status)
    }

    logger.info('Refine search completed', { matchCount: result.meta.matchCount })

    return c.json(
      { sparql: result.sparql, results: result.execution.results, meta: result.meta },
      200,
      { [REQUEST_ID_HEADER]: requestId }
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      // The client closed the connection mid-flight. The response body is
      // typically discarded, but we surface 408 Request Timeout for the rare
      // case a proxy buffered the response before the abort propagated.
      logger.info('Refine search aborted by client')
      return c.body(null, 408)
    }
    logger.error('Refine search failed', error)
    const err = internalError()
    return c.json(err.body, err.status)
  }
})
