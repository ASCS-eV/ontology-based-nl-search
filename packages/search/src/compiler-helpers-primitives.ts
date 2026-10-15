/**
 * Compiler emit primitives — the leaf helpers the other emit modules depend on
 * (ADR 0003 step 22d). IRI/prefix resolution, the FILTER-clause emitters, and
 * small string utilities. No sibling imports — this is the DAG sink.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
import { escapeRdfLiteral } from '@ontology-search/core/rdf/literal'
import { iri } from '@ontology-search/core/rdf/prefixes'
import {
  type DomainDescriptor,
  type DomainRegistry,
} from '@ontology-search/ontology/domain-registry'
import { isIri } from '@ontology-search/sparql/escape'

/**
 * Compress a full predicate IRI to a `prefix:localName` form when the
 * predicate lives in the given domain's namespace. Falls back to an
 * angle-bracketed full IRI so cross-namespace predicates (those in another
 * domain's namespace) still parse.
 *
 * Used by the path-driven emission to keep the wire output stable as
 * `prefix:localName` strings.
 */
export function prefixedPredicate(predicateIri: string, domain: DomainDescriptor): string {
  if (predicateIri.startsWith(domain.namespace)) {
    return `${domain.prefix}:${predicateIri.slice(domain.namespace.length)}`
  }
  return `<${predicateIri}>`
}

/**
 * Find the DomainDescriptor whose namespace matches a predicate IRI.
 * Used to resolve cross-domain predicates (a predicate IRI whose namespace
 * differs from the primary domain's) to their prefix for SPARQL emission.
 */
export function findDomainForIri(
  iri: string,
  registry: DomainRegistry
): DomainDescriptor | undefined {
  let bestDesc: DomainDescriptor | undefined
  let bestLen = 0
  for (const desc of registry.domains.values()) {
    if (iri.startsWith(desc.namespace) && desc.namespace.length > bestLen) {
      bestDesc = desc
      bestLen = desc.namespace.length
    }
  }
  return bestDesc
}

/**
 * Convert a SHACL shape-group localName into the SPARQL variable name that
 * holds the linked DomainSpecification sub-resource. The convention is
 * lower-camelCase of the localName: `Content → content`, `DataSource →
 * dataSource`, `Quantity → quantity`. Both `?fmt` (old `?fmt` for Format)
 * and `?ds` (old `?ds` for DataSource) used hand-picked abbreviations the
 * are intentionally unabbreviated; the unified rule reads as well or better and
 * works for any future group.
 */
export function groupVariableName(group: string): string {
  if (group.length === 0) return 'group'
  return group[0]!.toLowerCase() + group.slice(1)
}

/**
 * The `hasGroup` predicate linking the specification node to a shape's
 * sub-resource (e.g. group `Content` → predicate `hasContent`).
 *
 * Many SHACL conventions name the predicate `has<Group>`, so it is derivable
 * from the group localName — no hand-maintained map.
 */
export function groupPredicate(group: string): string {
  return `has${group}`
}

// `isIri` comes from `@ontology-search/sparql/escape`. The previous in-file
// prefix-only check (`^https?://|^urn:`) was both too narrow (it missed
// `did:web:` IRIs in the project's sample data) and too lax (it accepted any
// garbage after the scheme); the lifted version enforces the full SPARQL
// `IRIREF` body grammar. Literal escaping is the grammar-shared
// `escapeRdfLiteral` from `@ontology-search/core/rdf/literal`.

/**
 * A slot value carries information iff it's a non-empty string or a
 * non-empty array. Used by the compiler to decide whether to emit the
 * graph pattern + filter for a given slot — empty values must produce
 * no triple at all, never a dangling pattern or `IN ()` clause.
 */
export function isNonEmpty(value: string | string[] | undefined): value is string | string[] {
  if (value === undefined) return false
  if (typeof value === 'string') return value.length > 0
  return Array.isArray(value) && value.length > 0
}

/**
 * Emit a FILTER clause for a location field that may be a single string or
 * an array. Generic — used for every location-style literal slot.
 *
 *  - **Array**: `FILTER(?v IN ("DE","FR","IT"))` — exact equality over a set,
 *    so a region expressed as a list of codes filters precisely.
 *  - **Single string**: `FILTER(CONTAINS(STR(?v), "FR"))` — textual matching
 *    over the string form of the RDF term, so the same filter works for both
 *    literal values and IRI-valued location resources.
 */
export function addLocationFilter(
  filters: string[],
  varName: string,
  value: string | string[]
): void {
  // W3C SPARQL 1.1 §17.4.2: LCASE() requires a string argument.
  // STR() converts IRIs and typed literals to their lexical string form,
  // making this safe for both IRI-valued and literal-valued properties.
  if (Array.isArray(value)) {
    if (value.length === 1) {
      const v = escapeRdfLiteral(value[0]!.toLowerCase())
      filters.push(`FILTER(LCASE(STR(${varName})) = "${v}")`)
    } else {
      const lits = value.map((v) => `"${escapeRdfLiteral(v.toLowerCase())}"`).join(', ')
      filters.push(`FILTER(LCASE(STR(${varName})) IN (${lits}))`)
    }
  } else {
    const v = escapeRdfLiteral(value.toLowerCase())
    filters.push(`FILTER(CONTAINS(LCASE(STR(${varName})), "${v}"))`)
  }
}

