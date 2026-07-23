/**
 * Lower a validated {@link AuthoringIR} to an RDF instance graph (Turtle).
 *
 * This is the counterpart of the search compiler, but it emits **data**, not a
 * query: entities become `ScenarioObject` individuals, parameters become
 * `ParameterDeclaration` individuals, and entity/road references become reified
 * reference nodes the semantic gate resolves with SPARQL. Real ontology terms
 * (`os:ScenarioObject`, `os:name`, …) are used where the derived OpenSCENARIO
 * ontology (task 01) defines them; gate-internal modeling predicates live under a
 * separate `gate:` namespace so they are never confused with the standard's
 * vocabulary.
 *
 * The mapping is deterministic and pure — no engine call, no I/O. It builds every
 * reference faithfully (including a dangling one), so the gate can DETECT an
 * unresolvable reference rather than silently dropping it.
 *
 * [OSC-XSD] OpenSCENARIO 1.3 — individuals are typed by the derived ontology;
 * `$param` indirection follows the standard's parameter mechanism.
 */
import type { AuthoringIR, SceneAction } from '@ontology-search/authoring-ir'

/** The derived OpenSCENARIO ontology namespace (task 01 artifacts). */
export const OSC_NS = 'https://w3id.org/ascs-ev/envited-x/openscenario/v1/'
/** Gate-internal modeling predicates — NOT part of the standard vocabulary. */
export const GATE_NS = 'urn:authoring-gate:'
/** Namespace the referenced `.xodr` road network is lifted into. */
export const OPENDRIVE_NS = 'urn:opendrive:'

/** Escape a string for a Turtle double-quoted literal. */
function ttl(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

/** Mint a stable instance IRI for a scene individual. */
function iri(kind: string, id: string | number): string {
  return `<urn:scene:${kind}:${encodeURIComponent(String(id))}>`
}

/** First value of a possibly-multi-valued property. */
function first(props: Record<string, string | string[]>, key: string): string | undefined {
  const v = props[key]
  if (v === undefined) return undefined
  return Array.isArray(v) ? v[0] : v
}

/** Every entity-reference (role → target name) an action carries. */
function entityReferences(action: SceneAction): Array<{ role: string; value: string }> {
  if (!action.references) return []
  return Object.entries(action.references).map(([role, value]) => ({ role, value }))
}

/**
 * Serialize an {@link AuthoringIR} to a Turtle instance graph. The returned
 * document is self-contained (declares its own prefixes) and safe to load into
 * the in-process store next to a lifted `.xodr`.
 */
export function irToRdf(ir: AuthoringIR): string {
  const lines: string[] = [`@prefix os: <${OSC_NS}> .`, `@prefix gate: <${GATE_NS}> .`, '']

  for (const [index, entity] of ir.entities.entries()) {
    // Index-based instance IRI (NOT keyed by ref) so two entities that share a
    // ref become two distinct nodes with the same os:name — the uniqueness gate
    // must be able to SEE a duplicate, not silently merge it into one node.
    const s = iri('entity', index)
    lines.push(`${s} a os:ScenarioObject ; os:name "${ttl(entity.ref)}" .`)
  }

  for (const [name, value] of Object.entries(ir.parameters ?? {})) {
    const s = iri('param', name)
    lines.push(
      `${s} a os:ParameterDeclaration ; os:name "${ttl(name)}" ; os:value "${ttl(value)}" .`
    )
  }

  let refIndex = 0
  let roadIndex = 0
  ir.actions.forEach((action) => {
    for (const { role, value } of entityReferences(action)) {
      const s = iri('ref', refIndex++)
      lines.push(
        `${s} a gate:EntityReference ; gate:referenceValue "${ttl(value)}" ; ` +
          `gate:referenceRole "${ttl(role)}" ; gate:referencedBy "${ttl(action.actor)}" .`
      )
    }
    // An absolute-lane teleport carries a road id that must resolve cross-file.
    if (action.kind === 'TeleportAction' && action.references?.relativeTo === undefined) {
      const roadId = first(action.properties, 'roadId')
      if (roadId !== undefined) {
        const s = iri('roadref', roadIndex++)
        lines.push(
          `${s} a gate:RoadReference ; gate:roadId "${ttl(roadId)}" ; ` +
            `gate:referencedBy "${ttl(action.actor)}" .`
        )
      }
    }
  })

  return lines.join('\n') + '\n'
}
