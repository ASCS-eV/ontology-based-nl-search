/**
 * Closed value lists declared through `sh:or`.
 *
 * A property shape can enumerate its values without a top-level `sh:in`: an
 * `sh:or` ([SHACL] §4.6.3) whose every member is an `sh:in` ([SHACL] §4.8.3)
 * accepts exactly the values of the members' lists, so their union is the
 * property's vocabulary. Generated shapes write an enumeration this way when
 * the values come from several enumerations. An `sh:or` with a member that
 * admits other values (a datatype, a node kind, a sub-shape) is not a closed
 * list and declares none.
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
  /** Target classes of the node shape declaring the property shape, sorted. */
  owningClasses: string[]
  /** The union of the members' lists, in the order the query returns them. */
  values: string[]
  name?: string
  description?: string
}

/**
 * Every property shape of the schema graph whose `sh:or` members are all
 * `sh:in` lists, with the union of their values.
 *
 * One query collects the members' values, another the property shapes with
 * a member that is not a list. A property shape is identified across the two
 * by its node shape and path ([SHACL] §2.3); one declared on an anonymous
 * node shape cannot be, and is left out.
 */
export async function queryDisjunctiveEnumerations(
  store: SparqlStore
): Promise<DisjunctiveEnumeration[]> {
  const [valueRows, openRows] = await Promise.all([
    store.query(`
      ${sparqlPrefixes('sh', 'rdf')}

      SELECT ?shape ?owningClass ?propertyIri ?value ?name ?description
      FROM <${SCHEMA_GRAPH}>
      WHERE {
        ?shape sh:property ?propShape .
        ?propShape sh:path ?propertyIri .
        FILTER(isIRI(?shape) && isIRI(?propertyIri))
        ?propShape sh:or ?members .
        ?members rdf:rest*/rdf:first ?member .
        ?member sh:in ?list .
        ?list rdf:rest*/rdf:first ?value .
        OPTIONAL { ?shape sh:targetClass ?owningClass }
        OPTIONAL { ?propShape sh:name ?name }
        OPTIONAL { ?propShape sh:description ?description }
      }
      ORDER BY ?propertyIri ?value
    `),
    store.query(`
      ${sparqlPrefixes('sh', 'rdf')}

      SELECT DISTINCT ?shape ?propertyIri
      FROM <${SCHEMA_GRAPH}>
      WHERE {
        ?shape sh:property ?propShape .
        ?propShape sh:path ?propertyIri .
        ?propShape sh:or ?members .
        ?members rdf:rest*/rdf:first ?member .
        FILTER NOT EXISTS { ?member sh:in ?anyList }
      }
    `),
  ])

  const open = new Set(
    openRows.results.bindings.map((row) => `${row['shape']?.value}|${row['propertyIri']?.value}`)
  )
  const byShape = new Map<string, DisjunctiveEnumeration & { classes: Set<string> }>()
  for (const row of valueRows.results.bindings) {
    const shape = row['shape']?.value
    const propertyIri = row['propertyIri']?.value
    const value = row['value']?.value
    if (!shape || !propertyIri || value === undefined) continue
    const key = `${shape}|${propertyIri}`
    if (open.has(key)) continue
    let entry = byShape.get(key)
    if (!entry) {
      entry = { propertyIri, owningClasses: [], values: [], classes: new Set() }
      const name = row['name']?.value
      const description = row['description']?.value
      if (name) entry.name = name
      if (description) entry.description = description
      byShape.set(key, entry)
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
