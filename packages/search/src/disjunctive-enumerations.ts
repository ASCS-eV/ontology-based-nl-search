/**
 * Closed value lists declared through `sh:or`.
 *
 * A property shape can enumerate its values without a top-level `sh:in`: an
 * `sh:or` ([SHACL] §4.6.3) whose every member is an `sh:in` ([SHACL] §4.8.3)
 * accepts exactly the values of the members' lists, so their union is the
 * property's vocabulary. Generated shapes write an enumeration this way when
 * the values come from several enumerations. An `sh:or` with a member that
 * admits other values (a datatype, a node kind, a sub-shape) is not a closed
 * list and declares none. Every constraint of a shape applies ([SHACL]
 * §2.1.1), so a shape that also lists values at the top level accepts only
 * the values both lists hold.
 *
 * Read from the schema graph alone; no property or vocabulary is named.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { SCHEMA_GRAPH } from './schema-loader.js'

/** One property shape whose `sh:or` members all enumerate. */
export interface DisjunctiveEnumeration {
  propertyIri: string
  /** Target classes of the node shapes declaring the property shape, sorted. */
  owningClasses: string[]
  /** The values the shape accepts, in the order the query returns them. */
  values: string[]
  name?: string
  description?: string
}

/**
 * Graph pattern binding `?propShape` to the property shapes whose `sh:or`
 * has a member that is not an `sh:in` list (an open union).
 *
 * Meant for a `MINUS`, which evaluates it once for the whole query. Inside a
 * `FILTER NOT EXISTS` it would run its list walk again for every row, and a
 * closed union has a row per value: on the pinned ontology that is minutes
 * against a tenth of a second.
 */
export const OPEN_UNION_PATTERN = `
        ?propShape sh:or ?_openMembers .
        ?_openMembers rdf:rest*/rdf:first ?_openMember .
        FILTER NOT EXISTS { ?_openMember sh:in ?_openList }`

/**
 * Graph pattern binding `?propShape` to the property shapes whose `sh:or`
 * members are all `sh:in` lists. A query that reads top-level `sh:in` lists
 * subtracts it with `MINUS`, so the values of such a shape come from
 * {@link queryDisjunctiveEnumerations} alone.
 */
export const CLOSED_UNION_PATTERN = `
        ?propShape sh:or ?_members .
        MINUS { ${OPEN_UNION_PATTERN} }`

/**
 * Every property shape of the schema graph whose `sh:or` members are all
 * `sh:in` lists, with the values it accepts: the union of the members' lists,
 * narrowed to a top-level `sh:in` list when the shape has one.
 *
 * One query, grouped by the property shape itself, so a property shape on a
 * blank node shape counts like one on a named shape.
 */
export async function queryDisjunctiveEnumerations(
  store: SparqlStore
): Promise<DisjunctiveEnumeration[]> {
  const result = await store.query(`
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT ?propShape ?owningClass ?propertyIri ?value ?name ?description
    FROM <${SCHEMA_GRAPH}>
    WHERE {
      ?shape sh:property ?propShape .
      ?propShape sh:path ?propertyIri .
      FILTER(isIRI(?propertyIri))
      ?propShape sh:or ?members .
      ?members rdf:rest*/rdf:first ?member .
      ?member sh:in ?list .
      ?list rdf:rest*/rdf:first ?value .
      MINUS { ${OPEN_UNION_PATTERN} }
      # A top-level list on the same shape applies too: a value it does not
      # hold is dropped. Checked per row, but only rows of a shape with such a
      # list reach the walk.
      FILTER NOT EXISTS {
        ?propShape sh:in ?ownList .
        FILTER NOT EXISTS { ?ownList rdf:rest*/rdf:first ?value }
      }
      OPTIONAL { ?shape sh:targetClass ?owningClass }
      OPTIONAL { ?propShape sh:name ?name }
      OPTIONAL { ?propShape sh:description ?description }
    }
    ORDER BY ?propertyIri ?owningClass ?value
  `)

  const byShape = new Map<string, DisjunctiveEnumeration & { classes: Set<string> }>()
  for (const row of result.results.bindings) {
    const propShape = row['propShape']?.value
    const propertyIri = row['propertyIri']?.value
    const value = row['value']?.value
    if (!propShape || !propertyIri || value === undefined) continue
    let entry = byShape.get(propShape)
    if (!entry) {
      entry = { propertyIri, owningClasses: [], values: [], classes: new Set() }
      const name = row['name']?.value
      const description = row['description']?.value
      if (name) entry.name = name
      if (description) entry.description = description
      byShape.set(propShape, entry)
    }
    const owningClass = row['owningClass']?.value
    if (owningClass) entry.classes.add(owningClass)
    if (!entry.values.includes(value)) entry.values.push(value)
  }
  return [...byShape.values()].map(({ classes, ...entry }) => ({
    ...entry,
    owningClasses: [...classes].sort(),
  }))
}
