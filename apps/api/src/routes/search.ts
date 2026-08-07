import type { RefineResponse } from '@ontology-search/api-types'
import { getConfig } from '@ontology-search/core/config'
import { AppError, badRequest, internalError, unprocessable } from '@ontology-search/core/errors'
import { enumPropertyMembers } from '@ontology-search/core/graphql/enum'
import {
  createComponentLogger,
  REQUEST_ID_HEADER,
  RequestLogger,
} from '@ontology-search/core/logging'
import { SSE_EVENT } from '@ontology-search/core/sse/events'
import { parseGraphQLToSlots, slotsToGraphQL } from '@ontology-search/graphql-ir'
import { extractSchemaVocabulary, getInitializedStore } from '@ontology-search/search'
import { referenceFilterWireSchema } from '@ontology-search/slots/slot-wire-schema'
import { normalizeReferences } from '@ontology-search/slots/slots'
import { parse, validate } from 'graphql'
import { Hono } from 'hono'
import { z } from 'zod'

import { getGraphQLContract } from '../graphql-schema.js'
import { searchNl, searchRefine } from '../search-factory.js'
import type { AppEnv } from '../types.js'
import { handleStreamRoute } from './stream-handler.js'

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
    // Schema-only: this cache reads enum property names exclusively.
    const vocab = await extractSchemaVocabulary(store)
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
searchRoutes.post('/stream', (c) =>
  handleStreamRoute(c, {
    label: 'Stream search',
    errorMessage: 'Search failed',
    handler: async ({ query, signal, logger, emit }) => {
      const result = await searchNl({
        query,
        signal,
        requestId: c.get('requestId'),
        onProgress: async (progress) => {
          if (signal.aborted) return
          switch (progress.phase) {
            case 'interpreting':
              await emit(SSE_EVENT.STATUS, {
                phase: 'interpreting',
                message: 'Interpreting query…',
              })
              break
            case 'interpreted':
              if (progress.data) {
                await emit(SSE_EVENT.INTERPRETATION, progress.data.interpretation)
                await emit(SSE_EVENT.GAPS, progress.data.gaps)
                await emit(SSE_EVENT.SPARQL, progress.data.sparql)
                // The validated slot IR. The refine round-trip posts this back,
                // so it ships unconditionally — a client that had to re-derive
                // it from `interpretation` could only guess, and would lose
                // multi-valued filters, ranges and references.
                if (progress.data.slots) await emit(SSE_EVENT.SLOTS, progress.data.slots)
                // Emit GraphQL intermediate representation when feature is enabled
                if (getConfig().FEATURE_GRAPHQL_LAYER && progress.data.slots) {
                  const enumProperties = await getEnumPropertyNames()
                  await emit(
                    SSE_EVENT.GRAPHQL,
                    slotsToGraphQL(progress.data.slots, { enumProperties })
                  )
                }
              }
              break
            case 'executing':
              await emit(SSE_EVENT.STATUS, {
                phase: 'executing',
                message: 'Executing SPARQL query…',
              })
              break
          }
        },
      })

      if (signal.aborted) return

      await emit(SSE_EVENT.RESULTS, {
        results: result.execution.results,
        traceability: result.execution.traceability,
        error: result.execution.error ? 'Query execution failed' : undefined,
      })
      await emit(SSE_EVENT.META, result.meta)
      await emit(SSE_EVENT.DONE, {})

      logger.info('Stream search completed', {
        matchCount: result.meta.matchCount,
        totalMs: result.meta.executionTimeMs,
      })
    },
  })
)

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
      // The POST-normalization slots (`references` is coerced to an array
      // here), so the client's editable panel reflects what actually ran
      // rather than what it happened to send.
      slots: parseResult.data,
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
    // Typed errors carry their own status and an operator-facing message —
    // let the app's onError handler map them instead of flattening every
    // cause into one opaque 500.
    if (error instanceof AppError) throw error
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

  let document
  try {
    document = parse(graphqlQuery)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const err = unprocessable('GraphQL syntax error', [message])
    return c.json(err.body, err.status)
  }

  try {
    const contract = await getGraphQLContract()
    const validationErrors = validate(contract.schema, document)
    if (validationErrors.length > 0) {
      const err = unprocessable(
        'GraphQL schema validation failed',
        validationErrors.slice(0, 5).map((error) => error.message)
      )
      return c.json(err.body, err.status)
    }

    const parseResult = parseGraphQLToSlots(graphqlQuery, { nameMap: contract.nameMap })
    if (!parseResult.success) {
      const err = unprocessable('GraphQL structure is not supported', [parseResult.error])
      return c.json(err.body, err.status)
    }

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
      // What the GraphQL document parsed to. The caller sent prose-free
      // GraphQL and has no other way to learn the slots that ran, so without
      // this its refinement panel would keep showing the PREVIOUS query's IR
      // and a subsequent re-run would silently execute that instead.
      slots: parseResult.slots,
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
    if (error instanceof AppError) throw error
    logger.error('Refine-from-GraphQL failed', error)
    const err = internalError()
    return c.json(err.body, err.status)
  }
})
