/**
 * Alignment of IR enumeration values to the derived SHACL vocabulary, before
 * the gates.
 *
 * A property shape with `sh:in` ([SHACL] §4.8.3) admits exactly the listed
 * values. The model fills the IR from the same list it sees in the prompt, but
 * may write a member in another case, with a typo or in the plural; the
 * structural gate then rejects the value as a schema violation and the repair
 * loop spends a model turn on what a deterministic step settles. So each value
 * of a property that has a list is replaced by the member it is closest to,
 * under the similarity floor of the search slot validator, and every
 * replacement is recorded for the trace. A value no member is close to, a
 * `$parameter` reference and a property without a list are left as they are;
 * the gates judge them.
 *
 * The vocabulary is read from the derived SHACL by property local name, the
 * key the IR uses; where several shapes list the same property, the union of
 * their lists. No property or value is named here.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import type { ValueCorrection } from '@ontology-search/api-types'
import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { OxigraphStore } from '@ontology-search/sparql'

import { findBestMatch } from '../slot-validator-fuzzy.js'
import { readOpenScenarioShacl } from './openscenario-shacl.js'

/** Property local name → the values its `sh:in` lists admit, sorted. */
export type EnumVocabulary = ReadonlyMap<string, readonly string[]>

const localName = (iri: string): string =>
  iri.slice(Math.max(iri.lastIndexOf('/'), iri.lastIndexOf('#')) + 1)

/** The `sh:in` lists of a SHACL document, by property local name. */
export async function enumVocabularyFromShacl(turtle: string): Promise<EnumVocabulary> {
  if (turtle.trim() === '') return new Map()
  const store = new OxigraphStore()
  await store.loadTurtle(turtle)
  const { results } = await store.query(`
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    SELECT ?path ?value WHERE {
      ?shape sh:path ?path ; sh:in ?list .
      ?list rdf:rest*/rdf:first ?value .
    }
  `)
  const members = new Map<string, Set<string>>()
  for (const row of results.bindings) {
    const path = row['path']?.value
    const value = row['value']?.value
    if (!path || value === undefined) continue
    const name = localName(path)
    members.set(name, (members.get(name) ?? new Set<string>()).add(value))
  }
  return new Map([...members].map(([name, values]) => [name, [...values].sort()]))
}

let cached: Promise<EnumVocabulary> | undefined

/** The vocabulary of the derived OpenSCENARIO SHACL, read once per process. */
export function getEnumVocabulary(): Promise<EnumVocabulary> {
  cached ??= enumVocabularyFromShacl(readOpenScenarioShacl())
  return cached
}

/** Forget the cached vocabulary (tests). */
export function resetEnumVocabulary(): void {
  cached = undefined
}

/**
 * The IR with every enumerated value replaced by the vocabulary member it is
 * closest to, and the replacements made. The same object comes back when
 * nothing changed.
 */
export function alignEnumValues(
  ir: AuthoringIR,
  vocabulary: EnumVocabulary
): { readonly ir: AuthoringIR; readonly corrections: readonly ValueCorrection[] } {
  if (vocabulary.size === 0) return { ir, corrections: [] }
  const corrections: ValueCorrection[] = []

  const alignProperties = (
    where: string,
    properties: Record<string, string | string[]>
  ): Record<string, string | string[]> => {
    let changed = false
    const out: Record<string, string | string[]> = {}
    for (const [property, value] of Object.entries(properties)) {
      const members = vocabulary.get(property)
      if (!members) {
        out[property] = value
        continue
      }
      const align = (v: string): string => {
        if (v.startsWith('$') || members.includes(v)) return v
        const best = findBestMatch(v, [...members])
        if (!best) return v
        corrections.push({ where, property, from: v, to: best.match })
        changed = true
        return best.match
      }
      out[property] = Array.isArray(value) ? value.map(align) : align(value)
    }
    return changed ? out : properties
  }

  const entities = ir.entities.map((entity) => {
    const properties = alignProperties(`entity ${entity.ref}`, entity.properties)
    return properties === entity.properties ? entity : { ...entity, properties }
  })
  const actions = ir.actions.map((action) => {
    const properties = alignProperties(`action ${action.actor} ${action.kind}`, action.properties)
    return properties === action.properties ? action : { ...action, properties }
  })
  return corrections.length === 0
    ? { ir, corrections }
    : { ir: { ...ir, entities, actions }, corrections }
}
