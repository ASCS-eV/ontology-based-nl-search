/**
 * Vercel AI SDK filler for the scene-authoring agent.
 *
 * Handles every non-Copilot provider (openai, anthropic, ollama, claude-cli,
 * vibe-cli). Mirrors `packages/llm/src/agent/index.ts`: `generateText` with a
 * forced `submit_scene` tool call, reading the shared {@link getAgentPolicy}
 * for temperature / step budget so it never diverges from the search agent.
 *
 * @see ./scene-agent.ts — the repair-loop orchestrator that drives this
 */

import { generateText, hasToolCall, stepCountIs } from 'ai'

import { getAgentPolicy } from '../agent/agent-policy.js'
import { getModel } from '../provider.js'
import { getSceneStaticCore } from './scene-prompt.js'
import { sceneAgentTools, type SceneSubmissionParams } from './scene-tool.js'

/**
 * Run one scene-fill turn. The static core is the system prompt; `requestMessage`
 * (archetype hint + optional repair feedback + the user request) is the user
 * prompt. Returns the submitted scene, or `null` when the model never called
 * `submit_scene` (the orchestrator surfaces that as a gap).
 */
export async function fillSceneVercel(
  requestMessage: string,
  signal?: AbortSignal
): Promise<SceneSubmissionParams | null> {
  const policy = getAgentPolicy('authoring')
  const model = getModel()

  const providerOptions = policy.thinking
    ? {
        anthropic: {
          thinking: { type: 'enabled' as const, budgetTokens: policy.thinking.budgetTokens },
        },
      }
    : undefined

  const result = await generateText({
    model,
    system: getSceneStaticCore(),
    prompt: requestMessage,
    tools: sceneAgentTools,
    toolChoice: 'required',
    stopWhen: [stepCountIs(policy.maxSteps), hasToolCall('submit_scene')],
    ...(signal ? { abortSignal: signal } : {}),
    temperature: policy.temperature,
    ...(providerOptions ? { providerOptions } : {}),
  })

  const submit = result.steps
    .flatMap((step) => step.toolResults)
    .find((r) => r.toolName === 'submit_scene')

  return submit ? (submit.output as SceneSubmissionParams) : null
}
