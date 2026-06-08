/**
 * Concept-hierarchy expansion — generic SKOS-driven value broadening.
 *
 * A user often expresses a *broad* concept ("Europe", "Scandinavia",
 * "passenger vehicles") that the instance data stores as the set of
 * *narrow* members it covers ("DE", "FR", "IT"; "sedan", "hatchback").
 * Rather than hardcode any such mapping (a continent→country table in
 * the prompt is an ontology-specific tweak), this module reads whatever
 * `skos:Concept` hierarchy the loaded graphs declare and expands a
 * filter value to its transitive narrower members at query time.
 *
 * Fully generic by construction:
 *   - No scheme IRI, concept IRI, or label is named in source.
 *   - Works for geography, vehicle taxonomies, road classifications —
 *     anything modelled with `skos:broader` / `skos:narrower`.
 *   - The "member value" emitted is the member concept's `skos:notation`
 *     (falling back to prefLabel, then the IRI local name), so the
 *     expanded set matches whatever literal form the instance data uses.
 *
 * Complements the compiler's `HIERARCHY_EXPANSION_PATH`: that handles
 * IRI-valued properties by walking `skos:broaderTransitive*` in SPARQL;
 * this handles literal-valued properties by pre-expanding the slot value
 * to the explicit member list before compilation.
 *
 * @see https://www.w3.org/TR/skos-reference/#semantic-relations
 */
import { extractLocalName } from '@ontology-search/core/rdf/iri'
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import type { SparqlStore } from '@ontology-search/sparql/types'

/** A discovered SKOS concept with the strings a user might type for it. */
interface ConceptNode {
  iri: string
  /** prefLabel + altLabel across all languages, lowercased for matching. */
  matchKeys: Set<string>
  /** The canonical value the instance data stores (notation > label > localName). */
  memberValue: string
}

/**
 * The expansion index: a lowercased match-key (label / altLabel /
 * notation / IRI local name of a *broad* concept) → the sorted list of
 * member values its transitive narrower concepts carry.
 *
 * Only concepts that actually have ≥1 narrower member appear as keys —
 * a leaf concept (e.g. an individual country) is never a key, so a
 * filter value that's already a concrete member is left untouched.
 */
export type ConceptExpansionIndex = Map<string, string[]>

/**
 * Query every SKOS concept's labels + notation, and the direct
 * `skos:narrower` / inverse `skos:broader` edges between concepts.
 *
 * Two separate SELECTs (not one big join) keep each query simple and
 * avoid the Oxigraph WASM UNION+OPTIONAL pathologies documented in
 * `property-paths.ts`. Transitive closure is computed in TS so a
 * multi-level hierarchy (continent → region → country) fully expands
 * without relying on the store materialising `skos:broaderTransitive`.
 */
async function queryConceptGraph(
  store: SparqlStore
): Promise<{ nodes: Map<string, ConceptNode>; childrenOf: Map<string, Set<string>> }> {
  // Pass 1: concept identity — labels (any language), altLabels, notation.
  const labelSparql = `
    ${sparqlPrefixes('skos')}

    SELECT DISTINCT ?concept ?label ?alt ?notation WHERE {
      { ?concept a skos:Concept . } UNION { GRAPH ?g { ?concept a skos:Concept . } }
      OPTIONAL { ?concept skos:prefLabel ?label }
      OPTIONAL { ?concept skos:altLabel ?alt }
      OPTIONAL { ?concept skos:notation ?notation }
    }
  `

  // Pass 2: hierarchy edges — both directions normalised to parent→child.
  const edgeSparql = `
    ${sparqlPrefixes('skos')}

    SELECT DISTINCT ?parent ?child WHERE {
      {
        { ?parent skos:narrower ?child . }
        UNION
        { ?child skos:broader ?parent . }
      }
      UNION
      {
        GRAPH ?g {
          { ?parent skos:narrower ?child . }
          UNION
          { ?child skos:broader ?parent . }
        }
      }
      FILTER(isIRI(?parent) && isIRI(?child))
    }
  `

  const [labelResult, edgeResult] = await Promise.all([
    store.query(labelSparql),
    store.query(edgeSparql),
  ])

  const nodes = new Map<string, ConceptNode>()
  const ensure = (iri: string): ConceptNode => {
    let n = nodes.get(iri)
    if (!n) {
      n = { iri, matchKeys: new Set(), memberValue: extractLocalName(iri) }
      nodes.set(iri, n)
    }
    return n
  }

  for (const row of labelResult.results.bindings) {
    const iri = row['concept']?.value
    if (!iri) continue
    const node = ensure(iri)
    const label = row['label']?.value
    const alt = row['alt']?.value
    const notation = row['notation']?.value
    if (label) node.matchKeys.add(label.toLowerCase())
    if (alt) node.matchKeys.add(alt.toLowerCase())
    // memberValue precedence: notation > prefLabel > IRI local name.
    // notation is the code the instance data typically stores (e.g. "DE").
    if (notation) node.memberValue = notation
    else if (label && node.memberValue === extractLocalName(iri)) node.memberValue = label
    // The IRI local name and prefLabel are always valid match keys too.
    node.matchKeys.add(extractLocalName(iri).toLowerCase())
  }

  const childrenOf = new Map<string, Set<string>>()
  for (const row of edgeResult.results.bindings) {
    const parent = row['parent']?.value
    const child = row['child']?.value
    if (!parent || !child || parent === child) continue
    ensure(parent)
    ensure(child)
    const set = childrenOf.get(parent) ?? new Set<string>()
    set.add(child)
    childrenOf.set(parent, set)
  }

  return { nodes, childrenOf }
}

