import { badRequest, internalError } from '@ontology-search/core/errors'
import { REQUEST_ID_HEADER, RequestLogger } from '@ontology-search/core/logging'
import { DEFAULT_LINEAGE_DEPTH, exploreLineage } from '@ontology-search/search'
import { Hono } from 'hono'

import type { AppEnv } from '../types.js'

export const traceabilityRoutes = new Hono<AppEnv>()

/**
 * `GET /traceability?asset=<iri>&depth=N`
 *
 * Walks outgoing `@id` references from `asset` using the data-driven
 * reference index's known predicate paths, recursing up to `depth`
 * hops (default {@link DEFAULT_LINEAGE_DEPTH}; the walker clamps to
 * its own hard upper bound internally). Returns the lineage as a
 * typed tree so the UI can render the validation chain without
 * forcing the user to express it as a search filter (WP3 task #19).
 *
 * Asset IRIs frequently contain reserved characters (`:`, `/`); using
 * a query parameter avoids the routing fragility of an IRI-in-path.
 */
traceabilityRoutes.get('/', async (c) => {
  const requestId = c.get('requestId') as string
  const logger = new RequestLogger({ requestId })

  const asset = c.req.query('asset')
  if (!asset || asset.trim().length === 0) {
    logger.warn('Traceability request missing asset parameter')
    const err = badRequest('Missing required query parameter "asset"')
    return c.json(err.body, err.status)
  }

  const depthParam = c.req.query('depth')
  let depth: number | undefined
  if (depthParam !== undefined) {
    const parsed = Number(depthParam)
    if (!Number.isFinite(parsed) || parsed < 1) {
      logger.warn('Traceability request with invalid depth', { depthParam })
      const err = badRequest('"depth" must be a positive integer')
      return c.json(err.body, err.status)
    }
    depth = parsed
  }

  try {
    logger.info('Traceability request started', { asset, depth: depth ?? DEFAULT_LINEAGE_DEPTH })
    const node = await exploreLineage(asset, { depth })
    logger.info('Traceability request completed', {
      asset,
      rootDomain: node.domain,
      directRefs: node.references.length,
    })
    return c.json({ node }, 200, { [REQUEST_ID_HEADER]: requestId })
  } catch (error) {
    logger.error('Traceability API error', error)
    const err = internalError('Failed to build lineage')
    return c.json(err.body, err.status)
  }
})
