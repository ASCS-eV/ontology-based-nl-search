/**
 * Schema queries — shape-group classification & 2D-range discovery (ADR 0003).
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import { extractLocalName } from '@ontology-search/core/rdf/iri'
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { SCHEMA_GRAPH } from './schema-loader.js'
import { extractDomainFromRegistry } from './schema-queries-domains.js'

/** Property shape group classification from SHACL nesting structure */
export interface PropertyShapeGroupInfo {
  /** Property local name */
  localName: string
  /** Domain that defines this property */
  domain: string
  /** Shape group from rdfs:subClassOf hierarchy (e.g. a "Content" / "Format" / "Quantity" sub-shape) */
  shapeGroup: string
}

/** Property that uses a Range2D structure (min/max sub-properties) */
export interface Range2DPropertyInfo {
  /** Property local name */
  localName: string
  /** Domain that defines this property */
  domain: string
  /** Full IRI of the lower-bound sub-predicate (the leaf bearing sh:lessThanOrEquals). */
  minPredicate: string
  /** Full IRI of the upper-bound sub-predicate (the sh:lessThanOrEquals target). */
  maxPredicate: string
}

/**
 * Query SHACL shape nesting to classify properties into shape groups.
 *
 * Uses rdfs:subClassOf to determine which abstract shape group each property
 * belongs to (Content, Format, Quantity, Quality, DataSource). This is the
 * graph-driven replacement for hardcoded property classification.
 *
 * Detects cross-domain inheritance: a domain-specific class inherits from
 * a base class in a different domain. The superclass local name is the
 * shape group label (e.g., "Content", "Format").
 */
export async function queryPropertyShapeGroups(
  store: SparqlStore,
  registry?: DomainRegistry
): Promise<PropertyShapeGroupInfo[]> {
  const sparql = `
    ${sparqlPrefixes('sh', 'rdfs')}

    SELECT DISTINCT ?propIri ?targetClass ?superclass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:targetClass ?targetClass .
        ?shape sh:property ?propShape .
        ?propShape sh:path ?propIri .
        FILTER(isIRI(?propIri))

        ?targetClass rdfs:subClassOf ?superclass .
        FILTER(isIRI(?superclass))
      }
    }
    ORDER BY ?propIri
  `

  const result = await store.query(sparql)
  const groups: PropertyShapeGroupInfo[] = []
  const seen = new Set<string>()

  for (const row of result.results.bindings) {
    const propIri = row['propIri']?.value
    const targetClass = row['targetClass']?.value
    const superclass = row['superclass']?.value
    if (!propIri || !targetClass || !superclass) continue

    const localName = extractLocalName(propIri)
    const domain = extractDomainFromRegistry(targetClass, registry)
    const superDomain = extractDomainFromRegistry(superclass, registry)
    const shapeGroup = extractLocalName(superclass)
    const key = `${localName}:${domain}`

    // Only include cross-domain inheritance (property's class inherits from
    // a base class in a different domain). Same-domain subClassOf is just
    // internal OWL structuring, not a shape group classification.
    if (
      localName &&
      domain &&
      superDomain &&
      domain !== superDomain &&
      shapeGroup &&
      !seen.has(key)
    ) {
      seen.add(key)
      groups.push({ localName, domain, shapeGroup })
    }
  }

  return groups
}

/**
 * Query for properties that wrap a numeric min/max interval.
 *
 * Detected STRUCTURALLY, not by class name: a property whose `sh:node`
 * points to a shape with two scalar leaves where one leaf declares
 * `sh:lessThanOrEquals <other>` — the SHACL constraint that semantically
 * marks the lower bound (its value must be ≤ the other leaf's value). The
 * `sh:lessThanOrEquals` target identifies the upper-bound predicate, and the
 * bearing leaf's own `sh:path` identifies the lower-bound predicate. Both
 * sub-predicate IRIs are returned so the compiler emits the discovered
 * predicates rather than literal `:min`/`:max`.
 *
 * Replaces the prior `CONTAINS(STR(?rangeClass), "Range2D")` match and the
 * hardcoded `min`/`max` local names — an ontology that names its interval
 * wrapper `Interval`/`BoundingRange` with `lowerBound`/`upperBound` sub-
 * properties is now detected identically (criterion 9 / 9b).
 */
export async function queryRange2DProperties(
  store: SparqlStore,
  registry?: DomainRegistry
): Promise<Range2DPropertyInfo[]> {
  const sparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?propIri ?minPred ?maxPred WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:property ?propShape .
        ?propShape sh:path ?propIri .
        ?propShape sh:node ?rangeShape .
        ?rangeShape sh:property ?minLeaf .
        ?minLeaf sh:path ?minPred .
        ?minLeaf sh:lessThanOrEquals ?maxPred .
        ?rangeShape sh:property ?maxLeaf .
        ?maxLeaf sh:path ?maxPred .
        FILTER(isIRI(?propIri))
      }
    }
    ORDER BY ?propIri
  `

  const result = await store.query(sparql)
  const properties: Range2DPropertyInfo[] = []

  for (const row of result.results.bindings) {
    const propIri = row['propIri']?.value
    const minPredicate = row['minPred']?.value
    const maxPredicate = row['maxPred']?.value
    if (!propIri || !minPredicate || !maxPredicate) continue

    const localName = extractLocalName(propIri)
    const domain = extractDomainFromRegistry(propIri, registry)

    if (localName && domain) {
      properties.push({ localName, domain, minPredicate, maxPredicate })
    }
  }

  return properties
}
