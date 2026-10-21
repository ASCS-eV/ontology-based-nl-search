import type { RefineResponse } from '@ontology-search/api-types'
import { getConfig } from '@ontology-search/core/config'
import {
  AppError,
  badRequest,
  type HttpError,
  internalError,
  unprocessable,
} from '@ontology-search/core/errors'
import {
  createComponentLogger,
  REQUEST_ID_HEADER,
  RequestLogger,
} from '@ontology-search/core/logging'
import { SSE_EVENT } from '@ontology-search/core/sse/events'
import { parseGraphQLToSlots, slotsToGraphQL } from '@ontology-search/graphql-ir'
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { canonicalDomains } from '@ontology-search/search/compiler'
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
 * Per domain, the property keys whose filter values the GraphQL serializer
 * should emit as enum literals (so the editor schema can suggest each value):
 * the GraphQL contract's own, so the serializer and the schema it is
 * validated against read one vocabulary. The contract is cached for the
 * process.
 */
const routeLogger = createComponentLogger('search-route')

async function getEnumProperties(): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
  try {
    return (await getGraphQLContract()).enumProperties
  } catch (error) {
    // Vocabulary unavailable (e.g. the store is not initialized in a unit test)
    // — fall back to plain-string serialization. The contract is not cached on
    // failure, so a later call retries once the store is ready.
    routeLogger.warn('Enum-property set unavailable; serializing filter values as strings', {
      error: error instanceof Error ? error.message : String(error),
    })
    return new Map()
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
 * The fields `/search/stream` takes besides `query` ([JSON-SCHEMA-VAL] §6.4
 * array keywords): `domains`, the scope the user selected. An empty list
 * selects nothing and searches every domain, as an absent one does.
 */
const searchStreamBodySchema = z.object({
  domains: z.array(z.string().min(1)).optional(),
})

/**
 * The scope of a streaming search, in canonical domain names. A name the
 * loaded ontology does not know is rejected with 400 ([RFC9110] §15.5.1)
 * rather than dropped: searching less than the user selected, silently, is
 * exactly what an explicit scope exists to rule out.
 */
async function parseSearchStreamBody(
  raw: Record<string, unknown>
): Promise<{ domains?: string[] } | HttpError> {
  const parsed = searchStreamBodySchema.safeParse(raw)
  if (!parsed.success) {
    return badRequest(
      'Invalid "domains" field',
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    )
  }
  const requested = parsed.data.domains ?? []
  if (requested.length === 0) return {}
  const { known, unknown } = await canonicalDomains(requested)
  if (unknown.length > 0) {
    const { domainNames } = await buildDomainRegistry()
    return badRequest(`Unknown domains: ${unknown.join(', ')}`, [
      `Known domains: ${domainNames.join(', ')}`,
    ])
  }
  return { domains: known }
}

/**
 * Streaming search: SSE endpoint that progressively sends results.
 */
searchRoutes.post('/stream', (c) =>
  handleStreamRoute<{ domains?: string[] }>(c, {
    label: 'Stream search',
    errorMessage: 'Search failed',
    parseBody: parseSearchStreamBody,
    handler: async ({ query, body, signal, logger, emit }) => {
      const result = await searchNl({
        query,
        ...(body.domains ? { domains: body.domains } : {}),
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
                  const enumProperties = await getEnumProperties()
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
        enumProperties: await getEnumProperties(),
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
        enumProperties: await getEnumProperties(),
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
