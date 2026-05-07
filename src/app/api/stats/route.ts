import { NextResponse } from 'next/server'

import { extractErrorMessage, internalError } from '@/lib/errors'
import { buildDomainRegistry } from '@/lib/ontology/domain-registry'
import { ASSET_DOMAINS, compileCountQuery } from '@/lib/search/compiler'
import { getInitializedStore } from '@/lib/search/init'

export async function GET() {
  try {
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

    return NextResponse.json({
      totalAssets,
      domains: counts,
      availableDomains: registry.domainNames,
    })
  } catch (error) {
    console.error('Stats API error:', extractErrorMessage(error))
    return internalError('Failed to retrieve statistics')
  }
}
