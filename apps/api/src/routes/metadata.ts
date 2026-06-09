import type { AssetMetadata, DomainGroupAggregate } from '@ontology-search/api-types'
import { badRequest } from '@ontology-search/core/errors'
import { getAssetMetadata, getDomainMetadataAggregate } from '@ontology-search/search'
import { Hono } from 'hono'

import type { AppEnv } from '../types.js'
import { handleRoute } from './handler.js'

export const metadataRoutes = new Hono<AppEnv>()

/**
 * `GET /metadata/asset?iri=<iri>`
 *
 * Returns the per-asset facet snapshot — every literal property the
 * asset has, bucketed by the discovered SHACL shape group (Content,
 * Format, Quality, …). Generic in the facet name; "Quality" is one of
 * several groups the same endpoint surfaces.
 */
metadataRoutes.get('/asset', (c) =>
  handleRoute<AssetMetadata>(c, {
    label: 'Metadata asset',
    errorMessage: 'Failed to load asset metadata',
    handler: async (ctx, logger) => {
      const iri = ctx.req.query('iri')
      if (!iri || iri.trim().length === 0) {
        logger.warn('Metadata asset request missing iri parameter')
        return badRequest('Missing required query parameter "iri"')
      }

      logger.info('Metadata asset request started', { iri })
      const metadata = await getAssetMetadata(iri)
      logger.info('Metadata asset request completed', {
        iri,
        domain: metadata.domain,
        groups: Object.keys(metadata.groups).length,
      })
      return metadata
    },
  })
)

/**
 * `GET /metadata/aggregate?domain=<name>&group=<group>`
 *
 * Returns per-property distribution stats for one facet across every
 * instance of the requested domain. Use cases: domain-level quality
 * dashboard, property-value histograms, range bars.
 */
metadataRoutes.get('/aggregate', (c) =>
  handleRoute<DomainGroupAggregate>(c, {
    label: 'Metadata aggregate',
    errorMessage: 'Failed to compute aggregate metadata',
    handler: async (ctx, logger) => {
      const domain = ctx.req.query('domain')
      const group = ctx.req.query('group')
      if (!domain || domain.trim().length === 0) {
        return badRequest('Missing required query parameter "domain"')
      }
      if (!group || group.trim().length === 0) {
        return badRequest('Missing required query parameter "group"')
      }

      logger.info('Metadata aggregate request started', { domain, group })
      const aggregate = await getDomainMetadataAggregate(domain, group)
      logger.info('Metadata aggregate request completed', {
        domain,
        group,
        assets: aggregate.assetCount,
        properties: aggregate.properties.length,
      })
      return aggregate
    },
  })
)
