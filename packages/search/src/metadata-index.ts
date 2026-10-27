/**
 * Metadata / shape-group facet index.
 *
 * Discovers facets generically from the `shapeGroupClasses` index that
 * `getCompilerVocab` already builds: any chain whose leaf is declared by a
 * class that inherits from a base class in another domain gets bucketed,
 * under its slot key, by the local name of that base class (`Content`,
 * `Format`, `Quality`, `DataSource`, …). Quality is one such facet; the indexer treats it
 * uniformly with the others so new ontologies with different facet
 * names work out of the box.
 *
 * Two views:
 *
 *   - `getAssetMetadata(iri)` — per-asset facet snapshot. For each
 *     literal-leaf property classified into a shape group, fetch the
 *     bound value(s) from the data graph and group the result by
 *     facet name. Cross-reference properties (`leafKind === 'iri' |
 *     'class:…'`) are out of scope here — lineage exploration covers
 *     them (task #19).
 *
 *   - `getDomainMetadataAggregate(domain, group)` — distribution stats
 *     for one facet across every instance of the domain. Reports
 *     `{ totalValues, distinctValues, samples, numericRange? }` per
 *     property so consumers can render histograms / ranges without
 *     post-processing.
 *
 * Ontology-agnostic: the facet names come from discovered SHACL
 * inheritance, not literal strings in code. The walker reads
 * `CompilerVocab.shapeGroupClasses` and `CompilerVocab.paths`, both of
 * which are populated from the live shapes graph.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 * @see https://www.w3.org/TR/rdf-schema/ — [RDFS]
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import { escapeRdfLiteral } from '@ontology-search/core/rdf/literal'
import { iri } from '@ontology-search/core/rdf/prefixes'
import { buildDomainRegistry, type DomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { getAssetDomains } from './asset-domains.js'
import { getCompilerVocab } from './compiler.js'
import type { CompilerVocab } from './compiler-vocab.js'
import { getInitializedStore } from './init.js'
import { keyOfIndexEntry } from './property-keys.js'
import type { PropertyPath } from './property-paths.js'

const log = createComponentLogger('metadata-index')

/** A literal-leaf chain a shape group covers, under the key that names it. */
export interface FacetEntry {
  group: string
  /** The chain's slot key (ADR 0009): its leaf name, or a qualified key. */
  key: string
  path: PropertyPath
}

/**
 * The literal-leaf chains of a domain that its shape groups cover, one entry
 * per key. A group classifies a class (by its `rdfs:subClassOf` superclass,
 * [RDFS] §3.4), and a property shape is identified by the node shape that
 * declares it and its path ([SHACL] §2.3), so a chain belongs to the group of
 * the class that declares its leaf, when that class is one of the domain's
 * own. Every route to a group class is listed under
 * its own key; a chain of the same leaf name on a class no group classifies
 * is not.
 *
 * @internal Exported for the shape-group facet tests.
 */
export function shapeGroupFacets(vocab: CompilerVocab, domain: string): FacetEntry[] {
  const facets: FacetEntry[] = []
  for (const [indexKey, path] of vocab.paths) {
    if (path.domain !== domain || path.leafKind !== 'literal') continue
    const group = groupOfChain(vocab, path)
    if (group) facets.push({ group, key: keyOfIndexEntry(indexKey), path })
  }
  return facets
}

/** The group of the domain's class that declares a chain's leaf, if any. */
function groupOfChain(vocab: CompilerVocab, path: PropertyPath): string | undefined {
  for (const owner of path.owningClasses ?? (path.owningClass ? [path.owningClass] : [])) {
    const declared = vocab.shapeGroupClasses.get(owner)
    if (declared?.domain === path.domain) return declared.group
  }
  return undefined
}

/** XSD numeric datatypes the aggregate view detects to report a min/max range. */
const XSD_NUMERIC = new Set(
  [
    'integer',
    'decimal',
    'float',
    'double',
    'long',
    'int',
    'short',
    'byte',
    'nonNegativeInteger',
    'positiveInteger',
  ].map((t) => iri('xsd', t))
)

/** Maximum distinct values surfaced in the `samples` field of aggregate stats. */
const SAMPLE_LIMIT = 12

