/**
 * Minimal SHACL fragment extractor — given selected target classes and/or
 * property IRIs, emit the smallest correct SHACL Turtle for each shape,
 * from the schema graph, never by concatenating whole `.shacl.ttl` files.
 * Fragment size stays proportional to what a query actually needs.
 *
 * `SparqlStore.query` is SELECT/ASK only — there is no CONSTRUCT surface —
 * so extraction runs targeted SELECTs ([SPARQL11] §10.2 VALUES, §9 property
 * paths for RDF lists) and serializes Turtle deterministically here. Nested
 * `sh:node` shapes are referenced, not inlined: the retrieval layer pulls
 * referenced domains' fragments via the term index's dependency edges.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL] §2 shapes, §4 constraints
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 * @see https://www.w3.org/TR/turtle/ — [TURTLE] §2 serialization
 */
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SparqlBinding, SparqlStore } from '@ontology-search/sparql/types'

import { SCHEMA_GRAPH } from '../schema-loader.js'
import type { TermCard } from './term-index.js'

/** One extracted per-shape SHACL fragment, serialized as valid Turtle. */
export interface ShaclFragment {
  shapeIri: string
  domain: string
  turtle: string
  /**
   * The sh:path IRIs of the property blocks this fragment carries — the
   * coverage record that lets budget enforcement degrade an overflowing
   * fragment's properties to distilled cards instead of dropping them.
   */
  propertyIris: string[]
}

/**
 * What to extract: shapes by their `sh:targetClass`, and/or property blocks
 * by their `sh:path` IRI (the identity `TermCard`s carry). Both given =
 * intersection (those shapes, those properties). Property-only selection
 * matches any shape declaring one of the paths. Empty selection yields [].
 */
export interface FragmentSelection {
  targetClasses?: string[]
  propertyIris?: string[]
}

/** Cap on sh:in values rendered per property in distilled mode. */
const DISTILLED_MAX_VALUES = 50

interface PropertyBlock {
  path: string
  facts: Map<string, string[]> // predicate (compacted) → object terms (serialized)
  inValues: string[] // serialized sh:in members, in list order
}

interface ShapeAccumulator {
  shapeIri: string
  targetClass: string
  properties: Map<string, PropertyBlock> // keyed by property-shape node id
}

/**
 * Extract minimal SHACL fragments for the selection. One SELECT pulls the
 * property-shape constraint rows, a second pulls `sh:in` list members in
 * order; serialization is deterministic (sorted shapes, sorted paths).
 */
