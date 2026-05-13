import { internalError } from '@ontology-search/core/errors'
import { REQUEST_ID_HEADER, RequestLogger } from '@ontology-search/core/logging'
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { compileCountQuery, getAssetDomains, getInitializedStore } from '@ontology-search/search'
import { Hono } from 'hono'

import type { AppEnv } from '../types.js'

export const statsRoutes = new Hono<AppEnv>()

statsRoutes.get('/', async (c) => {
  const requestId = c.get('requestId') as string
  const logger = new RequestLogger({ requestId })

  try {
    logger.info('Stats request started')
    const store = await getInitializedStore()
    const registry = await buildDomainRegistry()
    const assetDomains = await getAssetDomains()

    const counts: Record<string, number> = {}
    let totalAssets = 0

    for (const domainName of registry.domainNames) {
      if (!assetDomains.has(domainName)) continue
      try {
        const query = await compileCountQuery(domainName)
        const result = await store.query(query)
        const count = parseInt(result.results.bindings[0]?.['count']?.value ?? '0', 10)
        if (count > 0) {
          counts[domainName] = count
          totalAssets += count
        }
      } catch {
        // Skip domains that fail — degraded response is acceptable
      }
    }

    logger.info('Stats request completed', { totalAssets, domainCount: Object.keys(counts).length })

    return c.json({ totalAssets, domains: counts, availableDomains: registry.domainNames }, 200, {
      [REQUEST_ID_HEADER]: requestId,
    })
  } catch (error) {
    logger.error('Stats API error', error)
    const err = internalError('Failed to retrieve statistics')
    return c.json(err.body, err.status)
  }
})
