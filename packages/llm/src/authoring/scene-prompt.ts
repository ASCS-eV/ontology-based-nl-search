/**
 * System prompt for the scene-authoring agent.
 *
 * Grounds the LLM in (a) the security contract — emit ONLY the scene IR, never
 * raw `.xosc` XML; (b) the derived OpenSCENARIO SHACL (task 01 artifacts), which
 * carries the class/property local names and the `sh:in` enum vocabularies the
 * IR is keyed by; and (c) the archetype action contract the deterministic
 * lowering (packages/authoring) understands.
 *
 * The static core is byte-stable and cached (prompt-cacheable, exactly like the
 * search agent's static core); the per-request tail carries the archetype hint,
 * any repair feedback, and the user's natural-language request below a
 * delimiter — user text never enters the system core.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defaultRoad, describeRoadForPrompt } from '@ontology-search/road-catalog'

import type { SceneGap } from './run-scene-pipeline.js'

// ─── Derived-SHACL grounding ─────────────────────────────────────────────────

/**
 * Locate and read the derived OpenSCENARIO SHACL (task 01). Resolved relative to
 * this module so it works from both `src` (vitest) and `dist` (runtime), which
 * sit at the same depth below the repo root.
 */
function readOpenScenarioShacl(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const root = join(here, '..', '..', '..', '..')
    const shacl = join(root, 'artifacts', 'openscenario', 'openscenario.shacl.ttl')
    return readFileSync(shacl, 'utf-8')
  } catch {
    // Grounding is best-effort: if the artifact is unavailable the agent still
    // runs on the archetype contract below. Never throw from prompt assembly.
    return ''
  }
}

// ─── Static core (cached) ────────────────────────────────────────────────────

/**
 * The archetype action contract the lowering understands (packages/authoring
 * `ir-to-engine.ts`). Keeping the model inside this contract means the IR it
 * emits lowers to a schema-valid document on the first try far more often.
 */
const ARCHETYPE_CONTRACT = `
## What to emit

You author an OpenSCENARIO scene by filling a compact JSON IR ("scene slots").
You NEVER write .xosc XML — a deterministic writer owns the XML. Emit the IR via
the \`submit_scene\` tool exactly once.

### entities[] — the actors (each becomes a <ScenarioObject>)
- \`ref\`: unique id you choose (e.g. "Ego", "A1"). Must be unique in the scene.
- \`type\`: "Vehicle".
- \`properties\` (all optional; standard-car defaults fill the rest):
  \`vehicleCategory\` (see the enum in the SHACL, e.g. "car", "truck"),
  \`maxSpeed\`, \`width\`, \`length\`, \`height\` (metres / m·s⁻¹, as strings).

### actions[] — initial state and the one maneuver
- SpeedAction — an entity's initial speed. \`actor\`=entity ref,
  \`properties.speed\` in m/s.
- TeleportAction — an entity's start position. \`actor\`=entity ref, then EITHER
  an absolute lane (\`properties.roadId\`, \`laneId\`, \`s\`, \`offset\`) OR relative
  to another entity (\`references.relativeTo\`=other ref, \`properties.dLane\`,
  \`ds\`, \`offset\`).
- LaneChangeAction — the single triggered maneuver. \`actor\`=the lane-changer,
  \`references.relativeTo\`=the entity it targets, \`properties\`:
  \`targetLaneOffset\`, \`dynamicsShape\` (enum), \`dynamicsDimension\` (enum),
  \`dynamicsValue\`, \`targetValue\`, \`startTime\` (s).

### roadNetwork (REQUIRED — a fixed catalog road)
The scenario runs on ONE curated road network described under "Road network"
below. Set \`roadNetwork.logicFile\` to that exact file and place every entity on
the road ids and lane ids it lists — do not invent road or lane ids, and keep
\`s\` within the stated range. \`sceneGraphFile\` is optional.

### parameters (optional)
- name → value. Reference a parameter elsewhere as \`$name\` (e.g. \`$Ego\`).

Fill ONLY what the user expresses. Report anything you cannot express as a gap —
never invent geometry or omit it silently.
`.trim()

let cachedStaticCore: string | null = null

/**
 * The cached, byte-stable static system core for the scene agent. Query- and
 * archetype-independent, so it is prompt-cacheable across requests.
 */
export function getSceneStaticCore(): string {
  if (cachedStaticCore !== null) return cachedStaticCore
  const shacl = readOpenScenarioShacl()
  const shaclSection = shacl
    ? `\n## OpenSCENARIO domain (derived SHACL — the source of truth for class names, property local names, and enum values)\n\n\`\`\`turtle\n${shacl}\n\`\`\`\n`
    : ''
  // Road guidance derived from the curated catalog road's DISCOVERED topology,
  // so the model places entities on lanes that actually exist and sets the
  // correct logicFile — the precondition for the cross-file gate to pass and for
  // the viewer to render exactly what was validated. Static (the catalog road is
  // build-time constant), so it stays inside the prompt-cacheable core.
  const roadSection = `\n## Road network\n\n${describeRoadForPrompt(defaultRoad())}\n`
  cachedStaticCore = [
    'You are an OpenSCENARIO scenario-authoring assistant. You translate a ' +
      'natural-language description of a driving scenario into a structured scene ' +
      'IR that a deterministic engine lowers to a valid ASAM OpenSCENARIO 1.3 ' +
      '`.xosc` document and validates.',
    ARCHETYPE_CONTRACT,
    roadSection,
    shaclSection,
  ]
    .filter(Boolean)
    .join('\n\n')
  return cachedStaticCore
}

/** Reset the cached static core. Test-only (the artifact does not change at runtime). */
export function resetSceneStaticCoreCache(): void {
  cachedStaticCore = null
}

// ─── Per-request tail ────────────────────────────────────────────────────────

/**
 * Render repair feedback for a failed pipeline pass: the outstanding gaps, each
 * with its canonical qc rule UID, plus the IR that produced them. The model
 * fixes the IR and resubmits. Only IR-fixable gaps should be passed in.
 */
export function renderRepairFeedback(previousIr: unknown, gaps: readonly SceneGap[]): string {
  const lines = gaps.map(
    (g, i) =>
      `${i + 1}. [${g.ruleUid}] ${g.term} — ${g.reason}` +
      (g.focusNode ? ` (element: ${g.focusNode})` : '') +
      (g.location ? ` (at line ${g.location.line}:${g.location.col})` : '')
  )
  return [
    'Your previous scene IR did NOT pass validation. Fix these violations and ' +
      'resubmit the corrected IR via `submit_scene`:',
    lines.join('\n'),
    'Previous IR (correct it — do not restart from scratch):',
    '```json',
    JSON.stringify(previousIr, null, 2),
    '```',
  ].join('\n\n')
}

/**
 * Build the per-request user message: the archetype hint, optional repair
 * feedback, and the user's request below a delimiter. The delimiter keeps user
 * text out of the trusted instruction region (unchanged injection posture from
 * the search agent).
 */
export function buildSceneRequest(
  naturalLanguage: string,
  options: { archetype?: string; feedback?: string } = {}
): string {
  const parts: string[] = []
  if (options.archetype) {
    parts.push(`Target archetype: ${options.archetype}. Set \`archetype\` accordingly.`)
  }
  if (options.feedback) parts.push(options.feedback)
  parts.push('---')
  parts.push(`Author this scenario:\n${naturalLanguage}`)
  return parts.join('\n\n')
}