/**
 * SPARQL property path that walks reflexive-transitively up SKOS and RDFS
 * hierarchies. Used to expand an IRI-valued filter to include all narrower
 * concepts / subclasses generically — the hierarchies must be declared in
 * the loaded graphs; this code does not name any specific concept scheme.
 *
 *   - `skos:broaderTransitive*` — covers SKOS concept narrower-than chains
 *   - `rdfs:subClassOf*`        — covers OWL/RDFS class subClassOf chains
 *
 * Both predicates are W3C-standard and reflexive in their `*` form, so the
 * expanded set always includes the filter value itself.
 *
 * @see https://www.w3.org/TR/skos-reference/#semantic-relations
 * @see https://www.w3.org/TR/rdf-schema/#ch_subclassof
 */
const HIERARCHY_EXPANSION_PATH = `(<${iri('skos', 'broaderTransitive')}>|<${iri('rdfs', 'subClassOf')}>)*`

/**
 * Lexical forms of the two `xsd:boolean` values — each value has two
 * representations ([RDF11] §5 Datatypes: `"true"`/`"1"` and `"false"`/`"0"`).
 */
const BOOLEAN_LEXICAL_FORMS: ReadonlyMap<string, readonly string[]> = new Map([
  ['true', ['true', '1']],
  ['false', ['false', '0']],
])
const BOOLEAN_CANONICAL: ReadonlyMap<string, 'true' | 'false'> = new Map([
  ['true', 'true'],
  ['1', 'true'],
  ['false', 'false'],
  ['0', 'false'],
])

const XSD_BOOLEAN = iri('xsd', 'boolean')

/**
 * Add a FILTER (or graph pattern) for an enum value.
 *
 * - **Literal value(s)**: emits the existing `FILTER(?v = "lit")` form.
 *   When the leaf's SHACL datatype is `xsd:boolean` and every value is a
 *   boolean lexical form, the comparison is on the lexical form instead
 *   (`STR(?v) IN ("true", "1")`) — see the comment below.
 * - **IRI value(s)**: emits a reflexive-transitive SPARQL property path,
 *   so the filter matches any concept narrower than the IRI in any
 *   `skos:broaderTransitive` or `rdfs:subClassOf` chain loaded into the
 *   store. This is the generic IRI-expansion gate: no specific hierarchy
 *   is hardcoded; the engine walks whatever is declared.
 *
 *   Example: with `<.../region/europe>` declared as the broader concept of
 *   {`<.../country/DE>`, `<.../country/FR>`, …}, a filter for `europe`
 *   expands to the full country set automatically.
 *
 *   When no hierarchy edges are present in the data, the path matches only
 *   the IRI itself (reflexive case) — same semantics as plain equality.
 *
 * @param datatype `sh:datatype` the leaf's shape declares ([SHACL] §4.1.2),
 *   when known. The comparison follows the declared datatype, never the
 *   shape of the filter value: a string property that happens to hold
 *   "True" keeps plain equality.
 */
export function addEnumFilter(
  patterns: string[],
  filters: string[],
  varName: string,
  value: string | string[],
  datatype?: string
): void {
  const arr = Array.isArray(value) ? value : [value]
  const iriValues = arr.filter(isIri)
  const literalValues = arr.filter((v) => !isIri(v))

  // A boolean leaf stores `"true"^^xsd:boolean`, which is never RDF-term-equal
  // to the simple literal `"true"` ([SPARQL11] §17.4.1.7 — `=` on literals of
  // different datatypes is a type error, so the FILTER drops every row), and
  // so is `IN`, which is defined through `=` ([SPARQL11] §17.4.1.9). The two
  // lexical forms of each boolean value ([RDF11] §5) are compared through
  // STR() instead, which matches typed and plain-string storage alike.
  const booleans = literalValues.map((v) => BOOLEAN_CANONICAL.get(v.trim().toLowerCase()))
  if (
    datatype === XSD_BOOLEAN &&
    literalValues.length > 0 &&
    booleans.every((b) => b !== undefined)
  ) {
    const lexical = [...new Set(booleans.flatMap((b) => BOOLEAN_LEXICAL_FORMS.get(b!)!))].map(
      (form) => `"${form}"`
    )
    filters.push(`FILTER(STR(${varName}) IN (${lexical.join(', ')}))`)
  } else if (literalValues.length === 1) {
    filters.push(`FILTER(${varName} = "${escapeRdfLiteral(literalValues[0]!)}")`)
  } else if (literalValues.length > 1) {
    const values = literalValues.map((v) => `"${escapeRdfLiteral(v)}"`).join(', ')
    filters.push(`FILTER(${varName} IN (${values}))`)
  }

  for (const iri of iriValues) {
    // The hierarchy walk is emitted as an additional graph pattern, not a
    // FILTER, so the property path is evaluated by the SPARQL engine against
    // every loaded named graph (schema, codelists, instances, …) generically.
    patterns.push(`${varName} ${HIERARCHY_EXPANSION_PATH} <${iri}> .`)
  }
}
