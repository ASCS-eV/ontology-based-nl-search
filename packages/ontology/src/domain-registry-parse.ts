/**
 * Domain-registry TTL parsers (ADR 0003) — pure RDF parsing helpers that extract
 * prefixes, namespaces, target classes, versions, subclass edges, and
 * primary-asset-class selection from ontology Turtle. No registry/IO state;
 * consumed by `buildDomainRegistry` in `./domain-registry.js`.
 *
 * Every Turtle structure here is read through a real RDF/JS parse (n3), never a
 * regex over the source text [RDF11-TURTLE]. `parseTtl` parses each file once
 * into a `{ quads, prefixes }` view; the extractors below traverse that view by
 * resolved IRI, so comments, arbitrary whitespace, and alternate prefix aliases
 * for the same namespace are all handled correctly. Only `extractVersion`
 * operates on a string — and it parses a version token out of an already-
 * resolved namespace IRI, not out of Turtle syntax.
 */
import { RDF_PREFIXES } from '@ontology-search/core/rdf/prefixes'
import type { Quad } from '@rdfjs/types'
import { Parser as N3Parser } from 'n3'

const RDF_TYPE = `${RDF_PREFIXES.rdf}type`
const OWL_ONTOLOGY = `${RDF_PREFIXES.owl}Ontology`
const RDFS_SUBCLASS_OF = `${RDF_PREFIXES.rdfs}subClassOf`
const SH_TARGET_CLASS = `${RDF_PREFIXES.sh}targetClass`

// Composition-graph predicates: a NodeShape "composes" the shapes and classes
// it references through its property shapes. Following these edges — the direct
// structural links (sh:property, sh:node, sh:class, sh:qualifiedValueShape), the
// logical combinators (sh:and/sh:or/sh:xone/sh:not), and the rdf:first/rdf:rest
// list plumbing those combinators use — reconstructs which shapes nest which
// [SHACL §2.3]. Used to pick a domain's primary asset class as the composition
// ROOT (the shape aggregating the domain's sub-shapes) rather than by SHACL
// declaration order.
const COMPOSITION_PREDICATES: ReadonlySet<string> = new Set([
  `${RDF_PREFIXES.sh}property`,
  `${RDF_PREFIXES.sh}node`,
  `${RDF_PREFIXES.sh}class`,
  `${RDF_PREFIXES.sh}qualifiedValueShape`,
  `${RDF_PREFIXES.sh}and`,
  `${RDF_PREFIXES.sh}or`,
  `${RDF_PREFIXES.sh}xone`,
  `${RDF_PREFIXES.sh}not`,
  `${RDF_PREFIXES.rdf}first`,
  `${RDF_PREFIXES.rdf}rest`,
])

/** A parsed Turtle document: resolved quads plus its declared prefix map. */
export interface ParsedTtl {
  quads: Quad[]
  /** Prefix alias → namespace IRI, exactly as declared via `@prefix`/`PREFIX`. */
  prefixes: Record<string, string>
}

const EMPTY_PARSE: ParsedTtl = { quads: [], prefixes: {} }

/**
 * Parse a Turtle document once with a real RDF parser, returning both its quads
 * and its declared prefixes [RDF11-TURTLE §2.4].
 *
 * A real parser is required, not a regex: the upstream Gaia-X OWL
 * (`gx.owl.ttl`) declares superclasses through deeply nested blank-node
 * `owl:Restriction`s interleaved with named ones; n3 resolves prefixes and
 * blank nodes correctly where a line-oriented regex misreads them. A malformed
 * file must not sink registry construction — the SHACL the registry actually
 * compiles against is validated elsewhere — so a parse failure degrades to the
 * empty view (no quads, no prefixes) rather than throwing.
 */
export function parseTtl(ttlContent: string): ParsedTtl {
  if (ttlContent.length === 0) return EMPTY_PARSE
  const prefixes: Record<string, string> = {}
  try {
    const quads = new N3Parser().parse(ttlContent, null, (prefix, iri) => {
      prefixes[prefix] = typeof iri === 'string' ? iri : iri.value
    })
    return { quads, prefixes }
  } catch {
    return { quads: [], prefixes: {} }
  }
}

/**
 * Case-insensitive prefix lookup. Prefix aliases are case-sensitive in Turtle,
 * but directory names occasionally differ in case from the alias used in the
 * file, so the lookup tolerates a case mismatch (matching the prior behavior).
 */
function lookupPrefix(prefixes: Record<string, string>, alias: string): string | null {
  const lower = alias.toLowerCase()
  for (const [declared, ns] of Object.entries(prefixes)) {
    if (declared.toLowerCase() === lower) return ns
  }
  return null
}

