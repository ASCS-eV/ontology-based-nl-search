/**
 * Numeric property discovery — the leaves a range filter can compare.
 *
 * A property is numeric when a property shape constrains its values to a
 * numeric `sh:datatype` ([SHACL] §4.1.1), either directly or through an
 * `sh:or` ([SHACL] §4.6.3) whose datatype-bearing members are all numeric.
 * The disjunctive form is how an ontology says "a number, or a range node":
 * the literal alternative is what a range filter compares, and members that
 * constrain a node rather than a datatype are not literals, so they do not
 * decide. A disjunction mixing a numeric and a non-numeric datatype is not
 * numeric: a range filter would silently drop the non-numeric values.
 *
 * Properties with `sh:in` are enumerations, not ranges, in both forms.
 *
 * A range filter compares the literal form only: an asset that records a
 * disjunctive property through its node alternative (a range node with its
 * own bounds) is not matched by a range on the property itself.
 *
 * The disjunctive result does not depend on the order the store returns
 * rows in: a path is numeric when any of its `sh:or` shapes is, `float` wins
 * over `integer` across those shapes, and the name and description come
 * from the shape that sorts first by them.
 *
 * @see https://www.w3.org/TR/shacl/#DatatypeConstraintComponent — [SHACL] §4.1.1 sh:datatype
 * @see https://www.w3.org/TR/shacl/#OrConstraintComponent — [SHACL] §4.6.3 sh:or
 */
import { extractLocalName } from '@ontology-search/core/rdf/iri'
import { iri, sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import { isIri } from '@ontology-search/sparql/escape'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { SCHEMA_GRAPH } from './schema-loader.js'

/** A numeric property (xsd:integer or xsd:float) */
export interface NumericProperty {
  iri: string
  localName: string
  label: string
  description: string
  datatype: 'integer' | 'float'
  domain: string
}

/** The datatypes a range filter treats as numbers. */
const NUMERIC_DATATYPES: ReadonlySet<string> = new Set([iri('xsd', 'integer'), iri('xsd', 'float')])

const XSD_INTEGER = iri('xsd', 'integer')

interface NumericLeaf {
  iri: string
  datatype: NumericProperty['datatype']
  name?: string
  description?: string
}

/**
 * Every numeric property in the schema graph, one entry per owning domain.
 * `domainsByPropertyIri` is the compiler's attribution: a property no domain
 * can resolve is dropped, because the compiler could not filter it either.
 */
export async function extractNumericProperties(
  store: SparqlStore,
  domainsByPropertyIri: Map<string, Set<string>>
): Promise<NumericProperty[]> {
  const [direct, disjunctive] = await Promise.all([
    queryDirectNumericLeaves(store),
    queryDisjunctiveNumericLeaves(store),
  ])

  const seen = new Set<string>()
  const properties: NumericProperty[] = []
  for (const leaf of [...direct, ...disjunctive]) {
    if (seen.has(leaf.iri)) continue
    seen.add(leaf.iri)
    const localName = extractLocalName(leaf.iri)
    for (const domain of domainsByPropertyIri.get(leaf.iri) ?? []) {
      properties.push({
        iri: leaf.iri,
        localName,
        label: leaf.name ?? localName,
        description: leaf.description ?? '',
        datatype: leaf.datatype,
        domain,
      })
    }
  }
  return properties
}

/** Property shapes that declare a numeric `sh:datatype` themselves. */
async function queryDirectNumericLeaves(store: SparqlStore): Promise<NumericLeaf[]> {
  const sparql = `
    ${sparqlPrefixes('sh', 'xsd')}

    SELECT ?path ?name ?description ?datatype
    FROM <${SCHEMA_GRAPH}>
    WHERE {
      ?shape sh:property ?propShape .
      ?propShape sh:path ?path .
      FILTER(isIRI(?path))
      ?propShape sh:datatype ?datatype .
      OPTIONAL { ?propShape sh:name ?name }
      OPTIONAL { ?propShape sh:description ?description }
      FILTER(?datatype IN (xsd:integer, xsd:float))
      FILTER NOT EXISTS { ?propShape sh:in ?list }
    }
  `
  const results = await store.query(sparql)
  const leaves: NumericLeaf[] = []
  for (const row of results.results.bindings) {
    const path = row['path']?.value
    if (!path) continue
    const name = row['name']?.value
    const description = row['description']?.value
    leaves.push({
      iri: path,
      datatype: row['datatype']?.value === XSD_INTEGER ? 'integer' : 'float',
      ...(name ? { name } : {}),
      ...(description ? { description } : {}),
    })
  }
  return leaves
}

/**
 * Property shapes whose `sh:or` members constrain only numeric datatypes.
 *
 * Two queries: the member walk is a property path, and Oxigraph WASM has
 * crashed on property paths combined with OPTIONAL or UNION (see
 * `property-paths-queries.ts`), so the names and descriptions are read in a
 * second, path-free query keyed by the properties the first one found.
 */
async function queryDisjunctiveNumericLeaves(store: SparqlStore): Promise<NumericLeaf[]> {
  const membersSparql = `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT ?propShape ?path ?datatype
    FROM <${SCHEMA_GRAPH}>
    WHERE {
      ?shape sh:property ?propShape .
      ?propShape sh:path ?path .
      FILTER(isIRI(?path))
      FILTER NOT EXISTS { ?propShape sh:in ?list }
      ?propShape sh:or ?members .
      ?members rdf:rest*/rdf:first ?member .
      ?member sh:datatype ?datatype .
    }
  `
  const members = await store.query(membersSparql)

  // Group member datatypes by property shape: numeric only if every one is.
  const byShape = new Map<string, { path: string; datatypes: Set<string> }>()
  for (const row of members.results.bindings) {
    const shape = row['propShape']?.value
    const path = row['path']?.value
    const datatype = row['datatype']?.value
    if (!shape || !path || !datatype) continue
    const entry = byShape.get(shape) ?? { path, datatypes: new Set<string>() }
    entry.datatypes.add(datatype)
    byShape.set(shape, entry)
  }
  const numericByPath = new Map<string, NumericProperty['datatype']>()
  for (const { path, datatypes } of byShape.values()) {
    if (![...datatypes].every((d) => NUMERIC_DATATYPES.has(d))) continue
    const datatype = [...datatypes].every((d) => d === XSD_INTEGER) ? 'integer' : 'float'
    if (numericByPath.get(path) !== 'float') numericByPath.set(path, datatype)
  }
  if (numericByPath.size === 0) return []

  // Schema IRIs, but they are interpolated into VALUES, so hold them to the
  // same IRI check as any other interpolated IRI (CONTRIBUTING #25).
  const annotations = await queryDisjunctiveAnnotations(
    store,
    [...numericByPath.keys()].filter(isIri)
  )
  return [...numericByPath]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, datatype]) => ({ iri: path, datatype, ...annotations.get(path) }))
}