export async function extractShaclFragments(
  store: SparqlStore,
  selection: FragmentSelection,
  options: { signal?: AbortSignal } = {}
): Promise<ShaclFragment[]> {
  const targetClasses = selection.targetClasses ?? []
  const propertyIris = selection.propertyIris ?? []
  if (targetClasses.length === 0 && propertyIris.length === 0) return []

  const classValues =
    targetClasses.length > 0
      ? `VALUES ?targetClass { ${targetClasses.map((c) => `<${c}>`).join(' ')} }`
      : ''
  const pathValues =
    propertyIris.length > 0 ? `VALUES ?path { ${propertyIris.map((p) => `<${p}>`).join(' ')} }` : ''

  const constraintRows = await store.query(
    `
    ${sparqlPrefixes('sh')}

    SELECT ?shape ?targetClass ?ps ?path ?constraint ?value
    FROM <${SCHEMA_GRAPH}>
    WHERE {
      ${classValues}
      ${pathValues}
      ?shape sh:targetClass ?targetClass ;
             sh:property ?ps .
      ?ps sh:path ?path .
      FILTER(isIRI(?path))
      ?ps ?constraint ?value .
      FILTER(?constraint != sh:in && ?constraint != sh:property)
      FILTER(!isBlank(?value))
    }
  `,
    { signal: options.signal }
  )

  const inRows = await store.query(
    `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT ?shape ?targetClass ?ps ?path ?value
    FROM <${SCHEMA_GRAPH}>
    WHERE {
      ${classValues}
      ${pathValues}
      ?shape sh:targetClass ?targetClass ;
             sh:property ?ps .
      ?ps sh:path ?path .
      FILTER(isIRI(?path))
      ?ps sh:in ?list .
      ?list rdf:rest*/rdf:first ?value .
    }
    ORDER BY ?ps ?value
  `,
    { signal: options.signal }
  )

  const registry = await buildDomainRegistry()
  const namespaces = collectNamespaces(registry.allPrefixes())

  // ── Accumulate rows into per-shape structures ──────────────────────────
  const shapes = new Map<string, ShapeAccumulator>()
  for (const row of constraintRows.results.bindings) {
    // Anonymous (blank-node) root shapes have no referencable IRI to emit —
    // in-tree shapes with sh:targetClass are IRIs; skip the rest defensively.
    if (row['shape']?.type !== 'uri') continue
    const shape = row['shape'].value
    const targetClass = row['targetClass']?.value
    const ps = row['ps']?.value
    const path = row['path']?.value
    const constraint = row['constraint']?.value
    if (!shape || !targetClass || !ps || !path || !constraint || !row['value']) continue

    const acc = getOrCreate(shapes, shape, () => ({
      shapeIri: shape,
      targetClass,
      properties: new Map(),
    }))
    const block = getOrCreate(acc.properties, ps, () => ({
      path,
      facts: new Map(),
      inValues: [],
    }))
    const predicate = compact(constraint, namespaces)
    const objects = block.facts.get(predicate) ?? []
    const term = serializeTerm(row['value'], namespaces)
    if (!objects.includes(term)) objects.push(term)
    block.facts.set(predicate, objects)
  }

  for (const row of inRows.results.bindings) {
    const shape = row['shape']?.value
    const ps = row['ps']?.value
    if (!shape || !ps || !row['value']) continue
    const block = shapes.get(shape)?.properties.get(ps)
    if (!block) continue
    const term = serializeTerm(row['value'], namespaces)
    if (!block.inValues.includes(term)) block.inValues.push(term)
  }

  // ── Serialize deterministically ────────────────────────────────────────
  const fragments: ShaclFragment[] = []
  for (const acc of [...shapes.values()].sort((a, b) => a.shapeIri.localeCompare(b.shapeIri))) {
    const domain =
      registry.domainForIri(acc.shapeIri) ?? registry.domainForIri(acc.targetClass) ?? ''
    fragments.push({
      shapeIri: acc.shapeIri,
      domain,
      turtle: serializeShape(acc, namespaces, registry.allPrefixes()),
      propertyIris: [...new Set([...acc.properties.values()].map((b) => b.path))].sort(),
    })
  }
  return fragments
}

/**
 * Token-cheap alternative to raw Turtle: one dense line per card, e.g.
 * `speedLimit : integer — "Maximum permitted speed" [30|50|100|130]` or
 * `hasManifest → manifest`. Deterministic; sh:in lists cap at
 * {@link DISTILLED_MAX_VALUES} with an explicit remainder marker so
 * truncation is never silent.
 */
export function renderDistilledCards(cards: TermCard[]): string {
  return [...cards]
    .sort((a, b) =>
      a.domain === b.domain ? a.iri.localeCompare(b.iri) : a.domain.localeCompare(b.domain)
    )
    .map((card) => {
      const parts: string[] = [card.localName]
      if (card.datatype) parts.push(`: ${shortName(card.datatype)}`)
      if (card.referencesDomain) parts.push(`→ ${card.referencesDomain}`)
      if (card.description) parts.push(`— "${card.description}"`)
      if (card.allowedValues && card.allowedValues.length > 0) {
        const shown = card.allowedValues.slice(0, DISTILLED_MAX_VALUES)
        const rest = card.allowedValues.length - shown.length
        parts.push(`[${shown.join('|')}${rest > 0 ? `|…+${rest} more` : ''}]`)
      }
      return parts.join(' ')
    })
    .join('\n')
}

// ─── Turtle serialization helpers ────────────────────────────────────────────