/**
 * Resolve a domain's namespace IRI: the namespace bound to the domain-name
 * prefix wins, then its underscore variant (directory "openlabel-v2" → TTL
 * prefix "openlabel_v2"), then the subject of the file's `owl:Ontology`
 * declaration, and finally — for a flat ontology whose prefix alias differs
 * from the directory name and that declares no `owl:Ontology` (e.g. LinkML
 * `gen-shacl` output) — the namespace shared by the file's `sh:targetClass`
 * shapes. The last fallback needs no prefix-name, version, or ontology-header
 * convention, so any SHACL carrying target-class shapes yields a domain
 * [SHACL §2.1.3.3].
 */
export function extractNamespace(parsed: ParsedTtl, domainName: string): string | null {
  const direct = lookupPrefix(parsed.prefixes, domainName)
  if (direct) return direct

  if (domainName.includes('-')) {
    const underscore = lookupPrefix(parsed.prefixes, domainName.replace(/-/g, '_'))
    if (underscore) return underscore
  }

  for (const q of parsed.quads) {
    if (
      q.predicate.value === RDF_TYPE &&
      q.object.value === OWL_ONTOLOGY &&
      q.subject.termType === 'NamedNode'
    ) {
      return q.subject.value
    }
  }

  return namespaceFromTargetClasses(parsed)
}

/**
 * Last-resort namespace derivation for a flat ontology: the namespace (the IRI up
 * to and including its final `#` or `/`) shared by the most `sh:targetClass`
 * shapes. Deterministic — ties are broken by namespace IRI. Returns `null` when
 * there are no named target classes. This removes the versioned-namespace /
 * matching-prefix convention as a hard requirement [SHACL §2.1.3.3].
 */
