/**
 * Schema queries — instance-data probes (ADR 0003): SKOS concepts,
 * rdfs:subClassOf edges, and per-property value distributions. These scan the
 * default + named graphs (not the schema graph).
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import type { SparqlStore } from '@ontology-search/sparql/types'

// ─── Phase 2: Generic hierarchical-vocabulary discovery ──────────────────────

/**
 * SKOS concept scheme membership: a concept IRI together with the scheme it
 * belongs to. Discovered generically — we don't assume any particular scheme
 * exists, we just find whatever is declared via skos:inScheme in any graph.
 */
export interface SkosConceptInfo {
  /** Full IRI of the concept (e.g. an ISO country code IRI) */
  iri: string
  /** IRI of the skos:ConceptScheme this concept is a member of */
  scheme: string
  /** Preferred label (skos:prefLabel) if any, language-agnostic first match */
  prefLabel?: string
}

/**
 * Class hierarchy edge discovered via rdfs:subClassOf.
 * Used by the compiler to expand a class-typed filter value to all its
 * subclasses (e.g. {SedanCar} → {SedanCar, CompactSedan, …}).
 */
export interface SubClassEdge {
  /** Subclass IRI */
  sub: string
  /** Superclass IRI */
  super: string
}

/**
 * Distribution of distinct literal values actually used for a property in
 * the instance data. Powers data-driven gap suggestions.
 */
export interface PropertyValueDistribution {
  /** Property IRI */
  property: string
  /** Distinct literal values observed for the property */
  values: string[]
}

/**
 * Discover all SKOS concepts and their containing scheme(s) across the entire
 * store (default graph + named graphs). Generic — no scheme IRIs are hardcoded.
 *
 * @returns one row per (concept, scheme) — concepts in multiple schemes appear
 * multiple times.
 */
export async function querySkosConcepts(store: SparqlStore): Promise<SkosConceptInfo[]> {
  const sparql = `
    ${sparqlPrefixes('skos')}

    SELECT DISTINCT ?iri ?scheme ?prefLabel WHERE {
      {
        ?iri a skos:Concept ;
             skos:inScheme ?scheme .
        OPTIONAL { ?iri skos:prefLabel ?prefLabel }
      }
      UNION
      {
        GRAPH ?g {
          ?iri a skos:Concept ;
               skos:inScheme ?scheme .
          OPTIONAL { ?iri skos:prefLabel ?prefLabel }
        }
      }
    }
    ORDER BY ?scheme ?iri
  `

  const result = await store.query(sparql)
  const out: SkosConceptInfo[] = []
  const seen = new Set<string>()

  for (const row of result.results.bindings) {
    const iri = row['iri']?.value
    const scheme = row['scheme']?.value
    if (!iri || !scheme) continue
    const key = `${iri}|${scheme}`
    if (seen.has(key)) continue
    seen.add(key)

    const prefLabel = row['prefLabel']?.value
    out.push(prefLabel ? { iri, scheme, prefLabel } : { iri, scheme })
  }

  return out
}

/**
 * Discover the rdfs:subClassOf edges declared anywhere in the store.
 * The compiler walks this transitively via SPARQL property paths; we
 * pre-extract the edges so callers can introspect available hierarchies.
 */
export async function querySubClassEdges(store: SparqlStore): Promise<SubClassEdge[]> {
  const sparql = `
    ${sparqlPrefixes('rdfs')}

    SELECT DISTINCT ?sub ?super WHERE {
      { ?sub rdfs:subClassOf ?super . FILTER(isIRI(?super)) }
      UNION
      { GRAPH ?g { ?sub rdfs:subClassOf ?super . FILTER(isIRI(?super)) } }
    }
  `

  const result = await store.query(sparql)
  const edges: SubClassEdge[] = []
  for (const row of result.results.bindings) {
    const sub = row['sub']?.value
    const sup = row['super']?.value
    if (!sub || !sup) continue
    edges.push({ sub, super: sup })
  }
  return edges
}

/**
 * For every distinct property used in the *instance* data (NOT the schema),
 * collect the distinct literal values observed. Generic — works regardless of
 * which domains exist or what the property names are.
 *
 * `propertyIris`, if provided, restricts the query to a known property set
 * to keep result size manageable on large stores. Pass undefined to scan
 * everything (only practical for small/medium datasets).
 */
export async function queryInstanceValueDistribution(
  store: SparqlStore,
  propertyIris?: string[]
): Promise<PropertyValueDistribution[]> {
  // Restrict by VALUES if a property list is supplied so the query stays cheap.
  const valuesClause =
    propertyIris && propertyIris.length > 0
      ? `VALUES ?p { ${propertyIris.map((iri) => `<${iri}>`).join(' ')} }`
      : ''

  const sparql = `
    SELECT DISTINCT ?p ?v WHERE {
      ${valuesClause}
      ?s ?p ?v .
      FILTER(isLiteral(?v))
    }
  `

  const result = await store.query(sparql)
  const map = new Map<string, Set<string>>()
  for (const row of result.results.bindings) {
    const p = row['p']?.value
    const v = row['v']?.value
    if (!p || v === undefined) continue
    const set = map.get(p) ?? new Set<string>()
    set.add(v)
    map.set(p, set)
  }

  return [...map.entries()].map(([property, values]) => ({
    property,
    values: [...values],
  }))
}
