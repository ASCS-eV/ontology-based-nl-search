/**
 * Narrower values of an IRI filter value, read from the schema graph.
 *
 * A filter on a broad class or concept also matches data that stores a
 * narrower one: a subclass under `rdfs:subClassOf` ([RDFS] §3.4), or a
 * concept under `skos:broader` / `skos:narrower` and their transitive forms
 * ([SKOS] §8), so a scenario tagged `MotorwayManaged` answers a filter on
 * `RoadTypeMotorway`. Compiled queries see the default graph only (the SPARQL
 * policy forbids `GRAPH` and `FROM`, [SPARQL11] §13.2), while the hierarchy
 * lives in the schema graph. The compiler therefore expands each IRI value
 * into itself and every value below it before it emits the filter, so the
 * query carries the hierarchy as an explicit list and the instance data is
 * never written to. The list is as long as the value's closure.
 *
 * Generic: the hierarchy is whatever the loaded schema declares with these
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

/** Predicates whose subject is the narrower value and object the broader. */
const NARROWER_TO_BROADER: readonly string[] = [
  iri('rdfs', 'subClassOf'),
  iri('skos', 'broader'),
  iri('skos', 'broaderTransitive'),
]

/** Predicates whose subject is the broader value and object the narrower. */
const BROADER_TO_NARROWER: readonly string[] = [
  iri('skos', 'narrower'),
  iri('skos', 'narrowerTransitive'),
]

/** Every schema predicate that orders filter values. */
export const VALUE_HIERARCHY_PREDICATES: readonly string[] = [
  ...NARROWER_TO_BROADER,
  ...BROADER_TO_NARROWER,
]

/** Broader value IRI → the value IRIs directly below it, sorted. */
export type NarrowerValues = ReadonlyMap<string, readonly string[]>

const terms = (predicates: readonly string[]): string => predicates.map((p) => `<${p}>`).join(' ')

/** The value hierarchy the schema graph declares. Only IRI → IRI edges count. */
export async function queryNarrowerValues(store: SparqlStore): Promise<NarrowerValues> {
  const { results } = await store.query(`
    SELECT DISTINCT ?narrower ?broader WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        { VALUES ?up { ${terms(NARROWER_TO_BROADER)} } ?narrower ?up ?broader }
        UNION
        { VALUES ?down { ${terms(BROADER_TO_NARROWER)} } ?broader ?down ?narrower }
      }
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
 * all its IRIs form one list. A list stays a list, however short: the
 * compiler reads a single string as text to contain and a list as values to
 * equal.
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
    out[key] = Array.isArray(value) || list.length > 1 ? list : list[0]!
  }
  return out
}
