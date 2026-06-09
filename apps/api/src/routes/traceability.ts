import type { TraceabilityResponse } from '@ontology-search/api-types'
import { badRequest } from '@ontology-search/core/errors'
import { DEFAULT_LINEAGE_DEPTH, exploreLineage } from '@ontology-search/search'
import { Hono } from 'hono'

import type { AppEnv } from '../types.js'
import { handleRoute } from './handler.js'

export const traceabilityRoutes = new Hono<AppEnv>()

/**
 * `GET /traceability?asset=<iri>&depth=N`
 *
 * Walks outgoing `@id` references from `asset` using the data-driven
 * reference index's known predicate paths, recursing up to `depth`
 * hops (default {@link DEFAULT_LINEAGE_DEPTH}; the walker clamps to
 * its own hard upper bound internally). Returns the lineage as a
 * typed tree so the UI can render the validation chain without
 * forcing the user to express it as a search filter.
 *
 * Asset IRIs frequently contain reserved characters (`:`, `/`); using
 * a query parameter avoids the routing fragility of an IRI-in-path.
 */
traceabilityRoutes.get('/', (c) =>
  handleRoute<TraceabilityResponse>(c, {
    label: 'Traceability',
    errorMessage: 'Failed to build lineage',
    handler: async (ctx, logger) => {
      const asset = ctx.req.query('asset')
      if (!asset || asset.trim().length === 0) {
        logger.warn('Traceability request missing asset parameter')
        return badRequest('Missing required query parameter "asset"')
      }

      const depthParam = ctx.req.query('depth')
      let depth: number | undefined
      if (depthParam !== undefined) {
        const parsed = Number(depthParam)
        if (!Number.isFinite(parsed) || parsed < 1) {
          logger.warn('Traceability request with invalid depth', { depthParam })
          return badRequest('"depth" must be a positive integer')
        }
        depth = parsed
      }

      logger.info('Traceability request started', { asset, depth: depth ?? DEFAULT_LINEAGE_DEPTH })
      const node = await exploreLineage(asset, { depth })
      logger.info('Traceability request completed', {
        asset,
        rootDomain: node.domain,
        directRefs: node.references.length,
      })
      return { node }
    },
  })
)