function serializeShape(
  acc: ShapeAccumulator,
  namespaces: Map<string, string>,
  allPrefixes: string
): string {
  const lines: string[] = []
  lines.push(`${compact(acc.shapeIri, namespaces)} a sh:NodeShape ;`)
  lines.push(`  sh:targetClass ${compact(acc.targetClass, namespaces)} ;`)

  const blocks = [...acc.properties.values()].sort((a, b) => a.path.localeCompare(b.path))
  blocks.forEach((block, i) => {
    lines.push('  sh:property [')
    const facts: string[] = [`    sh:path ${compact(block.path, namespaces)}`]
    for (const [predicate, objects] of [...block.facts.entries()].sort()) {
      if (predicate === 'sh:path' || predicate === 'rdf:type') continue
      facts.push(`    ${predicate} ${objects.join(', ')}`)
    }
    if (block.inValues.length > 0) {
      facts.push(`    sh:in ( ${block.inValues.join(' ')} )`)
    }
    lines.push(facts.join(' ;\n') + ' ;')
    lines.push(`  ]${i < blocks.length - 1 ? ' ;' : ' .'}`)
  })
  if (blocks.length === 0) {
    const last = lines.length - 1
    lines[last] = lines[last]!.replace(/;$/, '.')
  }

  const body = lines.join('\n')
  return `${usedPrefixHeader(body, allPrefixes)}\n${body}\n`
}

/**
 * Turtle `@prefix` header restricted to prefixes the fragment body actually
 * uses. Reuses the registry's canonical merged prefix set (SPARQL `PREFIX`
 * lines) and re-forms it as Turtle.
 */
function usedPrefixHeader(body: string, allPrefixes: string): string {
  const lines: string[] = []
  for (const line of allPrefixes.split('\n')) {
    const match = /^PREFIX\s+([A-Za-z][\w.-]*):\s+<([^>]+)>/.exec(line.trim())
    if (!match) continue
    const [, prefix, ns] = match
    // A prefix is "used" when it appears after whitespace, punctuation, or a
    // datatype marker (`"…"^^xsd:integer`) — not inside another identifier.
    if (new RegExp(`(^|[\\s(,^])${prefix}:`).test(body)) {
      lines.push(`@prefix ${prefix}: <${ns}> .`)
    }
  }
  return lines.sort().join('\n') + '\n'
}

/** Parse the registry's SPARQL PREFIX block into namespace → prefix, longest-first. */
function collectNamespaces(allPrefixes: string): Map<string, string> {
  const entries: [string, string][] = []
  for (const line of allPrefixes.split('\n')) {
    const match = /^PREFIX\s+([A-Za-z][\w.-]*):\s+<([^>]+)>/.exec(line.trim())
    if (match) entries.push([match[2]!, match[1]!])
  }
  entries.sort((a, b) => b[0].length - a[0].length)
  return new Map(entries)
}

/** Compact an IRI against the known namespaces; fall back to <iri>. */
function compact(iri: string, namespaces: Map<string, string>): string {
  for (const [ns, prefix] of namespaces) {
    if (iri.startsWith(ns)) {
      const local = iri.slice(ns.length)
      // Only compact when the local part is a safe PN_LOCAL token ([TURTLE] §2.4).
      if (/^[A-Za-z_][\w.-]*$/.test(local)) return `${prefix}:${local}`
    }
  }
  return `<${iri}>`
}

/** Serialize one SPARQL binding term as a Turtle object term. */
function serializeTerm(term: SparqlBinding[string], namespaces: Map<string, string>): string {
  if (term.type === 'uri') return compact(term.value, namespaces)
  const escaped = term.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
  // Language-tagged literals report BOTH xml:lang and rdf:langString as the
  // datatype in SPARQL JSON results — the tag wins; a bare rdf:langString
  // datatype must never be emitted ([TURTLE] §2.5.1).
  const lang = term['xml:lang']
  if (lang) return `"${escaped}"@${lang}`
  const datatype = term.datatype
  if (datatype && !datatype.endsWith('#string') && !datatype.endsWith('#langString')) {
    return `"${escaped}"^^${compact(datatype, namespaces)}`
  }
  return `"${escaped}"`
}

/** Local name of an IRI ('#' or last '/' segment) for distilled rendering. */
function shortName(iri: string): string {
  const hash = iri.lastIndexOf('#')
  const slash = iri.lastIndexOf('/')
  return iri.slice(Math.max(hash, slash) + 1) || iri
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  const existing = map.get(key)
  if (existing) return existing
  const created = create()
  map.set(key, created)
  return created
}
