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

import { SCHEMA_TOOL_NAMES } from './schema-tools.js'

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
   * The single SUBMISSION tool — the only way the model's output becomes
   * a search. Lookup tools may run first (bounded by maxSteps), but no
   * result exists until this tool is called; a budget exhausted without
   * it falls back deterministically.
   */
  readonly forcedTool: 'submit_slots'
  /**
   * Read-only schema-lookup tools registered ALONGSIDE the submission
   * tool on both adapters. Every argument is index-validated and every
   * query they run is index- or compiler-emitted — the model never
   * supplies query text.
   */
  readonly lookupTools: readonly string[]
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
    readonly maxContextChars: number
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

  // Copilot SDK reasoningEffort: disable reasoning entirely (`'none'`) for
  // slot-filling. The task is deterministic (fill slots from SHACL, validated
  // downstream by the SHACL gate), so chain-of-thought only adds latency and
  // output tokens without improving the structured result.
  //
  // This gate deliberately applies to EVERY Copilot model. A previous version
  // hard-coded an allowlist (`AI_MODEL.includes('4.6') || includes('opus')`),
  // which silently left reasoning ON for every model outside that list —
  // including the configured default `claude-sonnet-5`. Benchmarked impact of
  // that stale gate: mean round-trip 19.5s (6–43s, high variance) with
  // reasoning ON vs. ~5.2s (tight) with `'none'` — a ~74% latency cut and the
  // 43s tail eliminated. Passing `'none'` is harmless for models that ignore
  // the knob, so an allowlist is the wrong shape here — it can only regress.
  const supportsReasoning = config.AI_PROVIDER === 'copilot'
  const reasoningEffort = supportsReasoning ? ('none' as const) : null

  return {
    temperature: config.LLM_TEMPERATURE,
    maxSteps: config.LLM_MAX_AGENT_STEPS,
    thinking,
    reasoningEffort,
    forcedTool: 'submit_slots',
    lookupTools: SCHEMA_TOOL_NAMES,
    model: config.AI_MODEL,
    provider: config.AI_PROVIDER,
    retrieval: {
      maxDomains: config.RETRIEVAL_MAX_DOMAINS,
      maxCards: config.RETRIEVAL_MAX_CARDS,
      maxContextChars: config.RETRIEVAL_MAX_CONTEXT_CHARS,
    },
  }
}
