/**
 * Tool schema for the LLM scene-authoring agent — the authoring analog of
 * {@link ../agent/tools.ts `submit_slots`}.
 *
 * The model's ONLY output is a {@link AuthoringIR} ("scene slots") plus an
 * interpretation and any gaps it could not express. It never emits raw `.xosc`
 * XML: the deterministic lowering (packages/authoring) owns the document. This
 * is the authoring-side security boundary — identical in spirit to the search
 * feature, where the LLM fills slots and the compiler owns the SPARQL.
 *
 * STANDARDS — the tool payload is the authoring IR wire format, held to
 *   [JSON-SCHEMA-CORE] JSON Schema 2020-12 — docs/specs/references/json-schema-core.md
 * The Vercel AI SDK serializes this Zod schema to JSON Schema 2020-12 for the
 * tool call, so JSON Schema is the normative grounding for the whole contract
 * (criterion #31, same as `authoringIrWireSchema`).
 */

import { authoringIrWireSchema } from '@ontology-search/authoring-ir/scene-wire-schema'
import { gapsWireSchema, interpretationWireSchema } from '@ontology-search/search/slot-wire-schema'
import { tool } from 'ai'
import { z } from 'zod'

/**
 * The structured answer the scene-authoring agent submits.
 *
 * `scene` is the authoring IR the lowering materializes; `interpretation`
 * mirrors the search feature's interpretation block (a human summary + the
 * terms the model mapped); `gaps` are user concepts the model could not express
 * in the IR (reported, never silently dropped — same contract as search).
 */
export const sceneSubmissionSchema = z.object({
  scene: authoringIrWireSchema.describe(
    'The authoring IR ("scene slots"): entities, actions, roadNetwork, parameters. ' +
      'Fill only what the user expressed; the lowering fills standard-car defaults for the rest. ' +
      'Emit ONLY this IR — never raw .xosc XML.'
  ),
  interpretation: interpretationWireSchema.describe(
    'Human-readable summary of the scenario you authored plus the terms you mapped.'
  ),
  gaps: gapsWireSchema.describe(
    'User concepts you could NOT express in the scene IR, each with a reason. Report them; never drop silently.'
  ),
})

export type SceneSubmissionParams = z.infer<typeof sceneSubmissionSchema>

/**
 * Tool definitions for the scene-authoring agent (Vercel AI SDK shape).
 * The LLM fills the structured scene IR instead of writing `.xosc`.
 */
export const sceneAgentTools = {
  /**
   * Submit the authored scene. Fill the IR for what the user described, report
   * gaps for anything you could not express. Call this exactly once.
   */
  submit_scene: tool<SceneSubmissionParams, SceneSubmissionParams>({
    description:
      'Submit the authored OpenSCENARIO scene as a structured IR (entities, actions, ' +
      'roadNetwork, parameters), plus an interpretation and any gaps. Call this exactly once. ' +
      'Never emit raw .xosc XML — only the IR.',
    inputSchema: sceneSubmissionSchema,
    execute: async (params) => params,
  }),
}
