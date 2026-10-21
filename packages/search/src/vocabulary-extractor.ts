/**
 * Vocabulary Extractor — queries the store for the complete vocabulary.
 *
 * Extracts filterable properties (sh:in enumerations), numeric properties,
 * SKOS concept schemes, RDFS class hierarchies, and per-property distinct
 * instance value distributions. All discovered generically — nothing about
 * any specific domain is encoded in code.
 *
 * @see https://www.w3.org/TR/shacl/#InConstraintComponent
 * @see https://www.w3.org/TR/skos-reference/
 */
import { extractLocalName } from '@ontology-search/core/rdf/iri'
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import type { PropertyShapeTarget } from '@ontology-search/ontology/shacl-validator'
import { isIri } from '@ontology-search/sparql/escape'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { getCompilerVocab } from './compiler.js'
import { allPropertyKeys, type KeyedPropertyPath } from './compiler-vocab.js'
import { extractNumericProperties, type NumericProperty } from './numeric-properties.js'
import { PROPERTY_KEY_SEPARATOR } from './property-keys.js'
import { SCHEMA_GRAPH } from './schema-loader.js'
import {
  queryInstanceValueDistribution,
  querySkosConcepts,
  querySubClassEdges,
  type SkosConceptInfo,
  type SubClassEdge,
} from './schema-queries.js'

export type { NumericProperty } from './numeric-properties.js'

/** A property shape a slot key names, with the domain whose chain reaches it. */
export interface KeyShapeTarget extends PropertyShapeTarget {
  domain: string
}

/** A property with enumerated allowed values (from sh:in) */
export interface EnumProperty {
  /** Full IRI of the property (e.g., "http://example.org/ontology/v1/propertyName") */
  iri: string
  /**
   * The slot key (ADR 0009): the leaf's local name, or a qualified key
   * (`dataRate__value`) when the domain reaches that leaf name through more
   * than one predicate chain.
   */
  localName: string
  /**
   * The leaf's local name, present when the key is qualified (it differs from
   * {@link localName}); the bare name is itself a key matching every chain of
   * that name.
   */
  leafName?: string
  /** The class whose node shape declares the leaf property shape, when known. */
  owningClass?: string
  /** Human-readable label from sh:name (e.g., "road types") */
  label: string
  /** Description from sh:description */
  description: string
  /**
   * Enumerated allowed values: the chain's own `sh:in`, or — when its
   * property shape declares none — the values the property's shapes declare
   * across the schema.
   */
  allowedValues: string[]
  /** Ontology domain (the SHACL domain name) */
  domain: string
}

/**
 * Schema-only ontology vocabulary — everything derivable without touching
 * instance data (asset triples in the default graph).
 *
 * SKOS concept schemes are included: schemes and their concept members are
 * declared vocabulary (schema-side), not asset data, even though the
 * discovery query is deliberately graph-agnostic (see `querySkosConcepts`).
 */
export interface SchemaVocabulary {
  /** Properties with sh:in enumerations (filterable) */
  enumProperties: EnumProperty[]
  /** Numeric properties (for range queries) */
  numericProperties: NumericProperty[]
  /** All domains found in the schema */
  domains: string[]
  /**
   * Every slot key the compiler can resolve — qualified keys and bare leaf
   * names alike (ADR 0009) — as key → owning domains.
   *
   * Deliberately broader than {@link enumProperties} + {@link numericProperties}:
   * those cover only properties carrying `sh:in` or a numeric `sh:datatype`, so
   * a plainly-typed leaf (`sh:datatype xsd:string` with no enumeration) is
   * absent from both while still being perfectly filterable. Consumers asking
   * "does this domain have this property?" must read this map — answering from
   * the enum/numeric lists alone reports a false negative for such leaves.
   */
  propertyDomains: ReadonlyMap<string, readonly string[]>
  /**
   * The property shapes ([SHACL] §2.3) a slot key names, for the keys that
   * resolving a leaf IRI's local name cannot identify (ADR 0009): a qualified
   * key's one chain, and every chain of a leaf name that has qualified keys
   * anywhere. Keys absent here are plain leaf names.
   */
  propertyShapeTargets?: ReadonlyMap<string, readonly KeyShapeTarget[]>
  /**
   * SKOS concepts grouped by scheme — discovered generically from
   * any loaded graph. Empty if no SKOS schemes are loaded.
   */
  conceptSchemes: Map<string, SkosConceptInfo[]>
  /**
   * rdfs:subClassOf edges, used by the compiler to expand class-typed
   * filter values to all subclasses generically.
   */
  classHierarchy: SubClassEdge[]
}

