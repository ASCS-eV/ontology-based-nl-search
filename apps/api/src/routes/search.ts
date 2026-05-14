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
      country: z.string().optional(),
      state: z.string().optional(),
      region: z.string().optional(),
      city: z.string().optional(),
    })
    .optional(),
  license: z.string().optional(),
})

export const searchRoutes = new Hono<AppEnv>()

/**
 * Streaming search: SSE endpoint that progressively sends results.
 */
searchRoutes.post('/stream', (c) => {
  const requestId = c.get('requestId') as string
  const streamLogger = new RequestLogger({ requestId })

  return streamSSE(
    c,
    async (stream) => {
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

        const result = await searchNl({ query })

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
  const requestId = c.get('requestId') as string
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
    const result = await searchRefine({ slots: parseResult.data })

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
    logger.error('Refine search failed', error)
    const err = internalError()
    return c.json(err.body, err.status)
  }
})
