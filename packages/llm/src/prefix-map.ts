/**
 * Prefix → namespace IRIs, as the shapes' Turtle declares them to the LLM
 * ([TURTLE] §2.4 `@prefix`; [SPARQL11] §4.1.1.1 prefixed names).
 *
 * Two loaded vocabularies may bind the same prefix to different namespaces,
 * so the value is the list of every namespace the prefix is bound to.
 */
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'

export type PrefixMap = ReadonlyMap<string, readonly string[]>

/** Every prefix the loaded domains declare, including each domain's own. */
export function buildPrefixMap(registry: DomainRegistry): PrefixMap {
  const prefixes = new Map<string, Set<string>>()
  const bind = (prefix: string, namespace: string): void => {
    if (!prefix || !namespace) return
    const bound = prefixes.get(prefix) ?? new Set<string>()
    bound.add(namespace)
    prefixes.set(prefix, bound)
  }
  for (const domain of registry.domains.values()) {
    bind(domain.prefix, domain.namespace)
    for (const [prefix, namespace] of Object.entries(domain.declaredPrefixes)) {
      bind(prefix, namespace)
    }
  }
  return new Map([...prefixes].map(([prefix, bound]) => [prefix, [...bound]]))
}
