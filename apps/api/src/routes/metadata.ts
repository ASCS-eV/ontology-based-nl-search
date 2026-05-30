import { badRequest, internalError } from '@ontology-search/core/errors'
import { REQUEST_ID_HEADER, RequestLogger } from '@ontology-search/core/logging'
import { getAssetMetadata, getDomainMetadataAggregate } from '@ontology-search/search'
import { Hono } from 'hono'

import type { AppEnv } from '../types.js'

export const metadataRoutes = new Hono<AppEnv>()

/**
 * `GET /metadata/asset?iri=<iri>`
 *
 * Returns the per-asset facet snapshot — every literal property the
 * asset has, bucketed by the discovered SHACL shape group (Content,
 * Format, Quality, …). Generic in the facet name; "Quality" is one of
 * several groups the same endpoint surfaces (WP3 task #20).
 */
metadataRoutes.get('/asset', async (c) => {
  const requestId = c.get('requestId') as string
  const logger = new RequestLogger({ requestId })

  const iri = c.req.query('iri')
  if (!iri || iri.trim().length === 0) {
    logger.warn('Metadata asset request missing iri parameter')
    const err = badRequest('Missing required query parameter "iri"')
    return c.json(err.body, err.status)
  }

  try {
    logger.info('Metadata asset request started', { iri })
    const metadata = await getAssetMetadata(iri)
    logger.info('Metadata asset request completed', {
      iri,
      domain: metadata.domain,
      groups: Object.keys(metadata.groups).length,
    })
    return c.json(metadata, 200, { [REQUEST_ID_HEADER]: requestId })
  } catch (error) {
    logger.error('Metadata asset API error', error)
    const err = internalError('Failed to load asset metadata')
    return c.json(err.body, err.status)
  }
})

/**
 * `GET /metadata/aggregate?domain=<name>&group=<group>`
 *
 * Returns per-property distribution stats for one facet across every
 * instance of the requested domain. Use cases: domain-level quality
 * dashboard, property-value histograms, range bars.
 */
metadataRoutes.get('/aggregate', async (c) => {
  const requestId = c.get('requestId') as string
  const logger = new RequestLogger({ requestId })

  const domain = c.req.query('domain')
  const group = c.req.query('group')
  if (!domain || domain.trim().length === 0) {
    const err = badRequest('Missing required query parameter "domain"')
    return c.json(err.body, err.status)
  }
  if (!group || group.trim().length === 0) {
    const err = badRequest('Missing required query parameter "group"')
    return c.json(err.body, err.status)
  }

  try {
    logger.info('Metadata aggregate request started', { domain, group })
    const aggregate = await getDomainMetadataAggregate(domain, group)
    logger.info('Metadata aggregate request completed', {
      domain,
      group,
      assets: aggregate.assetCount,
      properties: aggregate.properties.length,
    })
    return c.json(aggregate, 200, { [REQUEST_ID_HEADER]: requestId })
  } catch (error) {
    logger.error('Metadata aggregate API error', error)
    const err = internalError('Failed to compute aggregate metadata')
    return c.json(err.body, err.status)
  }
})
