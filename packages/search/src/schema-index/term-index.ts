/**
 * Generic Term Index — one schema-only, ontology-agnostic index of
 * searchable terms (`TermCard[]`), the shared substrate for LLM schema
 * retrieval and the GraphQL autocomplete.
 *
 * Cards are COMPOSED from surfaces that already
 * exist — the compiler's discovered property paths (domain attribution +
 * leaf kinds), the schema-only vocabulary (sh:in enums, numerics), the
 * domain registry (target classes, IRI→domain resolution), and the JSON-LD
 * context lexicon (human-facing term names) — plus one generic label /
 * description / constraint harvest over the schema graph. No new
 * enum/numeric/path extraction logic, no hardcoded ontology identifiers.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL] §2.3 property shapes
 * @see https://www.w3.org/TR/rdf-schema/ — [RDF-SCHEMA] §5.4.1 rdfs:label
 * @see https://www.w3.org/TR/skos-reference/ — [SKOS] §5 lexical labels
 */
import { extractLocalName } from '@ontology-search/core/rdf/iri'
import { RDF_PREFIXES, sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import { buildDomainRegistry, type DomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { getCompilerVocab } from '../compiler.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'
import { extractSchemaVocabulary } from '../vocabulary-extractor.js'
import { readContextTerms } from './context-reader.js'

/** Value constraints harvested from the property shape ([SHACL] §4). */
export interface TermConstraints {
  pattern?: string
  min?: number
  max?: number
  minCount?: number
  maxCount?: number
}

/**
 * One searchable term. Identity is the **(iri, domain) pair** — a property
 * reachable from several domains legitimately yields one card per domain
 * (mirroring the compiler's multi-domain path attribution).
 */
export interface TermCard {
  kind: 'property' | 'class'
  iri: string
  localName: string
  domain: string
  /** Union of sh:name, rdfs:label, skos:prefLabel/altLabel, @context key, localName */
  labels: string[]
  /** sh:description / rdfs:comment */
  description?: string
  /** Absolute datatype IRI (xsd:*) for literal leaves, from SHACL or the @context */
  datatype?: string
  /** sh:in enumeration (closed enums only) */
  allowedValues?: string[]
  constraints?: TermConstraints
  /**
   * For object properties: the domain this property points at — the
   * dependency edge used for transitive retrieval expansion. Derived from
   * `sh:class` / `sh:node`(→`sh:targetClass`) or a class-typed leaf kind;
   * open `sh:nodeKind sh:IRI` leaves stay undefined (they can reference
   * any domain — the compiler constrains them at emission time).
   */
  referencesDomain?: string
}

/** Compact per-domain summary for cheap query routing. */
export interface DomainCard {
  domain: string
  /** Labels of the domain's asset target class */
  classLabels: string[]
  /** A few representative property terms (deterministic sample) */
  sampleTerms: string[]
  targetClassIri?: string
}

export interface TermIndex {
  cards: TermCard[]
  byDomain: Map<string, TermCard[]>
  domainCatalog: DomainCard[]
}

/** How many representative property terms a DomainCard carries. */
const DOMAIN_CARD_SAMPLE_TERMS = 8

/**
 * Single-flight cache keyed by store instance: concurrent first callers
 * share one in-flight build (same pattern as the compiler vocabulary —
 * see `compiler-vocab.ts` for the cold-start rationale), and tests with
 * fresh stores never see each other's index.
 */
let cachedIndexByStore = new WeakMap<SparqlStore, Promise<TermIndex>>()

/** Build (or return the cached) term index for the given store. */
export function buildTermIndex(store: SparqlStore): Promise<TermIndex> {
  const cached = cachedIndexByStore.get(store)
  if (cached) return cached
  const build = buildIndex(store)
  cachedIndexByStore.set(store, build)
  return build
}

/** Reset the cached index (for testing). */
export function resetTermIndex(): void {
  cachedIndexByStore = new WeakMap()
}

async function buildIndex(store: SparqlStore): Promise<TermIndex> {
  const [vocab, compilerVocab, registry, annotations] = await Promise.all([
    extractSchemaVocabulary(store),
    getCompilerVocab(),
    buildDomainRegistry(),
    harvestAnnotations(store),
  ])
  // Context terms are enrichment (soft dep on the context reader): a missing
  // or malformed context file already degrades to an empty lexicon there.
  // Per IRI we keep the human-facing names plus the first xsd datatype
  // coercion ('@id' marks an object reference, not a literal datatype).
  const contextByIri = new Map<string, { names: string[]; datatype?: string }>()
  for (const t of readContextTerms()) {
    const entry = contextByIri.get(t.iri) ?? { names: [] }
    if (!entry.names.includes(t.term)) entry.names.push(t.term)
    if (t.datatype && t.datatype !== '@id') entry.datatype ??= t.datatype
    contextByIri.set(t.iri, entry)
  }

  const enumByIri = indexBy(vocab.enumProperties, (p) => p.iri)
  const numericByIri = indexBy(vocab.numericProperties, (p) => p.iri)

  const cards: TermCard[] = []

  // ── Property cards: one per compiler path, i.e. per (domain, leaf) ──────
  // The compiler's path index is the property universe: exactly the terms
  // that can compile into SPARQL, with the same multi-domain attribution
  // the editor and validator already use. No parallel heuristic to drift.
  for (const path of compilerVocab.paths.values()) {
    if (!path.domain) continue
    const iri = path.propertyIri
    const localName = path.propertyName
    const annotation = annotations.get(iri)
    const enumProp = enumByIri.get(iri)
    const numericProp = numericByIri.get(iri)
    const context = contextByIri.get(iri)

    const datatype = numericProp
      ? `${RDF_PREFIXES.xsd}${numericProp.datatype}`
      : (annotation?.datatype ?? context?.datatype)

    cards.push({
      kind: 'property',
      iri,
      localName,
      domain: path.domain,
      labels: mergeLabels(
        enumProp?.label,
        numericProp?.label,
        annotation?.labels,
        context?.names,
        localName
      ),
      ...(descriptionOf(annotation, enumProp?.description, numericProp?.description) ?? {}),
      ...(datatype ? { datatype } : {}),
      ...(enumProp ? { allowedValues: [...enumProp.allowedValues] } : {}),
      ...(annotation?.constraints ? { constraints: annotation.constraints } : {}),
      ...(referencedDomain(path.leafKind, annotation?.referencedClass, registry) ?? {}),
    })
  }

  // ── Class cards: the per-domain asset target classes ([SHACL] §2.1.3.1) ─
  for (const descriptor of registry.domains.values()) {
    const iri = descriptor.targetClassIri
    if (!iri) continue
    const annotation = annotations.get(iri)
    const localName = extractLocalName(iri)
    cards.push({
      kind: 'class',
      iri,
      localName,
      domain: descriptor.name,
      labels: mergeLabels(descriptor.name, annotation?.labels, localName),
      ...(descriptionOf(annotation) ?? {}),
    })
  }

  // Deterministic order — stable across builds for snapshots and ranking ties.
  cards.sort((a, b) =>
    a.domain === b.domain
      ? a.kind === b.kind
        ? a.iri.localeCompare(b.iri)
        : a.kind.localeCompare(b.kind)
      : a.domain.localeCompare(b.domain)
  )

  const byDomain = new Map<string, TermCard[]>()
  for (const card of cards) {
    const list = byDomain.get(card.domain) ?? []
    list.push(card)
    byDomain.set(card.domain, list)
  }

  const domainCatalog = [...byDomain.entries()].map(([domain, domainCards]): DomainCard => {
    const classCard = domainCards.find((c) => c.kind === 'class')
    const sampleTerms = domainCards
      .filter((c) => c.kind === 'property')
      .slice(0, DOMAIN_CARD_SAMPLE_TERMS)
      .map((c) => c.localName)
    return {
      domain,
      classLabels: classCard?.labels ?? [domain],
      sampleTerms,
      ...(classCard ? { targetClassIri: classCard.iri } : {}),
    }
  })

  return { cards, byDomain, domainCatalog }
}

// ─── Generic annotation harvest over the schema graph ───────────────────────

interface TermAnnotation {
  labels: string[]
  description?: string
  datatype?: string
  constraints?: TermConstraints
  /** sh:class target, or the sh:node shape's sh:targetClass */
  referencedClass?: string
}

/**
 * One pass over the schema graph collecting, per IRI: lexical labels
 * (sh:name on its property shapes, rdfs:label, skos:prefLabel/altLabel —
 * never assuming one labeling predicate), descriptions (sh:description,
 * rdfs:comment), leaf datatypes, value constraints, and reference targets.
 *
 * [SHACL] §2.3.2 non-validating characteristics (sh:name/sh:description),
 * §4.1.1 sh:datatype, §4.4 sh:pattern / value-range components;
 * [RDF-SCHEMA] §5.4 annotations; [SKOS] §5 lexical labels.
 */
async function harvestAnnotations(store: SparqlStore): Promise<Map<string, TermAnnotation>> {
  const sparql = `
    ${sparqlPrefixes('sh', 'rdfs', 'skos')}

    SELECT ?iri ?shName ?rdfsLabel ?prefLabel ?altLabel ?shDescription ?rdfsComment
           ?datatype ?pattern ?minInc ?maxInc ?minCount ?maxCount ?refClass ?nodeClass
    FROM <${SCHEMA_GRAPH}>
    WHERE {
      {
        ?shape sh:property ?ps .
        ?ps sh:path ?iri .
        FILTER(isIRI(?iri))
        OPTIONAL { ?ps sh:name ?shName }
        OPTIONAL { ?ps sh:description ?shDescription }
        OPTIONAL { ?ps sh:datatype ?datatype }
        OPTIONAL { ?ps sh:pattern ?pattern }
        OPTIONAL { ?ps sh:minInclusive ?minInc }
        OPTIONAL { ?ps sh:maxInclusive ?maxInc }
        OPTIONAL { ?ps sh:minCount ?minCount }
        OPTIONAL { ?ps sh:maxCount ?maxCount }
        OPTIONAL { ?ps sh:class ?refClass }
        OPTIONAL { ?ps sh:node ?nodeShape . ?nodeShape sh:targetClass ?nodeClass }
      }
      UNION
      {
        ?iri rdfs:label ?rdfsLabel .
      }
      UNION
      {
        ?iri skos:prefLabel ?prefLabel .
      }
      UNION
      {
        ?iri skos:altLabel ?altLabel .
      }
      UNION
      {
        ?iri rdfs:comment ?rdfsComment .
      }
    }
  `

  const results = await store.query(sparql)
  const annotations = new Map<string, TermAnnotation>()

  for (const row of results.results.bindings) {
    const iri = row['iri']?.value
    if (!iri) continue
    const a = annotations.get(iri) ?? { labels: [] }

    for (const key of ['shName', 'rdfsLabel', 'prefLabel', 'altLabel'] as const) {
      const label = row[key]?.value
      if (label && !a.labels.includes(label)) a.labels.push(label)
    }
    a.description ??= row['shDescription']?.value ?? row['rdfsComment']?.value
    a.datatype ??= row['datatype']?.value
    a.referencedClass ??= row['refClass']?.value ?? row['nodeClass']?.value

    const constraints: TermConstraints = { ...a.constraints }
    if (row['pattern']?.value !== undefined) constraints.pattern ??= row['pattern']?.value
    assignNumber(constraints, 'min', row['minInc']?.value)
    assignNumber(constraints, 'max', row['maxInc']?.value)
    assignNumber(constraints, 'minCount', row['minCount']?.value)
    assignNumber(constraints, 'maxCount', row['maxCount']?.value)
    if (Object.keys(constraints).length > 0) a.constraints = constraints

    annotations.set(iri, a)
  }

  return annotations
}

// ─── Small pure helpers ──────────────────────────────────────────────────────

function assignNumber(
  constraints: TermConstraints,
  key: 'min' | 'max' | 'minCount' | 'maxCount',
  raw: string | undefined
): void {
  if (raw === undefined || constraints[key] !== undefined) return
  const n = Number(raw)
  if (Number.isFinite(n)) constraints[key] = n
}

/** Ordered, deduplicated union of label sources (arrays flattened in place). */
function mergeLabels(...sources: (string | string[] | undefined)[]): string[] {
  const labels: string[] = []
  for (const source of sources) {
    for (const label of Array.isArray(source) ? source : [source]) {
      if (label && !labels.includes(label)) labels.push(label)
    }
  }
  return labels
}

function descriptionOf(
  annotation: TermAnnotation | undefined,
  ...fallbacks: (string | undefined)[]
): { description: string } | undefined {
  const description = annotation?.description ?? fallbacks.find((d) => d && d.length > 0)
  return description ? { description } : undefined
}

function referencedDomain(
  leafKind: string,
  referencedClass: string | undefined,
  registry: DomainRegistry
): { referencesDomain: string } | undefined {
  const classIri =
    referencedClass ?? (leafKind.startsWith('class:') ? leafKind.slice(6) : undefined)
  if (!classIri) return undefined
  const domain = registry.domainForIri(classIri)
  return domain ? { referencesDomain: domain } : undefined
}

function indexBy<T>(items: T[], key: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>()
  for (const item of items) if (!map.has(key(item))) map.set(key(item), item)
  return map
}
