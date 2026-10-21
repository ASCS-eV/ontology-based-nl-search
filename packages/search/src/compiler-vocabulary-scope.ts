/**
 * What a support vocabulary in `slots.domains` searches.
 *
 * A support vocabulary roots no asset class of its own: its shapes describe
 * content that asset domains embed (OpenLABEL tags in an HD map or a
 * scenario), and some of it is also published on its own. Scoping a search to
 * such a vocabulary means "what is described with it", which is two things:
 *
 *   - its standalone documents, answered by `compiler-standalone.ts`;
 *   - the assets of every domain whose discovered paths end in one of its
 *     leaves (its *owners*), restricted to the assets that actually carry
 *     its content. Without the restriction, a scope with no constraint of
 *     the vocabulary ("OpenLABEL only", or "OpenLABEL in Germany") would
 *     return every asset of every owner. A domain whose primary class is a
 *     subclass of a class of the vocabulary is an owner too, and needs no
 *     restriction: every one of its assets is described with the vocabulary
 *     by its type.
 *
 * An owner the request names itself is searched as named, without the
 * restriction: the domains of a scope are a union, and the named domain's
 * answers already include its assets that carry the vocabulary. An owner the
 * request references is the target of that reference, not an answer.
 *
 * Everything is read from the discovered paths and the registry; no
 * vocabulary, predicate or namespace is named here.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
import { escapeRdfLiteral } from '@ontology-search/core/rdf/literal'
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import { normalizeReferences, type SearchSlots } from '@ontology-search/slots/slots'

import type { CompilerVocab } from './compiler-vocab.js'
import { keyOfIndexEntry } from './property-keys.js'
import type { PropertyPath } from './property-paths.js'

/** How the domains of a request are searched. */
export interface DomainScope {
  /** Asset domains with an arm of their own: named ones first, then owners. */
  assetDomains: string[]
  /** The asset domains the request names itself. */
  named: string[]
  /**
   * For each owner the request did not name: the vocabularies whose content
   * its assets must carry to be searched.
   */
  carried: Map<string, string[]>
  /** Requested vocabularies, in request order. */
  vocabularies: string[]
}

/** Every compiler path with the asset domain it belongs to. */
function assetPaths(vocabIndex: CompilerVocab): PropertyPath[] {
  return [...vocabIndex.paths.values(), ...[...(vocabIndex.alternatives?.values() ?? [])].flat()]
}

/**
 * A domain in a request is a vocabulary when it owns no path of its own but
 * other domains' paths end in its leaves, or it has standalone entry classes.
 * Any other domain, unknown ones included, is searched as an asset domain.
 */
function isVocabulary(
  domain: string,
  owningDomains: ReadonlySet<string>,
  leafDomains: ReadonlySet<string>,
  vocabIndex: CompilerVocab
): boolean {
  if (owningDomains.has(domain)) return false
  return (
    leafDomains.has(domain) ||
    (vocabIndex.vocabularyRoots?.get(domain)?.length ?? 0) > 0 ||
    [...(vocabIndex.assetClassVocabularies?.values() ?? [])].some((set) => set.has(domain))
  )
}

/**
 * Split `domains` into asset domains and vocabularies, and expand each
 * vocabulary into its owners.
 *
 * An owner is searched for a vocabulary only when it can express every
 * constraint of the query that is a leaf of that vocabulary ([SHACL] §2.3): an
 * HD map carries scenery but no behaviour, so it cannot answer "a straight
 * motorway with lane keeping" however many straight motorways it has. A
 * domain the query references is never an owner: a reference joins its
 * target to the answers rather than adding answers of its own.
 */
export function resolveDomainScope(
  domains: readonly string[],
  slots: Pick<SearchSlots, 'filters' | 'ranges' | 'references'>,
  registry: DomainRegistry,
  vocabIndex: CompilerVocab
): DomainScope {
  const paths = assetPaths(vocabIndex)
  const owningDomains = new Set(paths.map((path) => path.domain))
  const leafDomains = new Set<string>()
  for (const path of paths) {
    const leafDomain = registry.domainForIri(path.propertyIri)
    if (leafDomain) leafDomains.add(leafDomain)
  }

  const assetDomains: string[] = []
  const vocabularies: string[] = []
  for (const domain of domains) {
    const list = isVocabulary(domain, owningDomains, leafDomains, vocabIndex)
      ? vocabularies
      : assetDomains
    if (!list.includes(domain)) list.push(domain)
  }

  const constraints = [...Object.keys(slots.filters), ...Object.keys(slots.ranges)]
  const referenced = new Set(normalizeReferences(slots.references).map((ref) => ref.domain))
  const carried = new Map<string, string[]>()
  const typed = new Set<string>()
  for (const vocabulary of vocabularies) {
    const { owners, required } = vocabularyOwners(vocabulary, constraints, registry, vocabIndex)
    for (const owner of owners) {
      if (assetDomains.includes(owner) || referenced.has(owner)) continue
      const expressesAll = required.every(
        (key) =>
          vocabIndex.paths.has(`${owner}:${key}`) ||
          (vocabIndex.alternatives?.has(`${owner}:${key}`) ?? false)
      )
      if (!expressesAll) continue
      if (vocabIndex.assetClassVocabularies?.get(owner)?.has(vocabulary)) typed.add(owner)
      else carried.set(owner, [...(carried.get(owner) ?? []), vocabulary])
    }
  }
  // An owner typed by one requested vocabulary answers unrestricted, whatever
  // another requested vocabulary would have asked of it.
  for (const owner of typed) carried.delete(owner)
  const owners = [...new Set([...carried.keys(), ...typed])].sort()
  return {
    assetDomains: [...assetDomains, ...owners],
    named: assetDomains,
    carried,
    vocabularies,
  }
}

