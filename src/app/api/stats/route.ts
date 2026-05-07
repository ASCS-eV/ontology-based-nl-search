import { NextResponse } from 'next/server'

import { internalError } from '@/lib/errors'
import { generateRequestId, REQUEST_ID_HEADER, RequestLogger } from '@/lib/logging'
import { buildDomainRegistry } from '@/lib/ontology/domain-registry'
import { ASSET_DOMAINS, compileCountQuery } from '@/lib/search/compiler'
import { getInitializedStore } from '@/lib/search/init'

export async function GET() {
  const requestId = generateRequestId()
  const logger = new RequestLogger({ requestId })

  try {
    logger.info('Stats request started')
    const store = await getInitializedStore()
    const registry = await buildDomainRegistry()

    const counts: Record<string, number> = {}
    let totalAssets = 0

    for (const domainName of registry.domainNames) {
      if (!ASSET_DOMAINS.has(domainName)) continue
      try {
        const query = await compileCountQuery(domainName)
        const result = await store.query(query)
        const count = parseInt(result.results.bindings[0]?.count?.value || '0', 10)
        if (count > 0) {
          counts[domainName] = count
          totalAssets += count
        }
      } catch {
        // Skip domains that fail (no data loaded) — degraded response is OK
      }
    }

    logger.info('Stats request completed', { totalAssets, domainCount: Object.keys(counts).length })

    return NextResponse.json(
      { totalAssets, domains: counts, availableDomains: registry.domainNames },
      { headers: { [REQUEST_ID_HEADER]: requestId } }
    )
  } catch (error) {
    logger.error('Stats API error', error)
    return internalError('Failed to retrieve statistics')
  }
}
