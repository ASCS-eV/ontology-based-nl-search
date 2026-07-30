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
 * The agent task a policy is derived for. `search` is deterministic slot-filling
 * (fast, reasoning off); `authoring` is generative scene composition (stronger
 * model, reasoning on). The two tasks read different config knobs.
 */
export type AgentTask = 'search' | 'authoring'

/**
 * Immutable policy object both adapters read on every request.
 *
 * The policy is derived from validated app config (env vars) so it can
 * change between restarts but not mid-request. Adapters may cache it per
 * request scope — it won't mutate during a call.
 */
export interface AgentPolicy {
  /**
   * Sampling temperature, or `undefined` when no sampling parameter should be
   * sent. Undefined is the DEFAULT: `temperature` was removed from the
   * Anthropic Messages API in the Claude 4.7 generation and later models
   * reject it with a 400 [ANTHROPIC-MSG] `/v1/messages` § Request, so adapters
   * must omit the field entirely rather than pass a fallback value.
   *
   * Determinism comes from the single-tool submission plus the deterministic
   * compiler, not from greedy decoding.
   */
  readonly temperature: number | undefined
  /** Max tool-call steps before the agent is cut off. */
  readonly maxSteps: number
  /**
   * Anthropic reasoning mode, or `null` when disabled (`LLM_THINKING=off`, or
   * a provider with no typed thinking block).
   *
   * A discriminated union rather than a bare budget, because the two on-modes
   * map to different request shapes and each is a hard 400 on the other's
   * model generation [ANTHROPIC-MSG] `/v1/messages` § Request: `adaptive`
   * needs Claude 4.6+, while a fixed `budgetTokens` was removed in 4.7 and
   * only works on older models. Adapters translate; they never guess.
   */
  readonly thinking:
    | { readonly mode: 'adaptive' }
    | { readonly mode: 'budget'; readonly budgetTokens: number }
    | null
  /**
   * Copilot SDK reasoning effort. `null` when the provider isn't Copilot.
   * For `search` this is `'none'` (reasoning disabled — a latency win for the
   * deterministic slot-filling task). For `authoring` it is the configured
   * `AUTHORING_REASONING_EFFORT` (reasoning ON — generative composition needs
   * it). Maps to `reasoningEffort` in the `createSession` call.
   */
  readonly reasoningEffort: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null
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
  /**
   * The model identifier to use, passed through verbatim — its spelling is
   * PROVIDER-specific and is not normalized here. Copilot uses dotted ids
   * (`claude-haiku-4.5`); the Anthropic Messages API uses hyphenated ones
   * (`claude-haiku-4-5`) and rejects the dotted form with a 400 naming the
   * model. OpenAI ids are unrelated again (`gpt-4o`).
   */
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
 * Derive the agent policy for a given task from the current application config.
 *
 * `search` (default) is deterministic slot-filling: it reuses `AI_MODEL` and
 * forces reasoning `'none'`. `authoring` is generative scene composition: it
 * uses `AUTHORING_AI_MODEL` (falling back to `AI_MODEL`) with reasoning turned
 * ON via `AUTHORING_REASONING_EFFORT`. Called once per request (cheap — reads
 * cached Zod-validated config). Adapters pass this to their SDK translation.
 */
export function getAgentPolicy(task: AgentTask = 'search'): AgentPolicy {
  const config = getConfig()

  // Anthropic reasoning: only when requested AND the provider has a typed
  // thinking block. The mode is carried through verbatim — see
  // AgentPolicy.thinking for why it must not be inferred from the model id.
  const providerHasThinking =
    config.AI_PROVIDER === 'anthropic' || config.AI_PROVIDER === 'claude-cli'
  const thinking: AgentPolicy['thinking'] =
    !providerHasThinking || config.LLM_THINKING === 'off'
      ? null
      : config.LLM_THINKING === 'adaptive'
        ? { mode: 'adaptive' }
        : { mode: 'budget', budgetTokens: config.LLM_THINKING }

  // Copilot SDK reasoningEffort is task-scoped:
  //
  //  - search: disabled (`'none'`). Slot-filling is deterministic (fill slots
  //    from SHACL, validated downstream by the SHACL gate), so chain-of-thought
  //    only adds latency and output tokens without improving the structured
  //    result. This applies to EVERY Copilot model — a previous allowlist gate
  //    (`AI_MODEL.includes('4.6') || includes('opus')`) silently left reasoning
  //    ON for models outside it (incl. the default `claude-sonnet-5`); the
  //    benchmarked cost was mean 19.5s (6–43s) vs. ~5.2s with `'none'` — a ~74%
  //    latency cut. Passing `'none'` is harmless for models that ignore the knob.
  //
  //  - authoring: enabled at `AUTHORING_REASONING_EFFORT`. Composing a scenario
  //    from prose is a reasoning task (relative speeds, "slows down", timing);
  //    the gates validate FORM (XSD/SHACL/geometry), not FIDELITY to intent, so
  //    reasoning is where nuance is captured.
  const supportsReasoning = config.AI_PROVIDER === 'copilot'
  const reasoningEffort = supportsReasoning
    ? task === 'authoring'
      ? config.AUTHORING_REASONING_EFFORT
      : ('none' as const)
    : null

  // Authoring may override the model; search always uses AI_MODEL.
  const model =
    task === 'authoring' && config.AUTHORING_AI_MODEL ? config.AUTHORING_AI_MODEL : config.AI_MODEL

  return {
    temperature: config.LLM_TEMPERATURE,
    maxSteps: config.LLM_MAX_AGENT_STEPS,
    thinking,
    reasoningEffort,
    forcedTool: 'submit_slots',
    lookupTools: SCHEMA_TOOL_NAMES,
    model,
    provider: config.AI_PROVIDER,
    retrieval: {
      maxDomains: config.RETRIEVAL_MAX_DOMAINS,
      maxCards: config.RETRIEVAL_MAX_CARDS,
      maxContextChars: config.RETRIEVAL_MAX_CONTEXT_CHARS,
    },
  }
}
