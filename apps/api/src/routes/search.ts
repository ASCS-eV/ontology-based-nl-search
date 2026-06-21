import type { RefineResponse } from '@ontology-search/api-types'
import { getConfig } from '@ontology-search/core/config'
import { badRequest, internalError, unprocessable } from '@ontology-search/core/errors'
import { enumPropertyMembers } from '@ontology-search/core/graphql/enum'
import {
  createComponentLogger,
  REQUEST_ID_HEADER,
  RequestLogger,
} from '@ontology-search/core/logging'
import { SSE_EVENT } from '@ontology-search/core/sse/events'
import {
  extractVocabulary,
  getInitializedStore,
  normalizeReferences,
  parseGraphQLToSlots,
  slotsToGraphQL,
} from '@ontology-search/search'
import { referenceFilterWireSchema } from '@ontology-search/search/slot-wire-schema'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'

import { searchNl, searchRefine } from '../search-factory.js'
import type { AppEnv } from '../types.js'

/**
 * Property names whose filter values the GraphQL serializer should emit as enum
 * literals (so the editor schema can suggest each value). Derived once from the
 * discovered vocabulary via the same `enumPropertyMembers` the editor schema
 * uses, so the two stay in lockstep. Cached for the process — the vocabulary is
 * static per loaded ontology.
 */
const routeLogger = createComponentLogger('search-route')

let enumPropertyNamesCache: ReadonlySet<string> | null = null
async function getEnumPropertyNames(): Promise<ReadonlySet<string>> {
  if (enumPropertyNamesCache) return enumPropertyNamesCache
  try {
    const store = await getInitializedStore()
    const vocab = await extractVocabulary(store)
    const members = enumPropertyMembers(
      vocab.enumProperties.map((p) => ({ name: p.localName, allowedValues: p.allowedValues }))
    )
    enumPropertyNamesCache = new Set(members.keys())
    return enumPropertyNamesCache
  } catch (error) {
    // Vocabulary unavailable (e.g. the store is not initialized in a unit test)
    // — fall back to plain-string serialization. Not cached, so a later call
    // retries once the store is ready.
    routeLogger.warn('Enum-property set unavailable; serializing filter values as strings', {
      error: error instanceof Error ? error.message : String(error),
    })
    return new Set()
  }
}

