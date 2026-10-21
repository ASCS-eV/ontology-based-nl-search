/**
 * Domain scope resolution — which domains a request actually searches.
 *
 * Split out of `compiler.ts` (file-size budget) with no behaviour change; the
 * public names are re-exported from `./compiler.js` so existing importers keep
 * resolving them unchanged.
 *
 * Everything here is graph-driven: the asset-domain set comes from
 * `getAssetDomains()`, the domain names from the registry. No ontology is
 * named.
 */
import { buildDomainRegistry, type DomainRegistry } from '@ontology-search/ontology/domain-registry'
import { normalizeReferences, type SearchSlots } from '@ontology-search/slots/slots'

import { getAssetDomains } from './asset-domains.js'
import { getCompilerVocab } from './compiler-vocab.js'
import { resolveDomainScope } from './compiler-vocabulary-scope.js'

/**
 * Normalize an LLM-supplied domain name toward the registry's directory-name
 * convention: lowercase, hyphens at camelCase boundaries, spaces/underscores
 * to hyphens. Handles variants like "Environment Model", "EnvironmentModel",
 * "environment_model" → "environment-model". Idempotent.
 */
export function normalizeDomainName(domain: string): string {
  return domain
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
}

/**
 * The domains a natural-language request searches, from the domain list the
 * LLM filled and that slot correction extended.
 *
 * Asset domains, discovered data-drivenly from the SHACL / `rdfs:subClassOf`
 * hierarchy (see `queryAssetDomains`), are kept. Dropped:
 *
 *   - Phantom names (LLM-hallucinated "unknown", typos, sentinels from a
 *     failed IRI attribution) — not in the registry at all.
 *   - Support vocabularies (`gx`, `georeference`, `manifest`, …) next to an
 *     asset domain. The LLM names a vocabulary as its reading of the user's
 *     words, and an asset domain it names alongside is the subject; the
 *     vocabulary only describes it.
 *
 * `requested` is the domain list the LLM originally asked for, before slot
 * correction added the owners of the filter properties. When it names ONLY
 * support vocabularies ("<vocabulary> only"), the vocabularies are the scope
 * and are returned as they are: the compiler searches their standalone
 * documents and the assets of the domains that use them, restricted to those
 * carrying their content (`compiler-vocabulary-scope.ts`). The owners slot
 * correction added are dropped, since they would search those domains
 * without the restriction. Defaults to `domains`.
 *
 * Order-preserving and de-duplicated. A name that is a registry directory key
 * resolves to that domain; only an unknown name falls back to the registry's
 * IRI-segment lookup, so two versions of one vocabulary (directory keys
 * `vocab` and `vocab-v2`) never shadow each other.
 *
 * A request that states its scope explicitly does not come through here: the
 * scope it names is searched as named.
 */
export async function resolveKnownDomains(
  domains: string[],
  requested: string[] = domains
): Promise<string[]> {
  const registry = await buildDomainRegistry()
  const assetDomains = await getAssetDomains()
  const split = (names: string[]) => splitDomains(names, registry, assetDomains)
  const asked = split(requested)
  if (asked.assets.length === 0 && asked.vocabularies.length > 0) return asked.vocabularies
  return split(domains).assets
}

/**
 * The asset domains among `domains`, canonicalized, order-preserving and
 * de-duplicated. Unlike {@link resolveKnownDomains}, a support vocabulary is
 * never expanded to the asset domains that use it: for a name that must
 * denote an asset (a reference target), a vocabulary names none.
 */
export async function canonicalAssetDomains(domains: string[]): Promise<string[]> {
  const [registry, assetDomains] = await Promise.all([buildDomainRegistry(), getAssetDomains()])
  return splitDomains(domains, registry, assetDomains).assets
}