/** Cached singleton (schema-only — instance values are never cached here) */
let cachedSchemaVocabulary: SchemaVocabulary | null = null

/**
 * Extract the schema-only ontology vocabulary from the store.
 *
 * In parallel:
 *  - sh:in enumerations and numeric properties (from the schema graph),
 *  - SKOS concept schemes (declared vocabulary — generic),
 *  - rdfs:subClassOf edges (for compiler hierarchy expansion).
 *
 * Issues NO instance-data value scan: per-property literal distributions are
 * fetched lazily via `getInstanceValues` by the callers that need them.
 * This keeps warmup and the interpretation path data-independent, so gap
 * detection stays honest (schema properties with zero instances still
 * appear) and warmup does not grow with dataset size.
 *
 * No part of this code knows what any specific property means; every
 * discovery is a SPARQL query over standard RDF/SHACL/SKOS vocabulary.
 *
 * @see https://www.w3.org/TR/shacl/#InConstraintComponent — [SHACL] §4.8.3 sh:in
 * @see https://www.w3.org/TR/shacl/#DatatypeConstraintComponent — [SHACL] §4.1.2 sh:datatype
 */
export async function extractSchemaVocabulary(store: SparqlStore): Promise<SchemaVocabulary> {
  if (cachedSchemaVocabulary) return cachedSchemaVocabulary

  // Attribute every property to its owning domain(s) by SHACL shape membership —
  // the SAME discovered property paths the compiler resolves filters against
  // (`getCompilerVocab` is cached; the compiler builds it once at warmup). A
  // property is owned by the domain whose asset-class shape declares it,
  // regardless of the property's own IRI namespace. The previous
  // property-IRI-prefix heuristic orphaned shared-vocabulary leaves — e.g. a
  // `vcard:`/`dcterms:`/`schema:` property used inside a domain's shape resolved
  // to the empty domain and vanished from the editor, even though the compiler
  // could filter it. Deriving attribution from the compiler's path index
  // guarantees the editor exposes exactly the properties that compile, per
  // domain — no parallel heuristic to drift. A property reachable from several
  // domains is attributed to each (matching the compiler's multi-domain paths).
  //
  // Reads `allPropertyKeys` (asset paths UNION vocabulary-root paths), not
  // `paths` alone: some domains are reachable only as standalone vocabulary
  // roots, and attributing from `paths` would leave every one of their
  // properties without a domain, and the LLM without their values.
  //
  // Everything is per slot key (ADR 0009): one entry per (domain, key).
  const compilerVocab = await getCompilerVocab()
  const keyed = allPropertyKeys(compilerVocab).filter(({ path }) => path.domain)
  const domainsByPropertyIri = new Map<string, Set<string>>()
  // Key attribution for every resolvable property, enumerated or not. Two
  // domains may declare the same leaf name under different IRIs, and one may
  // enumerate it while the other only types it; both are filterable, so both
  // belong here. A leaf name counts too: it is a key for all of its chains.
  const domainsByKey = new Map<string, Set<string>>()
  const attribute = (key: string, domain: string) =>
    domainsByKey.set(key, (domainsByKey.get(key) ?? new Set<string>()).add(domain))
  for (const { key, path } of keyed) {
    const set = domainsByPropertyIri.get(path.propertyIri) ?? new Set<string>()
    set.add(path.domain)
    domainsByPropertyIri.set(path.propertyIri, set)
    attribute(key, path.domain)
    attribute(path.propertyName, path.domain)
  }
  const propertyDomains = new Map<string, readonly string[]>(
    [...domainsByKey].map(([key, domains]) => [key, [...domains].sort()])
  )
  const propertyShapeTargets = shapeTargetsByKey(keyed)

  const [enumByIri, numericByIri, skosConcepts, subClassEdges] = await Promise.all([
    extractEnumProperties(store),
    extractNumericProperties(store, domainsByPropertyIri),
    querySkosConcepts(store),
    querySubClassEdges(store),
  ])
  const enumProperties = enumPropertiesByKey(keyed, enumByIri)
  const numericProperties = numericPropertiesByKey(keyed, numericByIri)

  // Searchable domains are exactly those that own at least one discovered
  // property (the empty sentinel can no longer appear: unattributable
  // properties are dropped at extraction, not surfaced with a blank domain).
  const domains = [
    ...new Set([...enumProperties.map((p) => p.domain), ...numericProperties.map((p) => p.domain)]),
  ].filter((d) => d.length > 0)

  // Group SKOS concepts by scheme for O(1) lookup at compile time.
  const conceptSchemes = new Map<string, SkosConceptInfo[]>()
  for (const c of skosConcepts) {
    const existing = conceptSchemes.get(c.scheme) ?? []
    existing.push(c)
    conceptSchemes.set(c.scheme, existing)
  }

  cachedSchemaVocabulary = {
    enumProperties,
    numericProperties,
    domains,
    propertyDomains,
    propertyShapeTargets,
    conceptSchemes,
    classHierarchy: subClassEdges,
  }
  return cachedSchemaVocabulary
}

