import { NextResponse } from 'next/server'

import { buildDomainRegistry } from '@/lib/ontology/domain-registry'
import { compileCountQuery } from '@/lib/search/compiler'
import { getInitializedStore } from '@/lib/search/init'

/**
 * Domains that represent actual searchable asset types.
 * Excludes supporting ontologies (georeference, manifest, gx, openlabel, envited-x, general).
 */
const ASSET_DOMAINS = new Set([
  'automotive-simulator',
  'environment-model',
  'hdmap',
  'leakage-test',
  'ositrace',
  'scenario',
  'service',
  'simulated-sensor',
  'simulation-model',
  'surface-model',
  'survey',
  'tzip21',
  'vv-report',
])

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
        // Skip domains that fail (no data loaded)
      }
    }

    return NextResponse.json({
      totalAssets,
      domains: counts,
      availableDomains: registry.domainNames,
    })
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json({ totalAssets: 0, domains: {}, availableDomains: [] })
  }
}
