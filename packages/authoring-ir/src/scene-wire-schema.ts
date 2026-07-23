/**
 * Zod wire schema for the authoring IR ("scene slots").
 *
 * Mirrors `packages/slots/src/slot-wire-schema.ts`: the LLM's `submit_scene`
 * tool (task 05) carries exactly this shape, and it is the authoring security
 * boundary — the model emits only this IR, never raw `.xosc`. Objects are
 * strict so a hallucinated key (e.g. an attempt to smuggle raw XML) is rejected
 * rather than silently dropped.
 *
 * STANDARDS — the IR wire format is held to JSON Schema, not an invented
 * contract. The Vercel AI SDK serializes this Zod schema to JSON Schema
 * 2020-12 for the LLM tool call (`submit_scene`), so JSON Schema is the
 * normative grounding for the entire authoring-IR interface.
 *   [JSON-SCHEMA-CORE] JSON Schema 2020-12 — docs/specs/references/json-schema-core.md
 *   [JSON-SCHEMA-VAL]  JSON Schema Validation — docs/specs/references/json-schema-validation.md
 */

import { z } from 'zod'

/** Property values: a single literal or an array (IN-style multi-value). */
const propertyBag = () =>
  z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({})

/** A scene entity → `<ScenarioObject>`. [JSON-SCHEMA-CORE] object/required keywords. */
export const sceneEntityWireSchema = z.strictObject({
  ref: z.string().describe('Unique local id for this entity (e.g. "Ego", "A1").'),
  type: z.string().describe('Class local name from the OpenSCENARIO ontology (e.g. "Vehicle").'),
  properties: propertyBag().describe('Property values keyed by SHACL property local name.'),
})

/** A scene action → a Storyboard/Init or Story action. */
export const sceneActionWireSchema = z.strictObject({
  actor: z.string().describe('Ref of the acting entity; must resolve to a SceneEntity.ref.'),
  kind: z.string().describe('Action class local name (e.g. "LaneChangeAction").'),
  properties: propertyBag().describe('Action property values keyed by SHACL property local name.'),
  references: z
    .record(z.string(), z.string())
    .optional()
    .describe('Named references to other entities (entityRef, targetRef, …); each must resolve.'),
})

/** → `<RoadNetwork>`. `logicFile` is the referenced `.xodr` (cross-file check, task 03). */
export const roadNetworkWireSchema = z.strictObject({
  logicFile: z.string().optional(),
  sceneGraphFile: z.string().optional(),
})

/** The full authoring IR the LLM fills via `submit_scene`. [JSON-SCHEMA-VAL] applicators. */
export const authoringIrWireSchema = z.strictObject({
  roadNetwork: roadNetworkWireSchema.optional(),
  parameters: z
    .record(z.string(), z.string())
    .optional()
    .describe('Parameter declarations: name → value (supports the $param indirection).'),
  entities: z.array(sceneEntityWireSchema).default([]),
  actions: z.array(sceneActionWireSchema).default([]),
  archetype: z.string().optional().describe('Archetype selector, e.g. "cut-in".'),
})

export type SceneEntityWire = z.infer<typeof sceneEntityWireSchema>
export type SceneActionWire = z.infer<typeof sceneActionWireSchema>
export type RoadNetworkWire = z.infer<typeof roadNetworkWireSchema>
export type AuthoringIRWire = z.infer<typeof authoringIrWireSchema>
