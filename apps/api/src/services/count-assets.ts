/**
 * Count-assets service — tallies assets per domain via SPARQL COUNT queries.
 *
 * Extracted from the /stats route to keep route handlers as pure
 * request/response plumbing (SRP) and enable independent unit testing.
 */
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { compileCountQuery, getAssetDomains, getInitializedStore } from '@ontology-search/search'

export interface AssetCounts {
  counts: Record<string, number>
  totalAssets: number
  availableDomains: string[]
}

/**
 * Count assets per domain by compiling and executing a COUNT query for each.
 * Tolerates per-domain failures (degraded response).
 */
export async function countAssets(): Promise<AssetCounts> {
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
      // intentional: degraded response — one failing domain doesn't block others
    }
  }

  return { counts, totalAssets, availableDomains: registry.domainNames }
}
