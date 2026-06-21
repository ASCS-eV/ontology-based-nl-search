/**
 * Count queries — `SELECT (COUNT(DISTINCT ?asset) …)` per asset domain.
 *
 * Extracted from `compiler.ts` (ADR 0003, decomposition step 1). These are a
 * cohesive, self-contained concern: they build trivial count queries straight
 * from the domain registry + discovered asset domains, and share none of the
 * slot→SPARQL emit machinery, so they live on their own.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11] §11 (aggregates)
 */
import { CompileError } from '@ontology-search/core/errors'
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'

import { getAssetDomains } from './asset-domains.js'

/**
 * Generate a count query for all assets in a specific domain.
 */
export async function compileCountQuery(domainName: string): Promise<string> {
  const registry = await buildDomainRegistry()
  const domain = registry.domains.get(domainName)

  if (!domain) {
    throw new CompileError(`Unknown domain: ${domainName}`)
  }

  const prefixes = registry.prefixesFor(domainName)
  return `${prefixes}
SELECT (COUNT(DISTINCT ?asset) AS ?count) WHERE {
  ?asset a ${domain.targetClass} .
}`
}

/**
 * Generate count queries for all known domains.
 */
export async function compileAllCountQueries(): Promise<{ domain: string; query: string }[]> {
  const registry = await buildDomainRegistry()
  const assetDomains = await getAssetDomains()
  const queries: { domain: string; query: string }[] = []

  for (const domainName of registry.domainNames) {
    if (!assetDomains.has(domainName)) continue
    const domain = registry.domains.get(domainName)!
    const prefixes = registry.prefixesFor(domainName)
    queries.push({
      domain: domainName,
      query: `${prefixes}\nSELECT (COUNT(DISTINCT ?asset) AS ?count) WHERE {\n  ?asset a ${domain.targetClass} .\n}`,
    })
  }

  return queries
}
