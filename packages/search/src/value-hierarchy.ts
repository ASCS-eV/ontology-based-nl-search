/**
 * Narrower values of an IRI filter value, read from the schema graph.
 *
 * A filter on a broad class or concept also matches data that stores a
 * narrower one: `rdfs:subClassOf` ([RDFS] §3.4) and `skos:broaderTransitive`
 * ([SKOS] §8.1) are transitive, so a scenario tagged `MotorwayManaged`
 * answers a filter on `RoadTypeMotorway`. Compiled queries see the default
 * graph only (the SPARQL policy forbids `GRAPH` and `FROM`, [SPARQL11] §13.2),
 * while the hierarchy lives in the schema graph. The compiler therefore
 * expands each IRI value into itself and every value below it before it emits
 * the filter, so the query carries the hierarchy as an explicit list and the
 * instance data is never written to.
 *
 * Generic: the hierarchy is whatever the loaded schema declares with these two
 * predicates; no class or concept is named here.
 *
 * @see https://www.w3.org/TR/rdf-schema/ — [RDFS]
 * @see https://www.w3.org/TR/skos-reference/ — [SKOS]
 */
import { iri } from '@ontology-search/core/rdf/prefixes'
import type { ReferenceFilter, SearchSlots } from '@ontology-search/slots/slots'
import { normalizeReferences } from '@ontology-search/slots/slots'
import { isIri } from '@ontology-search/sparql/escape'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { SCHEMA_GRAPH } from './schema-loader.js'

/** The schema predicates that order filter values from narrower to broader. */
export const VALUE_HIERARCHY_PREDICATES: readonly string[] = [
  iri('rdfs', 'subClassOf'),
  iri('skos', 'broaderTransitive'),
]

/** Broader value IRI → the value IRIs directly below it, sorted. */
export type NarrowerValues = ReadonlyMap<string, readonly string[]>

/** The value hierarchy the schema graph declares. Only IRI → IRI edges count. */
export async function queryNarrowerValues(store: SparqlStore): Promise<NarrowerValues> {
  const predicates = VALUE_HIERARCHY_PREDICATES.map((p) => `<${p}>`).join(' ')
  const { results } = await store.query(`
    SELECT DISTINCT ?narrower ?broader WHERE {
      VALUES ?p { ${predicates} }
      GRAPH <${SCHEMA_GRAPH}> { ?narrower ?p ?broader }
      FILTER(isIRI(?narrower) && isIRI(?broader) && ?narrower != ?broader)
    }
  `)
  const below = new Map<string, string[]>()
  for (const row of results.bindings) {
    const narrower = row['narrower']?.value
    const broader = row['broader']?.value
    if (!narrower || !broader) continue
    below.set(broader, [...(below.get(broader) ?? []), narrower])
  }
  for (const list of below.values()) list.sort()
  return below
}

/** `value` and every value below it, sorted; a cycle is walked once. */
export function withNarrowerValues(value: string, narrower: NarrowerValues): string[] {
  const seen = new Set([value])
  const queue = [value]
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const child of narrower.get(next) ?? []) {
      if (seen.has(child)) continue
      seen.add(child)
      queue.push(child)
    }
  }
  return [...seen].sort()
}

/**
 * The slots with every IRI filter value, at every reference depth, replaced by
 * itself and the values below it. Literal values and ranges are unchanged. A
 * filter's values are alternatives (IN semantics), so the expanded values of
 * all its IRIs form one list.
 */
export function expandNarrowerValues(slots: SearchSlots, narrower: NarrowerValues): SearchSlots {
  if (narrower.size === 0) return slots
  const references = normalizeReferences(slots.references)
  return {
    ...slots,
    filters: expandFilters(slots.filters, narrower),
    ...(slots.references === undefined
      ? {}
      : { references: references.map((reference) => expandReference(reference, narrower)) }),
  }
}

function expandReference(reference: ReferenceFilter, narrower: NarrowerValues): ReferenceFilter {
  const nested = normalizeReferences(reference.references)
  return {
    ...reference,
    ...(reference.filters === undefined
      ? {}
      : { filters: expandFilters(reference.filters, narrower) }),
    ...(reference.references === undefined
      ? {}
      : { references: nested.map((child) => expandReference(child, narrower)) }),
  }
}

function expandFilters(
  filters: Record<string, string | string[]>,
  narrower: NarrowerValues
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(filters)) {
    const values = Array.isArray(value) ? value : [value]
    if (!values.some(isIri)) {
      out[key] = value
      continue
    }
    const expanded = new Set<string>()
    for (const v of values) {
      if (!isIri(v)) expanded.add(v)
      else for (const below of withNarrowerValues(v, narrower)) expanded.add(below)
    }
    const list = [...expanded].sort()
    out[key] = list.length === 1 ? list[0]! : list
  }
  return out
}
