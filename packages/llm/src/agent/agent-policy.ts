/**
 * Centralized Agent Policy — single source of truth for LLM agent behaviour.
 *
 * Both the Vercel AI SDK adapter and the Copilot SDK adapter consume this
 * policy, ensuring any change to tool choice, temperature, reasoning config,
 * or step limits propagates uniformly. Without this module the two adapters
 * diverged: the Vercel path forced `submit_slots` via `toolChoice` while the
 * Copilot path exposed 6 tools with no equivalent constraint.
 *
 * **Architectural rule:** provider-specific translation lives in the adapters;
 * the POLICY (what to do) lives here. If a new knob is added (e.g. a
 * `maxOutputTokens` cap), it goes here first — adapters read it.
 */

import { getConfig } from '@ontology-search/core/config'

// ─── Policy Types ────────────────────────────────────────────────────────────

/**
 * Immutable policy object both adapters read on every request.
 *
 * The policy is derived from validated app config (env vars) so it can
 * change between restarts but not mid-request. Adapters may cache it per
 * request scope — it won't mutate during a call.
 */
export interface AgentPolicy {
  /** Temperature for sampling. 0 = greedy (deterministic). */
  readonly temperature: number
  /** Max tool-call steps before the agent is cut off. */
  readonly maxSteps: number
  /**
   * Whether Anthropic extended thinking is enabled and its budget.
   * `null` when disabled (budget = 0 or non-Anthropic provider).
   */
  readonly thinking: { readonly budgetTokens: number } | null
  /**
   * Copilot SDK reasoning effort. `null` when the model doesn't support it.
   * `'none'` explicitly disables reasoning (a latency win for the deterministic
   * slot-filling task). Maps to `reasoningEffort` in the `createSession` call.
   */
  readonly reasoningEffort: 'none' | 'low' | 'medium' | 'high' | null
  /**
   * The single tool the LLM is forced to call. Both adapters must ensure
   * this is the ONLY callable tool — no investigation tools, no alternatives.
   *
   * In Vercel AI SDK: `toolChoice: { type: 'tool', toolName }`.
   * In Copilot SDK: only this tool is registered in `availableTools`.
   */
  readonly forcedTool: 'submit_slots'
  /** The model identifier to use (e.g. 'claude-haiku-4.5', 'gpt-4o'). */
  readonly model: string
  /** The provider identifier (e.g. 'copilot', 'claude-cli', 'openai'). */
  readonly provider: string
  /**
   * Per-query schema-retrieval budgets for the composed system prompt.
   * Both adapters read the SAME block — no per-adapter prompt policy.
   */
  readonly retrieval: {
    readonly maxDomains: number
    readonly maxCards: number
  }
}

// ─── Policy Factory ──────────────────────────────────────────────────────────

/**
 * Derive the agent policy from the current application config.
 *
 * Called once per request (cheap — reads cached Zod-validated config).
 * Adapters pass this to their SDK-specific translation layer.
 */
export function getAgentPolicy(): AgentPolicy {
  const config = getConfig()

  // Anthropic extended thinking: only when budget > 0 AND provider supports it.
  const supportsThinking =
    config.LLM_THINKING_BUDGET > 0 &&
    (config.AI_PROVIDER === 'anthropic' || config.AI_PROVIDER === 'claude-cli')
  const thinking = supportsThinking ? { budgetTokens: config.LLM_THINKING_BUDGET } : null

  // Copilot SDK reasoningEffort: only models that accept the parameter.
  // We disable reasoning entirely (`'none'`) for slot-filling: the task is
  // deterministic (fill slots from SHACL, validated downstream by the SHACL
  // gate), so chain-of-thought adds latency and output tokens without improving
  // the structured result. `null` for models that don't accept the parameter.
  const supportsReasoning =
    config.AI_PROVIDER === 'copilot' &&
    (config.AI_MODEL.includes('4.6') || config.AI_MODEL.includes('opus'))
  const reasoningEffort = supportsReasoning ? ('none' as const) : null

  return {
    temperature: config.LLM_TEMPERATURE,
    maxSteps: config.LLM_MAX_AGENT_STEPS,
    thinking,
    reasoningEffort,
    forcedTool: 'submit_slots',
    model: config.AI_MODEL,
    provider: config.AI_PROVIDER,
    retrieval: {
      maxDomains: config.RETRIEVAL_MAX_DOMAINS,
      maxCards: config.RETRIEVAL_MAX_CARDS,
    },
  }
}
