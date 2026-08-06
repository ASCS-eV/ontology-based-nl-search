/**
 * Lift a `.xodr` road network's top-level `<road id="…">` declarations to RDF,
 * typed by the REAL ASAM OpenDRIVE ontology ({@link resolveOpenDriveRoadGrounding}).
 *
 * This is the "existing maps" half of the cross-file semantic gate: the ONLY
 * fact `resolvableRoadReference` needs is which road ids a `.xodr` declares.
 * See `opendrive-ontology.ts` for why this is a narrow, purpose-built
 * extraction rather than a generic recursive lift.
 *
 * [TURTLE] RDF 1.1 Turtle (docs/specs/references/turtle.md) — the emitted
 * facts are Turtle over the [RDF11] RDF 1.1 data model.
 * [XML10] XML 1.0 (W3C) — the input `.xodr` is parsed for well-formedness only
 * (no schema validation here; that is the WASM engine's `[OSC-XSD]` concern).
 */
import { XMLParser } from 'fast-xml-parser'

import { resolveOpenDriveRoadGrounding } from './opendrive-ontology.js'

/** Escape a string for a Turtle double-quoted literal. */
function ttl(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Lift every top-level `<road id="…">` in a `.xodr` document to a Turtle
 * instance graph: `<node> a <odr:T_road IRI> ; <odr:T_road.id IRI> "<id>" .`
 * — using the real, ontology-resolved class/property IRIs, never hand-typed
 * strings.
 *
 * Returns an empty (but well-formed) document for a `.xodr` with no roads or
 * malformed XML — the semantic gate's `FILTER NOT EXISTS` then correctly
 * reports every referenced road id as unresolvable, rather than throwing.
 */
export function liftOpenDriveRoadFacts(xodr: string): string {
  const { roadClassIri, roadIdPropertyIri } = resolveOpenDriveRoadGrounding()
  const lines: string[] = []

  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
    const doc = parser.parse(xodr) as Record<string, unknown>
    const root = (doc.OpenDRIVE ?? {}) as Record<string, unknown>
    asArray(root.road as Record<string, unknown> | Record<string, unknown>[]).forEach(
      (road, index) => {
        const id = road['@_id']
        if (id === undefined) return
        // Blank node: a lifted road has no identity of its own beyond the graph
        // it is asserted in, and inventing a `urn:` IRI for it would put a
        // namespace this repo made up back into the very check that exists to
        // be grounded in the real ontology. The query only ever binds `?road`.
        lines.push(
          `_:road${index} a <${roadClassIri}> ; <${roadIdPropertyIri}> "${ttl(String(id))}" .`
        )
      }
    )
  } catch {
    // Malformed XML: no road facts to assert. The gate must not throw here —
    // an unresolvable reference against zero roads is still a valid,
    // reportable gap.
  }

  return lines.join('\n') + '\n'
}