/**
 * Distinct literal values observed in the instance data, per property IRI —
 * lazy, on demand. This is the data source for data-driven gap suggestions;
 * it is intentionally NOT part of `extractSchemaVocabulary` so nothing on
 * the warmup/interpretation path pre-analyzes instance data.
 *
 * `propertyIris` restricts the scan; when omitted, the schema vocabulary's
 * known property IRIs (enum + numeric) are used — the same restriction the
 * old eager path applied. Invalid IRIs are filtered out first: SHACL property
 * path sequences (blank nodes) may surface as Skolemized hex strings that are
 * not valid in SPARQL. With an empty effective set this returns an empty map
 * and issues no query — never an unbounded literal scan.
 *
 * Results are not cached here: the store's LRU query cache already dedupes
 * repeated identical scans, and live data must stay live (constraint: data
 * gaps are found by querying, not by a stale pre-analysis).
 *
 * @see https://www.w3.org/TR/sparql11-query/#inline-data — [SPARQL11] §10.2 VALUES
 */
export async function getInstanceValues(
  store: SparqlStore,
  propertyIris?: string[]
): Promise<Map<string, string[]>> {
  let source = propertyIris
  if (!source) {
    const schema = await extractSchemaVocabulary(store)
    source = [
      ...schema.enumProperties.map((p) => p.iri),
      ...schema.numericProperties.map((p) => p.iri),
    ]
  }
  const validIris = source.filter(isIri)
  if (validIris.length === 0) return new Map()

  const distributions = await queryInstanceValueDistribution(store, validIris)
  const instanceValues = new Map<string, string[]>()
  for (const d of distributions) instanceValues.set(d.property, d.values)
  return instanceValues
}

/** Reset cached vocabulary (for testing) */
export function resetVocabulary(): void {
  cachedSchemaVocabulary = null
}

/**
 * The label of a slot key: the leaf's label, preceded by the predicate local
 * names that qualify it, so a qualified key reads (and is found) by the
 * context that tells it apart — `dataRate__value` → "dataRate value".
 */
export function keyLabel(key: string, leafName: string, leafLabel: string): string {
  if (key === leafName) return leafLabel
  const qualifiers = key.split(PROPERTY_KEY_SEPARATOR).slice(0, -1)
  return [...qualifiers, leafLabel].join(' ')
}

/**
 * Property-shape targets of the keys local-name resolution cannot identify:
 * each qualified key → its chain's leaf; each leaf name with a qualified key
 * somewhere → the leaf of every chain of that name, in every domain (it is a
 * key for all of them). Deduplicated, in key order.
 */