/**
 * Collect the transitive narrower closure of `root` (excluding `root`
 * itself). Iterative BFS with a visited set so a cyclic or
 * diamond-shaped SKOS graph terminates.
 */
function transitiveMembers(root: string, childrenOf: Map<string, Set<string>>): Set<string> {
  const members = new Set<string>()
  const queue = [...(childrenOf.get(root) ?? [])]
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (members.has(cur)) continue
    members.add(cur)
    for (const next of childrenOf.get(cur) ?? []) {
      if (!members.has(next)) queue.push(next)
    }
  }
  return members
}

/**
 * Build the concept-expansion index from the loaded SKOS hierarchy.
 *
 * For every concept that has ≥1 narrower member, every one of its
 * match keys (labels, altLabels, notation, IRI local name) maps to the
 * sorted, deduplicated list of its transitive members' `memberValue`s.
 *
 * Returns an empty map when the graph declares no SKOS hierarchy — the
 * expansion step then becomes a no-op, so an ontology without concept
 * schemes is unaffected.
 */
export async function buildConceptExpansionIndex(
  store: SparqlStore
): Promise<ConceptExpansionIndex> {
  const { nodes, childrenOf } = await queryConceptGraph(store)
  const index: ConceptExpansionIndex = new Map()

  for (const [iri, node] of nodes) {
    const memberIris = transitiveMembers(iri, childrenOf)
    if (memberIris.size === 0) continue // leaf concept — never a broadening key

    // Only LEAF members (no further narrower concepts) contribute a
    // value. Intermediate concepts (e.g. a "Scandinavia" sub-group
    // under "Europe") are structural groupings, not concrete data
    // values, so their own label must not leak into the expansion —
    // the instance data only ever stores the leaf notations.
    const memberValues = new Set<string>()
    for (const memberIri of memberIris) {
      const member = nodes.get(memberIri)
      if (!member) continue
      const hasChildren = (childrenOf.get(memberIri)?.size ?? 0) > 0
      if (hasChildren) continue
      memberValues.add(member.memberValue)
    }
    if (memberValues.size === 0) continue

    const sorted = [...memberValues].sort()
    for (const key of node.matchKeys) {
      // First writer wins on key collision — concepts with overlapping
      // labels are ambiguous; deterministic order (Map insertion, which
      // follows query ORDER) keeps the choice stable.
      if (!index.has(key)) index.set(key, sorted)
    }
  }

  return index
}

/**
 * Cached expansion index. Memoizes the in-flight Promise so concurrent
 * callers share one build (the SKOS hierarchy is immutable at runtime).
 */
let cachedIndexPromise: Promise<ConceptExpansionIndex> | null = null

/** Get the process-wide concept-expansion index, building it once. */
export async function getConceptExpansionIndex(store: SparqlStore): Promise<ConceptExpansionIndex> {
  if (!cachedIndexPromise) cachedIndexPromise = buildConceptExpansionIndex(store)
  return cachedIndexPromise
}

/** Reset the cached index (test-only hook). */
export function resetConceptExpansionIndex(): void {
  cachedIndexPromise = null
}

/**
 * Expand a single filter value against the concept index.
 *
 * Returns the member-value array when `value` (case-insensitively)
 * names a broad concept; otherwise returns `null` so the caller leaves
 * the value untouched. A value that's already a concrete member (leaf
 * concept) or an unrelated literal never matches.
 */
export function expandConceptValue(value: string, index: ConceptExpansionIndex): string[] | null {
  if (!value) return null
  return index.get(value.toLowerCase().trim()) ?? null
}

/**
 * Apply concept expansion across an entire filter map. Any value (or
 * array element) that names a broad concept is replaced by its member
 * set; everything else flows through unchanged. Array values are
 * flattened and de-duplicated so `["europe","CH"]` expands cleanly.
 *
 * Generic — no filter key is privileged; expansion fires purely on
 * whether the *value* matches a hierarchy concept.
 */
export function expandFilterConcepts(
  filters: Record<string, string | string[]>,
  index: ConceptExpansionIndex
): Record<string, string | string[]> {
  if (index.size === 0) return filters

  const out: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      const expanded = new Set<string>()
      for (const v of value) {
        const members = expandConceptValue(v, index)
        if (members) for (const m of members) expanded.add(m)
        else expanded.add(v)
      }
      out[key] = [...expanded]
    } else {
      const members = expandConceptValue(value, index)
      out[key] = members ? members : value
    }
  }
  return out
}
