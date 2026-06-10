/**
 * Asset-domain discovery — the set of ontology domains that root at least one
 * asset class in the discovered `rdfs:subClassOf` hierarchy (see
 * {@link queryAssetDomains}).
 *
 * Extracted from `compiler.ts` so the compiler and the reference index can both
 * consume it without forming an import cycle (`compiler.ts` → `reference-index.ts`
 * → `getAssetDomains`). This module sits below both: it depends only on the
 * store, the domain registry, and the schema-graph query helpers, none of which
 * import the compiler or the reference index. Enforced by the
 * `madge --circular` CI gate (criterion 6).
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { getDataDomainNames } from '@ontology-search/ontology/sources'

import { getInitializedStore } from './init.js'
import { queryAssetDomains } from './schema-queries.js'

const log = createComponentLogger('asset-domains')

/**
 * Cached asset domains. Stored as the in-flight Promise rather than the
 * resolved value so concurrent cold-start callers share one build instead of
 * each triggering their own `rdfs:subClassOf` scan against the schema graph.
 * The ontology graph is immutable at runtime, so one build lasts the process
 * lifetime.
 */
let cachedAssetDomainsPromise: Promise<Set<string>> | null = null

/** Get all asset domains from the ontology graph. */
export async function getAssetDomains(): Promise<Set<string>> {
  if (cachedAssetDomainsPromise) return cachedAssetDomainsPromise
  cachedAssetDomainsPromise = buildAssetDomains()
  return cachedAssetDomainsPromise
}

async function buildAssetDomains(): Promise<Set<string>> {
  const store = await getInitializedStore()
  const registry = await buildDomainRegistry()
  const domainInfos = await queryAssetDomains(store, registry)
  const assetDomains = new Set(domainInfos.map((d) => d.domainName))

  // Promote domains that have explicitly declared instance data in
  // ontology-sources.json. These are always searchable regardless of
  // whether they participate in a cross-domain rdfs:subClassOf hierarchy.
  for (const name of getDataDomainNames()) {
    if (registry.domains.has(name) && !assetDomains.has(name)) {
      const desc = registry.domains.get(name)!
      if (desc.targetClassIri) {
        assetDomains.add(name)
        log.info('Promoted data-backed domain to asset domain', { domain: name })
      }
    }
  }

  if (assetDomains.size === 0) {
    log.warn('No asset domains found via rdfs:subClassOf — check ontology loading')
  }

  return assetDomains
}

/**
 * Test-only reset of the asset-domain cache. Mirrors the other graph-derived
 * caches' reset seams so suites that load a different fixture ontology start
 * from a clean slate.
 */
export function resetAssetDomains(): void {
  cachedAssetDomainsPromise = null
}
