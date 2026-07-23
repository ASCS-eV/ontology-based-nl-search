/**
 * Authoring IR types — the "scene slots" the LLM fills to author a scenario.
 *
 * Domain-agnostic by construction, keyed by ontology class/property local names
 * — the authoring analog of {@link ../../../slots/src/slots.ts SearchSlots}. The
 * LLM emits ONLY this IR, never raw `.xosc` XML; the deterministic lowering
 * (task 04) owns the XML. This is the authoring-side security boundary.
 */

/** A scene entity → an OpenSCENARIO `<ScenarioObject>`. */
export interface SceneEntity {
  /** Local id the LLM assigns; must be unique across the scene (SHACL-checked, task 03). */
  ref: string
  /** Class local name from the derived OpenSCENARIO ontology (e.g. `"Vehicle"`). */
  type: string
  /** Property values keyed by SHACL property local name. */
  properties: Record<string, string | string[]>
}

/** A scene action → an OpenSCENARIO Storyboard/Init or Story action. */
export interface SceneAction {
  /** Must resolve to a {@link SceneEntity.ref} (referential integrity, task 03). */
  actor: string
  /** Action class local name (e.g. `"LaneChangeAction"`). */
  kind: string
  /** Property values keyed by SHACL property local name. */
  properties: Record<string, string | string[]>
  /**
   * Named references to other entities (`entityRef`, `targetRef`, …). Each value
   * must resolve to a {@link SceneEntity.ref}, honoring `$param` indirection
   * (task 03). Omitted = the action references no other entity.
   */
  references?: Record<string, string>
}

/**
 * The full authoring IR the LLM fills via the `submit_scene` tool (task 05) —
 * a generic, schema-keyed scene description, not an OpenSCENARIO-specific type
 * tree (stay domain-agnostic, exactly as `SearchSlots` is keyed by SHACL leaf
 * local names).
 */
export interface AuthoringIR {
  /** → `<RoadNetwork>`; `logicFile` is the referenced `.xodr` (cross-file check, task 03). */
  roadNetwork?: { logicFile?: string; sceneGraphFile?: string }
  /** → `<ParameterDeclarations>`; name → value (supports the `$param` indirection). */
  parameters?: Record<string, string>
  entities: SceneEntity[]
  actions: SceneAction[]
  /** Archetype selector (e.g. `"cut-in"`) — picks the first-slice template in task 04. */
  archetype?: string
}

/** Create an empty scene, optionally tagged with an archetype. */
export function createEmptyScene(archetype?: string): AuthoringIR {
  const ir: AuthoringIR = { entities: [], actions: [] }
  if (archetype) ir.archetype = archetype
  return ir
}
