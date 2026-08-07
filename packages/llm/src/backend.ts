/**
 * Agent backend seam — the one place that knows which LLM provider is in use.
 *
 * `getAgentBackend()` on `AI_PROVIDER`, mirroring `getSparqlStore()` on
 * `SPARQL_MODE` and `getAuthoringBackend()` on `AUTHORING_MODE`. Both of those
 * packages already model "one contract, two implementations, selected by
 * validated config" as an interface; the LLM layer had the same shape
 * expressed as a bare `AI_PROVIDER === 'copilot'` ternary repeated at three
 * call sites — provider verification, search slot-filling, and scene filling —
 * so adding a provider meant finding all three, and nothing made them agree.
 *
 * The two implementations differ in more than a model handle, which is why
 * this is an interface rather than a factory returning a `LanguageModel`:
 * Copilot runs its own SDK with a persistent session and a primeable prompt
 * cache, while every other provider goes through the Vercel AI SDK's
 * `generateText` with a forced tool call.
 *
 * @see ./agent/agent-policy.ts — the behaviour both backends read (temperature,
 *      reasoning mode, step budget), so the seam carries provider WIRING only
 *      and never per-provider policy.
 */
import { getConfig } from '@ontology-search/core/config'
import type { LlmStructuredResponse } from '@ontology-search/search/types'

import {
  getPersistentSession,
  primeCacheInBackground,
  runCopilotAgent,
} from './agent/copilot-agent.js'
import { runSparqlAgent } from './agent/index.js'
import { fillSceneCopilot } from './authoring/fill-scene-copilot.js'
import { fillSceneVercel } from './authoring/fill-scene-vercel.js'
import type { SceneSubmissionParams } from './authoring/scene-tool.js'
import { verifyProviderAccess } from './provider-access.js'

/** Options every slot-filling run takes, whichever backend serves it. */
export interface FillSlotsOptions {
  /** Target domain for the search. */
  domain: string
  /** Cancel the in-flight LLM call when the caller aborts. */
  signal?: AbortSignal
}

/**
 * What the pipeline needs from an LLM provider. Deliberately narrow: the
 * agents own prompt construction, tool schemas and validation, so a backend
 * supplies transport and nothing else.
 */
export interface AgentBackend {
  /** Stable identifier, for logs and error attribution. */
  readonly id: string
  /**
   * Verify the provider is usable, throwing an `AgentError` that names the
   * setting and the command to fix it. Callers treat a throw as a WARNING, not
   * a failed startup — everything except NL search works without a provider.
   */
  verify(): Promise<void>
  /** Fill search slots from a natural-language query. */
  fillSlots(query: string, options: FillSlotsOptions): Promise<LlmStructuredResponse>
  /**
   * Run one scene-authoring turn. Resolves `null` when the model never called
   * `submit_scene`; the orchestrator surfaces that as a rule-attributed gap.
   */
  fillScene(requestMessage: string, signal?: AbortSignal): Promise<SceneSubmissionParams | null>
}

/** GitHub Copilot, via its own SDK and a persistent session. */
const copilotBackend: AgentBackend = {
  id: 'copilot',
  async verify() {
    // Creating the session IS the authentication check.
    await getPersistentSession()
    // Non-blocking one-shot prompt-cache prime. Readiness is not delayed;
    // requests arriving before priming completes pay the cold cost once. No
    // recurring keep-alive, so no idle token cost.
    primeCacheInBackground()
  },
  fillSlots: (query, { domain, signal }) =>
    runSparqlAgentCompatible(runCopilotAgent, query, domain, signal),
  fillScene: fillSceneCopilot,
}

/** Everything else (openai, anthropic, ollama, claude-cli, vibe-cli). */
const vercelBackend: AgentBackend = {
  id: 'vercel',
  verify: () => verifyProviderAccess(),
  fillSlots: (query, { domain, signal }) =>
    runSparqlAgentCompatible(runSparqlAgent, query, domain, signal),
  fillScene: fillSceneVercel,
}

/**
 * Both agents take `{ domain?, signal? }` with the same meaning, but declare
 * the optional keys separately. Forward them by name — spreading a caller's
 * object would let an extra key structurally satisfy the options type and
 * reach the agent, which the "LLM never writes SPARQL" invariant depends on
 * not being possible from a request path.
 */
function runSparqlAgentCompatible(
  run: (
    query: string,
    options?: { domain?: string; signal?: AbortSignal }
  ) => Promise<LlmStructuredResponse>,
  query: string,
  domain: string,
  signal: AbortSignal | undefined
): Promise<LlmStructuredResponse> {
  return run(query, { domain, ...(signal === undefined ? {} : { signal }) })
}

/**
 * The backend selected by validated config.
 *
 * Synchronous and stateless — both implementations are module constants, so
 * there is nothing to cache and no lifecycle to manage (the Copilot session is
 * owned by `copilot-agent.ts`, which already memoizes it).
 */
export function getAgentBackend(): AgentBackend {
  return getConfig().AI_PROVIDER === 'copilot' ? copilotBackend : vercelBackend
}
