/**
 * Claude Code filler for the scene-authoring agent — the authoring analog of
 * ../agent/claude-code-agent.ts.
 *
 * One headless Claude Code turn whose structured output is the `submit_scene`
 * payload, validated against the same `sceneSubmissionSchema` the other
 * fillers use, so the model still never emits `.xosc` — the lowering owns the
 * document. Why the binary and how its session is isolated: ../claude-code-cli.ts.
 *
 * @see ./scene-agent.ts — the repair-loop orchestrator that drives this
 */
import { getAgentPolicy } from '../agent/agent-policy.js'
import { runClaudeCodeStructured, toCliJsonSchema } from '../claude-code-cli.js'
import { getSceneStaticCore } from './scene-prompt.js'
import { type SceneSubmissionParams, sceneSubmissionSchema } from './scene-tool.js'

/** The scene schema as the CLI takes it — derived once; the schema is static. */
const SCENE_SUBMISSION_CLI_SCHEMA = toCliJsonSchema(sceneSubmissionSchema)

/**
 * Appended to the static core, which tells the model to call `submit_scene`;
 * in this transport the structured output is that call.
 */
export const STRUCTURED_SCENE_NOTE =
  'In this session `submit_scene` is your structured output: return exactly the object you ' +
  'would pass to it.'

/**
 * Run one scene-fill turn. Returns the submitted scene, or `null` when the
 * output does not validate (the orchestrator surfaces that as a gap, as it
 * does for a missing `submit_scene` call on the other fillers).
 */
export async function fillSceneClaudeCode(
  requestMessage: string,
  signal?: AbortSignal
): Promise<SceneSubmissionParams | null> {
  const policy = getAgentPolicy('authoring')
  const run = await runClaudeCodeStructured({
    model: policy.model,
    systemPrompt: `${getSceneStaticCore()}\n\n${STRUCTURED_SCENE_NOTE}`,
    userMessage: requestMessage,
    jsonSchema: SCENE_SUBMISSION_CLI_SCHEMA,
    ...(signal === undefined ? {} : { signal }),
  })
  const scene = sceneSubmissionSchema.safeParse(run.structuredOutput)
  return scene.success ? scene.data : null
}