function namespaceFromTargetClasses(parsed: ParsedTtl): string | null {
  const counts = new Map<string, number>()
  for (const q of parsed.quads) {
    if (q.predicate.value !== SH_TARGET_CLASS || q.object.termType !== 'NamedNode') continue
    const iri = q.object.value
    const idx = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'))
    if (idx < 0) continue
    const ns = iri.slice(0, idx + 1)
    counts.set(ns, (counts.get(ns) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const ns of [...counts.keys()].sort()) {
    const count = counts.get(ns) ?? 0
    if (count > bestCount) {
      best = ns
      bestCount = count
    }
  }
  return best
}

/**
 * Find the TTL prefix alias that maps to the given namespace.
 * When the directory name differs from the TTL prefix (e.g.,
 * directory "openlabel-v2" → TTL prefix "openlabel_v2"), this
 * resolves the actual alias used in the file.
 */
export function findPrefixAlias(
  declaredPrefixes: Record<string, string>,
  namespace: string
): { alias: string; resolvedNs: string } | null {
  // Exact match first
  for (const [alias, ns] of Object.entries(declaredPrefixes)) {
    if (ns === namespace) return { alias, resolvedNs: ns }
  }
  // Trailing-slash/hash normalization: owl:Ontology IRIs often omit the
  // separator that the @prefix declaration includes (e.g. an ontology IRI
  // without a trailing slash vs a prefix that ends in one).
  const withSlash = namespace.endsWith('/') || namespace.endsWith('#') ? null : namespace + '/'
  const withHash = namespace.endsWith('/') || namespace.endsWith('#') ? null : namespace + '#'
  for (const [alias, ns] of Object.entries(declaredPrefixes)) {
    if (ns === withSlash || ns === withHash) return { alias, resolvedNs: ns }
  }
  return null
}

/**
 * Extract target classes declared via `sh:targetClass` whose IRI sits directly
 * in the given namespace [SHACL §2.1.3.3]. Matching by resolved IRI (not by a
 * prefix alias in the source text) means a class written with any alias that
 * binds to this namespace is found. The local name is restricted to a bare
 * NCName-like token (`\w+`) directly under the namespace, preserving the prior
 * regex's `<prefix>:(\w+)` shape so deeper or punctuated IRIs are ignored as
 * before. Document order is preserved (n3 yields quads in parse order), which
 * `selectPrimaryAssetClass`'s first-declared fallback depends on.
 */
export function extractTargetClasses(
  parsed: ParsedTtl,
  namespace: string
): { localName: string; iri: string }[] {
  const results: { localName: string; iri: string }[] = []
  for (const q of parsed.quads) {
    if (q.predicate.value !== SH_TARGET_CLASS) continue
    if (q.object.termType !== 'NamedNode') continue
    const iri = q.object.value
    if (!iri.startsWith(namespace)) continue
    const localName = iri.slice(namespace.length)
    if (!/^\w+$/.test(localName)) continue
    results.push({ localName, iri })
  }
  return results
}

/**
 * Extract version from namespace IRI (e.g. "v6" from ".../<domain>/v6/")
 */
export function extractVersion(namespace: string): string {
  const match = namespace.match(/\/(v\d+)\/?$/)
  return match?.[1] ?? 'unknown'
}

/**
 * Extract `rdfs:subClassOf` edges between NAMED classes from already-parsed
 * quads [RDFS §3.4]. Blank-node superclasses (`rdfs:subClassOf [ a
 * owl:Restriction … ]`) are skipped — only named class-to-class edges carry the
 * asset/sub-component signal. Parsing happens once in {@link parseTtl}; here we
 * only filter, so a deeply nested blank-node restriction beside a named super
 * (as in the upstream Gaia-X OWL) is resolved correctly.
 */
export function extractSubClassOfEdges(quads: Quad[]): { sub: string; super: string }[] {
  const edges: { sub: string; super: string }[] = []
  for (const q of quads) {
    if (
      q.predicate.value === RDFS_SUBCLASS_OF &&
      q.subject.termType === 'NamedNode' &&
      q.object.termType === 'NamedNode' &&
      q.subject.value !== q.object.value
    ) {
      edges.push({ sub: q.subject.value, super: q.object.value })
    }
  }
  return edges
}

/** Domain name → PascalCase (the conventional asset-class name). */
function domainPascalCase(domainName: string): string {
  return domainName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/**
 * Identify the meta-model SUB-COMPONENT base classes structurally, with no
 * ontology-specific names. A component-base is a class that
 *
 *   1. is the direct `rdfs:subClassOf` target of `sh:targetClass` classes from
 *      **two or more domains** (a shared structural type the domains reuse), AND
 *   2. **is a bare root** — it has no named superclass of its own.
 *
 * Condition 2 separates these reusable STRUCTURE bases (shared component types
 * that several domains reuse) from genuine asset bases (which reach a higher
 * upper-ontology root, e.g. `owl:Thing` or a framework resource class). The
 * set is derived structurally instead of from a hard-coded list of sub-shape
 * names: a class is a "sub-component" — and thus not a domain's primary asset
 * — exactly when it is, or transitively subclasses, a component-base.
 */
export function computeComponentBases(
  subClassEdges: { sub: string; super: string }[],
  targetClassDomain: Map<string, string>
): Set<string> {
  const hasSuper = new Set(subClassEdges.map((e) => e.sub))
  const subDomainsOfSuper = new Map<string, Set<string>>()
  for (const { sub, super: sup } of subClassEdges) {
    const subDomain = targetClassDomain.get(sub)
    if (!subDomain) continue // only count target classes, not intermediate types
    if (!subDomainsOfSuper.has(sup)) subDomainsOfSuper.set(sup, new Set())
    subDomainsOfSuper.get(sup)!.add(subDomain)
  }
  const bases = new Set<string>()
  for (const [sup, domainsOfSup] of subDomainsOfSuper) {
    if (domainsOfSup.size >= 2 && !hasSuper.has(sup)) bases.add(sup)
  }
  return bases
}

/**
 * Build the composition adjacency for a set of quads: subject term value →
 * object term values, for every edge whose predicate continues a
 * shape-composition traversal ({@link COMPOSITION_PREDICATES}). Blank-node
 * identifiers are kept so nested property shapes and `sh:or`/`sh:xone`
 * alternative lists are walked; the caller resolves reached nodes back to
 * target classes [SHACL §2.3].
 */
export function extractCompositionAdjacency(quads: Quad[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>()
  for (const q of quads) {
    if (!COMPOSITION_PREDICATES.has(q.predicate.value)) continue
    const list = adjacency.get(q.subject.value)
    if (list) list.push(q.object.value)
    else adjacency.set(q.subject.value, [q.object.value])
  }
  return adjacency
}

/**
 * Map every shape subject to the target class(es) it declares via
 * `sh:targetClass` [SHACL §2.1.3.3]. A shape may target several classes and a
 * class may be targeted by several shapes, so values are arrays. Lets a
 * composition-reachable shape node be resolved back to the asset class(es) it
 * stands for.
 */
export function extractShapeTargets(quads: Quad[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const q of quads) {
    if (q.predicate.value !== SH_TARGET_CLASS || q.object.termType !== 'NamedNode') continue
    const list = map.get(q.subject.value)
    if (list) list.push(q.object.value)
    else map.set(q.subject.value, [q.object.value])
  }
  return map
}

/**
 * Score each target class by how many OTHER target classes its shape composes
 * (references transitively through the composition graph). A domain's primary
 * asset is the composition ROOT — the shape that aggregates the domain's
 * sub-shapes — which scores highest; standalone leaf/annotation shapes score
 * zero. This makes primary-asset selection independent of SHACL declaration
 * order (a shape reordered or newly inserted upstream cannot displace the
 * asset). Pure over its inputs (adjacency + shape→target map + the set of all
 * target-class IRIs), so it is unit-testable without I/O.
 */
export function computeCompositionScores(
  adjacency: Map<string, string[]>,
  shapeTargets: Map<string, string[]>,
  targetClassIris: ReadonlySet<string>
): Map<string, number> {
  const reachedByTarget = new Map<string, Set<string>>()

  for (const [subject, targets] of shapeTargets) {
    // Depth-first walk of the composition graph from this shape subject,
    // collecting reachable target classes — either a target-class IRI reached
    // directly (sh:class) or a shape node that itself declares a target class
    // (sh:node / sh:qualifiedValueShape). A path-agnostic `seen` set bounds the
    // walk on cyclic shape graphs.
    const reached = new Set<string>()
    const seen = new Set<string>([subject])
    const stack = [...(adjacency.get(subject) ?? [])]
    while (stack.length) {
      const node = stack.pop()!
      if (seen.has(node)) continue
      seen.add(node)
      if (targetClassIris.has(node)) reached.add(node)
      for (const t of shapeTargets.get(node) ?? []) reached.add(t)
      for (const next of adjacency.get(node) ?? []) stack.push(next)
    }
    for (const target of targets) {
      const set = reachedByTarget.get(target) ?? new Set<string>()
      for (const r of reached) if (r !== target) set.add(r)
      reachedByTarget.set(target, set)
    }
  }

  const scores = new Map<string, number>()
  for (const [target, set] of reachedByTarget) scores.set(target, set.size)
  return scores
}

/**
 * Select a domain's primary asset class. PascalCase-of-domain match wins
 * first, otherwise the non-sub-component target class that composes the most
 * of the domain's other shapes — with "sub-component" derived structurally from
 * {@link computeComponentBases} instead of a hard-coded name list. A class is
 * a sub-component when it is, or transitively subclasses, a component-base; an
 * asset class (e.g. `<prefix>:<Class>`) subclasses an asset base instead, so
 * it survives the filter even when not named after its domain.
 *
 * Among the surviving candidates the composition ROOT wins: the class whose
 * shape references the most other target classes ({@link computeCompositionScores}),
 * i.e. the top of the domain's containment tree. This is order-independent — a
 * standalone annotation shape declared before the asset (as upstream ISO-34503
 * ODD shapes now are, ahead of `Scenario`) cannot displace it. `targetClasses`
 * keeps its SHACL declaration order, so ties — including the all-zero case where
 * no candidate composes another target class — fall back to the first-declared
 * candidate, matching prior behavior. When no scores are supplied the selection
 * is exactly the previous first-non-sub-component rule.
 */
export function selectPrimaryAssetClass(
  targetClasses: { localName: string; iri: string }[],
  domainName: string,
  componentBases: Set<string>,
  superOf: Map<string, Set<string>>,
  compositionScore?: ReadonlyMap<string, number>
): { localName: string; iri: string } | null {
  if (targetClasses.length === 0) return null

  const isSubComponent = (iri: string): boolean => {
    if (componentBases.has(iri)) return true
    const seen = new Set<string>()
    const stack = [...(superOf.get(iri) ?? [])]
    while (stack.length) {
      const c = stack.pop()!
      if (seen.has(c)) continue
      seen.add(c)
      if (componentBases.has(c)) return true
      for (const s of superOf.get(c) ?? []) stack.push(s)
    }
    return false
  }

  // PascalCase-of-domain match wins first (a domain name maps to its
  // PascalCase class), even if it is itself a component-base.
  const exact = targetClasses.find((tc) => tc.localName === domainPascalCase(domainName))
  if (exact) return exact

  // Otherwise the composition root among non-sub-components (falling back to all
  // target classes if every candidate is a sub-component). Iterating in SHACL
  // declaration order and replacing only on a STRICTLY higher score keeps the
  // first-declared winner on ties and when no scores disambiguate.
  const candidates = targetClasses.filter((tc) => !isSubComponent(tc.iri))
  const pool = candidates.length > 0 ? candidates : targetClasses
  let best = pool[0]!
  let bestScore = compositionScore?.get(best.iri) ?? 0
  for (let i = 1; i < pool.length; i++) {
    const tc = pool[i]!
    const score = compositionScore?.get(tc.iri) ?? 0
    if (score > bestScore) {
      best = tc
      bestScore = score
    }
  }
  return best
}