export interface FacetValue {
  /** The chain's slot key (ADR 0009): its leaf local name (e.g. `precision`), or a qualified key. */
  property: string
  /** Bound literal values on this specific asset. */
  values: string[]
}

export interface AssetMetadata {
  asset: string
  /** Asset class IRI (e.g. `.../<domain>/<version>/<Class>`). */
  type: string
  /** Owning domain name. Empty when unresolved. */
  domain: string
  /** Facets keyed by discovered group name (`Quality`, `Content`, …). */
  groups: Record<string, FacetValue[]>
}

export interface PropertyStats {
  property: string
  /** Total `?asset ?property ?value` triples observed across the domain. */
  totalValues: number
  /** Distinct value count. */
  distinctValues: number
  /** Up to {@link SAMPLE_LIMIT} representative distinct values. */
  samples: string[]
  /** Min/max bounds when the property's values are XSD-numeric. */
  numericRange?: { min: number; max: number }
}

export interface DomainGroupAggregate {
  domain: string
  group: string
  /** Number of instances of the domain's asset class. */
  assetCount: number
  properties: PropertyStats[]
}

/**
 * Build a per-asset facet snapshot. Reads the cached compiler vocab so
 * the facet structure stays consistent with the SHACL the compiler
 * already understands — no parallel discovery, no drift.
 */
export async function getAssetMetadata(assetIri: string): Promise<AssetMetadata> {
  const end = log.time('per-asset')
  const [store, registry, vocab] = await Promise.all([
    getInitializedStore(),
    buildDomainRegistry(),
    getCompilerVocab(),
  ])
  const { type, domain } = await resolveAssetTypeAndDomain(store, registry, assetIri)
  const result: AssetMetadata = { asset: assetIri, type, domain, groups: {} }
  if (!isPlainIri(assetIri) || !type || !domain) {
    end()
    return result
  }

  // Every literal-leaf chain a group covers — IRI / class leaves are
  // cross-references, handled by the lineage explorer.
  const entries = shapeGroupFacets(vocab, domain).map(({ group, key, path }) => ({
    property: key,
    group,
    path,
  }))
  if (entries.length === 0) {
    end()
    return result
  }

  // One UNION query covers every property at once; each row carries
  // the property local name (bound via BIND) and the literal value.
  const sparql = buildAssetFacetQuery(assetIri, entries)
  const queryResult = await store.query(sparql)

  const byProperty = new Map<string, Set<string>>()
  for (const row of queryResult.results.bindings) {
    const propName = row['propName']?.value
    const value = row['value']?.value
    if (!propName || value === undefined) continue
    if (!byProperty.has(propName)) byProperty.set(propName, new Set())
    byProperty.get(propName)!.add(value)
  }

  for (const { property, group } of entries) {
    const values = byProperty.get(property)
    if (!values || values.size === 0) continue
    if (!result.groups[group]) result.groups[group] = []
    result.groups[group]!.push({ property, values: [...values] })
  }
  end()
  return result
}

/**
 * Build distribution stats for one facet across every instance of a
 * domain. Used by the UI's aggregate-view endpoint to render
 * histograms / range bars without further computation.
 */
export async function getDomainMetadataAggregate(
  domain: string,
  group: string
): Promise<DomainGroupAggregate> {
  const end = log.time('aggregate')
  const [store, registry, vocab, assetDomains] = await Promise.all([
    getInitializedStore(),
    buildDomainRegistry(),
    getCompilerVocab(),
    getAssetDomains(),
  ])

  if (!assetDomains.has(domain)) {
    end()
    return { domain, group, assetCount: 0, properties: [] }
  }
  const domainDesc = registry.domains.get(domain)
  if (!domainDesc) {
    end()
    return { domain, group, assetCount: 0, properties: [] }
  }

  // Properties in this domain that belong to the requested group.
  const properties = shapeGroupFacets(vocab, domain)
    .filter((facet) => facet.group === group)
    .map(({ key, path }) => ({ property: key, path }))

  const assetCount = await countAssetsOfClass(store, domainDesc.targetClassIri)
  const propertyStats: PropertyStats[] = []
  for (const { property, path } of properties) {
    propertyStats.push(await aggregateProperty(store, domainDesc.targetClassIri, property, path))
  }
  end()
  return { domain, group, assetCount, properties: propertyStats }
}

// ─── internals ───────────────────────────────────────────────────────────────