function shapeTargetsByKey(
  keyed: readonly KeyedPropertyPath[]
): Map<string, readonly KeyShapeTarget[]> {
  const qualifiedLeaves = new Set(
    keyed.filter(({ key, path }) => key !== path.propertyName).map(({ path }) => path.propertyName)
  )
  const targets = new Map<string, KeyShapeTarget[]>()
  const add = (key: string, path: KeyedPropertyPath['path']) => {
    const list = targets.get(key) ?? []
    // Every shape that declares the chain's leaf is a place the value may sit.
    const owners = path.owningClasses ?? [path.owningClass]
    for (const owner of owners) {
      const same = (t: KeyShapeTarget) =>
        t.domain === path.domain && t.iri === path.propertyIri && t.targetClass === owner
      if (list.some(same)) continue
      list.push({
        domain: path.domain,
        iri: path.propertyIri,
        ...(owner ? { targetClass: owner } : {}),
      })
    }
    targets.set(key, list)
  }
  for (const { key, path } of keyed) {
    if (key !== path.propertyName) add(key, path)
    if (qualifiedLeaves.has(path.propertyName)) add(path.propertyName, path)
  }
  return new Map([...targets].sort(([a], [b]) => a.localeCompare(b)))
}

/** One enumerated property per (domain, key): the chain's own values when it has them. */
function enumPropertiesByKey(
  keyed: readonly KeyedPropertyPath[],
  enumByIri: ReadonlyMap<string, EnumBase>
): EnumProperty[] {
  const out: EnumProperty[] = []
  for (const { key, path } of keyed) {
    const base = enumByIri.get(path.propertyIri)
    const allowedValues = path.allowedValues ?? base?.allowedValues
    if (!allowedValues || allowedValues.length === 0) continue
    out.push({
      iri: path.propertyIri,
      localName: key,
      ...(key !== path.propertyName ? { leafName: path.propertyName } : {}),
      ...(path.owningClass ? { owningClass: path.owningClass } : {}),
      label: keyLabel(key, path.propertyName, base?.label ?? path.propertyName),
      description: base?.description ?? '',
      allowedValues: [...allowedValues],
      domain: path.domain,
    })
  }
  return out
}

/** One numeric property per (domain, key) whose leaf is numeric in that domain. */
function numericPropertiesByKey(
  keyed: readonly KeyedPropertyPath[],
  numericByIri: readonly NumericProperty[]
): NumericProperty[] {
  const byIriAndDomain = new Map(numericByIri.map((p) => [`${p.domain} ${p.iri}`, p]))
  const out: NumericProperty[] = []
  for (const { key, path } of keyed) {
    const numeric = byIriAndDomain.get(`${path.domain} ${path.propertyIri}`)
    if (!numeric) continue
    out.push({
      ...numeric,
      localName: key,
      ...(key !== path.propertyName ? { leafName: path.propertyName } : {}),
      label: keyLabel(key, path.propertyName, numeric.label),
    })
  }
  return out
}

/** The `sh:in` view of one property IRI, merged across every shape declaring it. */
interface EnumBase {
  iri: string
  label: string
  description: string
  allowedValues: string[]
}

/**
 * Extract the sh:in enumerations of every property IRI from the schema graph,
 * merged across the property shapes that declare it.
 */
async function extractEnumProperties(store: SparqlStore): Promise<Map<string, EnumBase>> {
  const sparql = `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT ?path ?name ?description ?value
    FROM <${SCHEMA_GRAPH}>
    WHERE {
      ?shape sh:property ?propShape .
      ?propShape sh:path ?path .
      FILTER(isIRI(?path))
      ?propShape sh:in ?list .
      ?list rdf:rest*/rdf:first ?value .
      OPTIONAL { ?propShape sh:name ?name }
      OPTIONAL { ?propShape sh:description ?description }
    }
    ORDER BY ?path ?value
  `

  const results = await store.query(sparql)

  // Accumulate the sh:in values per property IRI; keys are attributed by
  // `enumPropertiesByKey`.
  const byIri = new Map<string, EnumBase>()

  for (const row of results.results.bindings) {
    const iri = row['path']?.value
    const value = row['value']?.value
    if (!iri || !value) continue

    let base = byIri.get(iri)
    if (!base) {
      base = {
        iri,
        label: row['name']?.value ?? extractLocalName(iri),
        description: row['description']?.value ?? '',
        allowedValues: [],
      }
      byIri.set(iri, base)
    }
    if (!base.allowedValues.includes(value)) base.allowedValues.push(value)
  }
  return byIri
}