interface Annotation {
  name?: string
  description?: string
}

/** Named before unnamed, then by name, then by description. */
function compareAnnotations(a: Annotation, b: Annotation): number {
  if ((a.name === undefined) !== (b.name === undefined)) return a.name === undefined ? 1 : -1
  return (
    (a.name ?? '').localeCompare(b.name ?? '') ||
    (a.description ?? '').localeCompare(b.description ?? '')
  )
}

/** `sh:name` / `sh:description` of the `sh:or` property shapes for `paths`. */
async function queryDisjunctiveAnnotations(
  store: SparqlStore,
  paths: string[]
): Promise<Map<string, Annotation>> {
  if (paths.length === 0) return new Map()
  const sparql = `
    ${sparqlPrefixes('sh')}

    SELECT ?path ?name ?description
    FROM <${SCHEMA_GRAPH}>
    WHERE {
      VALUES ?path { ${paths.map((p) => `<${p}>`).join(' ')} }
      ?propShape sh:path ?path .
      ?propShape sh:or ?anyOr .
      OPTIONAL { ?propShape sh:name ?name }
      OPTIONAL { ?propShape sh:description ?description }
    }
  `
  const results = await store.query(sparql)
  // Several shapes can annotate one path; keep the one that sorts first by
  // (name, description), with an unnamed shape last, whatever the row order.
  const out = new Map<string, Annotation>()
  for (const row of results.results.bindings) {
    const path = row['path']?.value
    if (!path) continue
    const name = row['name']?.value
    const description = row['description']?.value
    const candidate = { ...(name ? { name } : {}), ...(description ? { description } : {}) }
    const current = out.get(path)
    if (!current || compareAnnotations(candidate, current) < 0) out.set(path, candidate)
  }
  return out
}