/** Canonical names, split into asset domains and support vocabularies. */
function splitDomains(
  names: string[],
  registry: DomainRegistry,
  assetDomains: ReadonlySet<string>
): { assets: string[]; vocabularies: string[] } {
  const seen = new Set<string>()
  const assets: string[] = []
  const vocabularies: string[] = []
  for (const raw of names) {
    const name = normalizeDomainName(raw)
    const canonical = registry.domains.has(name) ? name : registry.resolveByIriDomain(name)?.name
    if (!canonical || seen.has(canonical)) continue
    seen.add(canonical)
    if (assetDomains.has(canonical)) assets.push(canonical)
    else vocabularies.push(canonical)
  }
  return { assets, vocabularies }
}

/**
 * Canonical names for a scope a request states itself: every name the
 * registry knows, asset domain or vocabulary, in request order. `unknown`
 * holds the names it does not know, which the caller rejects rather than
 * silently searching less than was asked.
 */
export async function canonicalDomains(
  domains: readonly string[]
): Promise<{ known: string[]; unknown: string[] }> {
  const registry = await buildDomainRegistry()
  const known: string[] = []
  const unknown: string[] = []
  for (const raw of domains) {
    // A name as the registry spells it, in any case, before the
    // normalization that turns a model's variants into one ("HDMap" is the
    // registry's `hdmap`, not `hd-map`).
    const spellings = [raw, raw.toLowerCase(), normalizeDomainName(raw)]
    const canonical =
      spellings.find((name) => registry.domains.has(name)) ??
      spellings.map((name) => registry.resolveByIriDomain(name)?.name).find(Boolean)
    if (!canonical) unknown.push(raw)
    else if (!known.includes(canonical)) known.push(canonical)
  }
  return { known, unknown }
}

/**
 * Every domain a search scoped to `domains` reads from: the asset domains it
 * names, the asset domains that use a vocabulary it names, and the
 * vocabularies themselves (see `compiler-vocabulary-scope.ts`).
 */
export async function searchedDomains(domains: readonly string[]): Promise<string[]> {
  const [registry, vocabIndex] = await Promise.all([buildDomainRegistry(), getCompilerVocab()])
  const scope = resolveDomainScope(domains, { filters: {}, ranges: {} }, registry, vocabIndex)
  return [...scope.assetDomains, ...scope.vocabularies]
}

/**
 * The filter and range keys of `slots` that no part of the search over
 * `slots.domains` can express: no searched asset domain has a path for the
 * key, and no requested vocabulary's standalone entry class does either.
 *
 * Each key is judged on its own, against every domain the scope can search.
 * Whether one domain can express all keys together is the compiler's
 * question (an owner that cannot is not searched); a key some domain
 * expresses is in scope even when the query as a whole finds nothing. A
 * domain the query references is the target of the reference, not a place
 * to express its constraints.
 */
export async function constraintsOutsideScope(
  slots: Pick<SearchSlots, 'domains' | 'filters' | 'ranges' | 'references'>
): Promise<string[]> {
  const [registry, vocabIndex] = await Promise.all([buildDomainRegistry(), getCompilerVocab()])
  const scope = resolveDomainScope(
    slots.domains,
    { filters: {}, ranges: {}, references: slots.references },
    registry,
    vocabIndex
  )
  const referenced = new Set(normalizeReferences(slots.references).map((ref) => ref.domain))
  const searched = scope.assetDomains.filter((domain) => !referenced.has(domain))
  const roots = scope.vocabularies.flatMap((name) => vocabIndex.vocabularyRoots?.get(name) ?? [])
  const expressible = (key: string) =>
    searched.some(
      (domain) =>
        vocabIndex.paths.has(`${domain}:${key}`) ||
        (vocabIndex.alternatives?.has(`${domain}:${key}`) ?? false)
    ) || roots.some((root) => root.paths.has(key) || (root.alternatives?.has(key) ?? false))
  return [...Object.keys(slots.filters), ...Object.keys(slots.ranges)].filter(
    (key) => !expressible(key)
  )
}