/**
 * The asset domains whose paths end in a leaf of `vocabulary` or whose primary
 * class is a subclass of one of its classes, sorted, and the
 * `constraints` that are leaves of it — nested in an asset or on one of its
 * standalone entry classes, under a qualified key or a bare name (ADR 0009).
 */
function vocabularyOwners(
  vocabulary: string,
  constraints: readonly string[],
  registry: DomainRegistry,
  vocabIndex: CompilerVocab
): { owners: string[]; required: string[] } {
  const owners = new Set<string>()
  const leaves = new Set<string>()
  const inVocabulary = (path: PropertyPath) =>
    registry.domainForIri(path.propertyIri) === vocabulary
  for (const [indexKey, path] of vocabIndex.paths) {
    if (!inVocabulary(path)) continue
    leaves.add(keyOfIndexEntry(indexKey))
    owners.add(path.domain)
  }
  for (const [domain, vocabularies] of vocabIndex.assetClassVocabularies ?? []) {
    if (vocabularies.has(vocabulary)) owners.add(domain)
  }
  for (const [indexKey, alternatives] of vocabIndex.alternatives ?? []) {
    if (alternatives.some(inVocabulary)) leaves.add(keyOfIndexEntry(indexKey))
  }
  for (const root of vocabIndex.vocabularyRoots?.get(vocabulary) ?? []) {
    for (const key of root.paths.keys()) leaves.add(key)
    for (const name of root.alternatives?.keys() ?? []) leaves.add(name)
  }
  return { owners: [...owners].sort(), required: constraints.filter((key) => leaves.has(key)) }
}

/**
 * The restriction an owner's arm carries: the asset holds content of at least
 * one of `vocabularies`.
 *
 * Content is found where the domain's own paths into the vocabulary enter it.
 * Each such path walks some predicates of the asset's own structure (its
 * *carrier* chain) and then a predicate of the vocabulary; the node at the end
 * of the carrier chain must have a property of the vocabulary. A property
 * belongs to the vocabulary when its IRI is in the vocabulary's namespace and
 * in no longer namespace of another domain, the rule `domainForIri` applies.
 *
 * Shape ([SPARQL11] §8.1 EXISTS, §7 UNION, §9 property paths, §17.4.3.6
 * STRSTARTS):
 *
 *   FILTER EXISTS {
 *     { ?asset <c1>/<c2> ?_content . ?_content ?_contentProperty ?_contentValue .
 *       FILTER(STRSTARTS(STR(?_contentProperty), "<namespace>")) }
 *     UNION { … }
 *   }
 *
 * `null` when the domain has no path into any of them, which
 * {@link resolveDomainScope} never makes an owner.
 */
export function vocabularyContentFilter(
  domain: string,
  vocabularies: readonly string[],
  registry: DomainRegistry,
  vocabIndex: CompilerVocab
): string | null {
  const branches: string[] = []
  for (const vocabulary of vocabularies) {
    const namespace = registry.domains.get(vocabulary)?.namespace
    if (!namespace) continue
    const carriers = new Map<string, string>()
    for (const path of assetPaths(vocabIndex)) {
      if (path.domain !== domain) continue
      if (registry.domainForIri(path.propertyIri) !== vocabulary) continue
      const entry = path.steps.findIndex(
        (step) => registry.domainForIri(step.predicate) === vocabulary
      )
      const chain = path.steps
        .slice(0, entry)
        .map((step) => `<${step.predicate}>`)
        .join('/')
      carriers.set(chain, chain)
    }
    const inNamespace = namespaceTest('?_contentProperty', namespace, vocabulary, registry)
    for (const chain of [...carriers.keys()].sort()) {
      const node = chain === '' ? '?asset' : '?_content'
      const reach = chain === '' ? '' : `?asset ${chain} ?_content . `
      branches.push(`{ ${reach}${node} ?_contentProperty ?_contentValue . FILTER(${inNamespace}) }`)
    }
  }
  if (branches.length === 0) return null
  return `FILTER EXISTS { ${branches.join(' UNION ')} }`
}

/**
 * `variable` is a property of `vocabulary`: inside its namespace and outside
 * every longer namespace another domain claims within it.
 */
function namespaceTest(
  variable: string,
  namespace: string,
  vocabulary: string,
  registry: DomainRegistry
): string {
  const starts = (prefix: string) => `STRSTARTS(STR(${variable}), "${escapeRdfLiteral(prefix)}")`
  const nested = [...registry.domains]
    .filter(
      ([name, descriptor]) =>
        name !== vocabulary &&
        descriptor.namespace.length > namespace.length &&
        descriptor.namespace.startsWith(namespace)
    )
    .map(([, descriptor]) => descriptor.namespace)
    .sort()
  return [starts(namespace), ...nested.map((prefix) => `!${starts(prefix)}`)].join(' && ')
}
