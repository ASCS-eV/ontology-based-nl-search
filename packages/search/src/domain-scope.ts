/**
 * Domain scope resolution — which domains a request actually searches.
 *
 * Split out of `compiler.ts` (file-size budget) with no behaviour change; the
 * public names are re-exported from `./compiler.js` so existing importers keep
 * resolving them unchanged.
 *
 * Everything here is graph-driven: the asset-domain set comes from
 * `getAssetDomains()`, the vocabulary leaves from the discovered property
 * paths. No ontology is named.
 */
import { buildDomainRegistry, type DomainRegistry } from '@ontology-search/ontology/domain-registry'

import { getAssetDomains } from './asset-domains.js'
import { standaloneVocabularyDomains } from './compiler-standalone.js'
import { type CompilerVocab, getCompilerVocab } from './compiler-vocab.js'

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
 * Filter a domain list to those that are valid primary search targets —
 * i.e. **asset** domains, discovered data-drivenly from the SHACL /
 * `rdfs:subClassOf` hierarchy (see `queryAssetDomains`). Drops:
 *
 *   - Phantom names (LLM-hallucinated "unknown", typos, sentinels from a
 *     failed IRI attribution) — not in the registry at all.
 *   - Non-asset support vocabularies (`gx`, `georeference`, `manifest`, …)
 *     that the registry knows about but that don't root any asset class in
 *     the discovered subclass hierarchy. The compiler would otherwise emit
 *     a primary `?asset a <Class>` UNION arm using the registry's arbitrary
 *     `targetClass` pick (e.g. `gx:AccessControlManagement`), which has
 *     nothing to do with the query and returns zero rows. When ONLY such
 *     vocabularies were named, they resolve to the asset domains that use
 *     them (see {@link vocabularyScope}).
 *
 * Order-preserving and de-duplicated. A name that is a registry directory key
 * resolves to that domain; only an unknown name falls back to the registry's
 * IRI-segment lookup, so two versions of one vocabulary (`openlabel`,
 * `openlabel-v2`) never shadow each other.
 *
 * `requested` is the domain list the user/LLM originally asked for (before
 * slot correction added the owners of the filter properties). When it names
 * ONLY support vocabularies ("OpenLABEL only"), the vocabulary intent wins:
 * the result is the asset domains using that vocabulary PLUS the vocabulary
 * domains themselves when they have standalone entry classes, so documents
 * of that vocabulary that are not attached to any asset are searched too
 * (see `compiler-standalone.ts`). Defaults to `domains`.
 *
 * `constraints` are the property names of the surviving filters and ranges.
 * An asset domain is a candidate for a vocabulary-only request only when it can
 * express every constraint the vocabulary itself defines — an HD map can carry
 * scenery attributes but never a behaviour flag, so it cannot answer "straight
 * motorway AND lane keeping" however many scenery matches it has.
 *
 * Nothing about any specific ontology is hardcoded: the asset-domain set
 * comes from `getAssetDomains()`, which queries the graph.
 */
export async function resolveKnownDomains(
  domains: string[],
  requested: string[] = domains,
  constraints: readonly string[] = []
): Promise<string[]> {
  const registry = await buildDomainRegistry()
  const assetDomains = await getAssetDomains()
  const split = (names: string[]) => splitDomains(names, registry, assetDomains)
  const { assets: known } = split(domains)
  const asked = split(requested)
  if (asked.assets.length > 0 || asked.vocabularies.length === 0) return known

  const vocabIndex = await getCompilerVocab()
  const scope = vocabularyScope(asked.vocabularies, registry, vocabIndex, constraints)
  const candidates = [...known]
  for (const d of scope.owners) if (!candidates.includes(d)) candidates.push(d)
  // Slot correction may already have added asset domains (the owners of the
  // filter properties); they face the same coverage test as the rest.
  const result = candidates.filter((domain) =>
    scope.required.every((name) => vocabIndex.paths.has(`${domain}:${name}`))
  )
  return [...result, ...standaloneVocabularyDomains(asked.vocabularies, vocabIndex)]
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
 * A request naming ONLY a non-asset vocabulary ("OpenLABEL only", "gx …")
 * means "assets described with that vocabulary" — not "no restriction".
 * `owners` are the asset domains whose SHACL-discovered property paths end
 * in a leaf of that vocabulary ([SHACL] §2.3 property shapes reached via
 * `sh:node`), sorted. Only applied when no asset domain was named, so a
 * precise asset choice is never broadened by a support vocabulary that every
 * asset happens to use.
 *
 * `required` are the constraints (`constraints` ∩ the vocabulary's leaves,
 * nested or standalone) every searched asset domain must be able to express:
 * a domain that can express only part of the restriction would otherwise be
 * searched with the rest silently dropped.
 */
function vocabularyScope(
  vocabularies: string[],
  registry: DomainRegistry,
  vocabIndex: CompilerVocab,
  constraints: readonly string[]
): { owners: string[]; required: string[] } {
  const wanted = new Set(vocabularies)
  const owners = new Set<string>()
  const vocabularyLeaves = new Set<string>()
  for (const path of vocabIndex.paths.values()) {
    const leafDomain = registry.domainForIri(path.propertyIri)
    if (!leafDomain || !wanted.has(leafDomain)) continue
    vocabularyLeaves.add(path.propertyName)
    if (path.domain) owners.add(path.domain)
  }
  for (const vocabulary of vocabularies) {
    for (const root of vocabIndex.vocabularyRoots?.get(vocabulary) ?? []) {
      for (const name of root.paths.keys()) vocabularyLeaves.add(name)
    }
  }
  return {
    owners: [...owners].sort(),
    required: constraints.filter((name) => vocabularyLeaves.has(name)),
  }
}