function buildAssetFacetQuery(
  assetIri: string,
  entries: { property: string; path: PropertyPath }[]
): string {
  const arms = entries.map(({ property, path }) => {
    const pathExpr = path.steps.map((s) => `<${s.predicate}>`).join('/')
    // Local names are tame ASCII in practice; escaping is defensive so a
    // future ontology with a quote, backslash or line break in a name cannot
    // produce a malformed BIND clause.
    return `{ <${assetIri}> ${pathExpr} ?value . BIND("${escapeRdfLiteral(property)}" AS ?propName) }`
  })
  return `
    SELECT ?propName ?value WHERE {
      ${arms.join(' UNION ')}
    }
  `
}

async function aggregateProperty(
  store: SparqlStore,
  targetClassIri: string,
  property: string,
  path: PropertyPath
): Promise<PropertyStats> {
  const pathExpr = path.steps.map((s) => `<${s.predicate}>`).join('/')
  // Distinct values + per-value count. ORDER + LIMIT for the samples
  // happens in JS after we know the count, so we get the most common
  // values rather than an arbitrary slice.
  const sparql = `
    SELECT ?value (COUNT(?asset) AS ?count) ?datatype WHERE {
      ?asset a <${targetClassIri}> .
      ?asset ${pathExpr} ?value .
      BIND(DATATYPE(?value) AS ?datatype)
    }
    GROUP BY ?value ?datatype
  `
  const rows = await store.query(sparql)
  let totalValues = 0
  const distincts: { value: string; count: number; datatype?: string }[] = []
  for (const row of rows.results.bindings) {
    const value = row['value']?.value
    const count = Number(row['count']?.value ?? '0')
    const datatype = row['datatype']?.value
    if (value === undefined) continue
    distincts.push({ value, count, datatype })
    totalValues += count
  }
  distincts.sort((a, b) => b.count - a.count)
  const samples = distincts.slice(0, SAMPLE_LIMIT).map((d) => d.value)

  // Numeric range — detect when ALL observed values share an XSD-numeric
  // datatype; mixing strings + numbers means the property is polymorphic
  // and a numeric min/max would be misleading.
  let numericRange: { min: number; max: number } | undefined
  if (distincts.length > 0 && distincts.every((d) => d.datatype && XSD_NUMERIC.has(d.datatype))) {
    const numbers = distincts.map((d) => Number(d.value)).filter((n) => Number.isFinite(n))
    if (numbers.length > 0) {
      numericRange = { min: Math.min(...numbers), max: Math.max(...numbers) }
    }
  }

  return { property, totalValues, distinctValues: distincts.length, samples, numericRange }
}

async function countAssetsOfClass(store: SparqlStore, classIri: string): Promise<number> {
  const sparql = `SELECT (COUNT(DISTINCT ?asset) AS ?n) WHERE { ?asset a <${classIri}> . FILTER(isIRI(?asset)) }`
  const result = await store.query(sparql)
  const row = result.results.bindings[0]
  return Number(row?.['n']?.value ?? '0')
}

async function resolveAssetTypeAndDomain(
  store: SparqlStore,
  registry: DomainRegistry,
  assetIri: string
): Promise<{ type: string; domain: string }> {
  if (!isPlainIri(assetIri)) return { type: '', domain: '' }
  const sparql = `SELECT ?type WHERE { <${assetIri}> a ?type }`
  const result = await store.query(sparql)
  for (const row of result.results.bindings) {
    const t = row['type']?.value
    if (!t) continue
    const dom = registry.domainForIri(t)
    if (dom) return { type: t, domain: dom }
  }
  // Fall back to the first type so the response carries SOME identity
  // even when the IRI sits outside the registered namespaces.
  const first = result.results.bindings[0]?.['type']?.value ?? ''
  return { type: first, domain: '' }
}

/**
 * Same guard the lineage walker uses: reject scheme-less identifiers
 * (skolemised hex strings from JSON-LD, blank nodes) before they reach
 * Oxigraph's IRI parser as `<…>` literals.
 */
function isPlainIri(value: string): boolean {
  if (!value || value.startsWith('_:')) return false
  if (/[<>\s]/.test(value)) return false
  return /^[A-Za-z][A-Za-z0-9+\-.]*:/.test(value)
}