const searchSlotsSchema = z.object({
  domains: z.array(z.string()).default([]),
  filters: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  ranges: z
    .record(z.string(), z.object({ min: z.number().optional(), max: z.number().optional() }))
    .default({}),
  references: z
    .union([referenceFilterWireSchema, z.array(referenceFilterWireSchema)])
    .optional()
    .transform(normalizeReferences),
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
          event: SSE_EVENT.ERROR,
          data: JSON.stringify(badRequest('Invalid JSON body').body),
        })
        return
      }

      const { query } = body
      if (!query || typeof query !== 'string') {
        await stream.writeSSE({
          event: SSE_EVENT.ERROR,
          data: JSON.stringify(badRequest('Missing or invalid "query" field').body),
        })
        return
      }

      const maxQueryChars = getConfig().API_MAX_QUERY_CHARS
      if (query.length > maxQueryChars) {
        await stream.writeSSE({
          event: SSE_EVENT.ERROR,
          data: JSON.stringify(
            badRequest(`Query too long (${query.length} chars; max ${maxQueryChars}).`).body
          ),
        })
        return
      }

      const logger = new RequestLogger({ requestId, query: String(query) })
      logger.info('Stream search started')

      try {
        const result = await searchNl({
          query,
          signal: controller.signal,
          requestId,
          onProgress: async (progress) => {
            if (controller.signal.aborted) return
            switch (progress.phase) {
              case 'interpreting':
                await stream.writeSSE({
                  event: SSE_EVENT.STATUS,
                  data: JSON.stringify({ phase: 'interpreting', message: 'Interpreting query…' }),
                })
                break
              case 'interpreted':
                if (progress.data) {
                  await stream.writeSSE({
                    event: SSE_EVENT.INTERPRETATION,
                    data: JSON.stringify(progress.data.interpretation),
                  })
                  await stream.writeSSE({
                    event: SSE_EVENT.GAPS,
                    data: JSON.stringify(progress.data.gaps),
                  })
                  await stream.writeSSE({
                    event: SSE_EVENT.SPARQL,
                    data: JSON.stringify(progress.data.sparql),
                  })
                  // Emit GraphQL intermediate representation when feature is enabled
                  if (getConfig().FEATURE_GRAPHQL_LAYER && progress.data.slots) {
                    const enumProperties = await getEnumPropertyNames()
                    const graphql = slotsToGraphQL(progress.data.slots, { enumProperties })
                    await stream.writeSSE({
                      event: SSE_EVENT.GRAPHQL,
                      data: JSON.stringify(graphql),
                    })
                  }
                }
                break
              case 'executing':
                await stream.writeSSE({
                  event: SSE_EVENT.STATUS,
                  data: JSON.stringify({ phase: 'executing', message: 'Executing SPARQL query…' }),
                })
                break
            }
          },
        })

        if (controller.signal.aborted) return

        await stream.writeSSE({
          event: SSE_EVENT.RESULTS,
          data: JSON.stringify({
            results: result.execution.results,
            traceability: result.execution.traceability,
            error: result.execution.error ? 'Query execution failed' : undefined,
          }),
        })
        await stream.writeSSE({ event: SSE_EVENT.META, data: JSON.stringify(result.meta) })
        await stream.writeSSE({ event: SSE_EVENT.DONE, data: '{}' })

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
          event: SSE_EVENT.ERROR,
          data: JSON.stringify({ message: 'Search failed' }),
        })
      }
    },
    async (err, stream) => {
      streamLogger.error('SSE stream error', err)
      await stream.writeSSE({
        event: SSE_EVENT.ERROR,
        data: JSON.stringify({ message: 'Stream error' }),
      })
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

    const response: RefineResponse = {
      sparql: result.sparql,
      results: result.execution.results,
      traceability: result.execution.traceability,
      meta: result.meta,
    }

    // Include GraphQL intermediate representation when feature is enabled
    if (getConfig().FEATURE_GRAPHQL_LAYER) {
      response.graphql = slotsToGraphQL(parseResult.data, {
        enumProperties: await getEnumPropertyNames(),
      })
    }

    return c.json(response, 200, { [REQUEST_ID_HEADER]: requestId })
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

/**
 * Refine-from-GraphQL endpoint: parse user-edited GraphQL → slots → compile → execute.
 */
searchRoutes.post('/refine-graphql', async (c) => {
  const requestId = c.get('requestId')
  const logger = new RequestLogger({ requestId })

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    const err = badRequest('Invalid JSON body')
    return c.json(err.body, err.status)
  }

  if (!body || typeof body !== 'object' || !('graphql' in body)) {
    const err = badRequest('Missing "graphql" field in request body')
    return c.json(err.body, err.status)
  }

  const graphqlQuery = (body as { graphql: unknown }).graphql
  if (typeof graphqlQuery !== 'string' || graphqlQuery.trim().length === 0) {
    const err = badRequest('The "graphql" field must be a non-empty string')
    return c.json(err.body, err.status)
  }

  // Parse GraphQL → SearchSlots
  const parseResult = parseGraphQLToSlots(graphqlQuery)
  if (!parseResult.success) {
    const err = unprocessable(`GraphQL parse error: ${parseResult.error}`)
    return c.json(err.body, err.status)
  }

  try {
    logger.info('Refine-from-GraphQL started', { slots: parseResult.slots })
    const result = await searchRefine({
      slots: parseResult.slots,
      signal: c.req.raw.signal,
      requestId,
    })

    if (result.execution.error) {
      logger.warn('Refine-from-GraphQL query failed', { error: result.execution.error })
      const err = unprocessable('Query could not be executed')
      return c.json(err.body, err.status)
    }

    logger.info('Refine-from-GraphQL completed', { matchCount: result.meta.matchCount })

    const response: RefineResponse = {
      sparql: result.sparql,
      results: result.execution.results,
      traceability: result.execution.traceability,
      meta: result.meta,
    }

    // Re-serialize from the parsed slots (normalized form)
    if (getConfig().FEATURE_GRAPHQL_LAYER) {
      response.graphql = slotsToGraphQL(parseResult.slots, {
        enumProperties: await getEnumPropertyNames(),
      })
    }

    return c.json(response, 200, { [REQUEST_ID_HEADER]: requestId })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.info('Refine-from-GraphQL aborted by client')
      return c.body(null, 408)
    }
    logger.error('Refine-from-GraphQL failed', error)
    const err = internalError()
    return c.json(err.body, err.status)
  }
})
