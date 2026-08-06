/**
 * Startup verification that the configured LLM provider is actually usable.
 *
 * Before this, only the Copilot provider was touched during warmup. Every
 * other provider was first contacted by the first real search, so a missing
 * credential file, an expired token or an Ollama that was never started
 * produced a server that logged "ready", answered `/health` with `ok`, and
 * then failed the user's first query. The operator had no reason to suspect
 * configuration — the service said it was fine.
 *
 * The checks here are deliberately cheap and evidence-based: read what is
 * local (credential files, via the provider factory), ask the endpoint what it
 * serves, and only report a fault that the response actually proves. A
 * preflight that guesses would ground a working deployment.
 */
import { getConfig } from '@ontology-search/core/config'
import { AgentError } from '@ontology-search/core/errors'
import { createComponentLogger } from '@ontology-search/core/logging'

import { getModel } from './provider.js'
import { providerContextFromConfig, toProviderAgentError } from './provider-errors.js'

const log = createComponentLogger('provider-access')

/**
 * How long the reachability probe waits. Generous for a local daemon that is
 * still loading, short enough that a wrong host does not stall startup.
 */
const PROBE_TIMEOUT_MS = 5_000

export interface VerifyProviderOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/** `GET <base>/models` — the OpenAI-compatible listing Ollama also serves. */
function modelsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/models`
}

/** Model ids from an OpenAI-compatible `/models` body, or null if not that shape. */
export function parseModelIds(body: unknown): string[] | null {
  const data = (body as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) return null
  const ids = data
    .map((entry) => (entry as { id?: unknown } | null)?.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  return ids.length > 0 ? ids : null
}

/**
 * Whether `model` is among `available`.
 *
 * Ollama resolves a bare name to its `:latest` tag, so `qwen3` is served by
 * `qwen3:latest`. Matching only exact strings would report a pulled model as
 * missing and refuse to start a working setup.
 */
export function isModelAvailable(model: string, available: readonly string[]): boolean {
  return available.some(
    (id) => id === model || id === `${model}:latest` || `${id}:latest` === model
  )
}

/**
 * Probe an OpenAI-compatible endpoint: reachable at all, and — when it answers
 * with a model list — serving the configured model.
 */
async function verifyOpenAiCompatibleEndpoint(
  baseUrl: string,
  model: string,
  { fetchImpl = fetch, timeoutMs = PROBE_TIMEOUT_MS }: VerifyProviderOptions
): Promise<void> {
  const config = getConfig()
  const ctx = providerContextFromConfig(config)

  let response: Response
  try {
    response = await fetchImpl(modelsUrl(baseUrl), { signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    // A timeout is a reachability failure too — the endpoint answered nothing.
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw (
      toProviderAgentError(timedOut ? new Error('fetch failed: ETIMEDOUT') : error, ctx) ??
      new AgentError(
        `Could not reach the ${ctx.provider} endpoint at ${baseUrl}.`,
        error instanceof Error ? { cause: error } : {}
      )
    )
  }

  if (response.status === 401 || response.status === 403) {
    throw (
      toProviderAgentError(
        Object.assign(new Error('unauthorized'), { statusCode: response.status }),
        ctx
      ) ?? new AgentError(`The ${ctx.provider} endpoint rejected the credentials.`)
    )
  }
  if (!response.ok) {
    // Reachable but unhappy for a reason we cannot attribute to configuration.
    // Not a startup failure: the endpoint may simply not implement /models.
    log.warn('Provider model listing returned a non-OK status; skipping the model check', {
      provider: ctx.provider,
      status: response.status,
    })
    return
  }

  const ids = parseModelIds(await response.json().catch(() => null))
  if (ids === null) {
    log.warn('Provider model listing was not in the expected shape; skipping the model check', {
      provider: ctx.provider,
    })
    return
  }
  if (!isModelAvailable(model, ids)) {
    throw (
      toProviderAgentError(
        Object.assign(new Error(`model "${model}" not found`), { statusCode: 404 }),
        ctx
      ) ?? new AgentError(`Model "${model}" is not available from ${ctx.provider}.`)
    )
  }
}

/**
 * Verify that the configured provider can be used, throwing an
 * {@link AgentError} that names the setting and the command to fix.
 *
 * What is and is not probed over the network, deliberately:
 *
 *  - **Local, endpoint-configurable providers (ollama)** are probed. "Is the
 *    daemon running, and does it serve the model in AI_MODEL" cannot be
 *    answered any other way, and both are ordinary first-run mistakes.
 *  - **Key-based cloud providers** are not. Their credential is validated on
 *    first use, where a rejection now arrives as an actionable message naming
 *    the key (see `provider-errors.ts`) — enough that spending a startup
 *    request, and risking a false "credentials rejected" banner from an
 *    org-scoped key or a proxy, buys little.
 *  - **Copilot** is verified by its own session warmup, which authenticates
 *    by creating a real session, so it is skipped here.
 *
 * Credential FILES are always read for every provider that uses one, since
 * that is local, free, and the most common failure of all.
 */
export async function verifyProviderAccess(options: VerifyProviderOptions = {}): Promise<void> {
  const config = getConfig()

  // Constructing the model reads whatever local credential the provider needs
  // (the Claude CLI token, the vibe key) and raises the typed, actionable
  // error for a missing, malformed, expired or world-readable file.
  if (config.AI_PROVIDER !== 'copilot') getModel()

  if (config.AI_PROVIDER === 'ollama') {
    await verifyOpenAiCompatibleEndpoint(config.OLLAMA_BASE_URL, config.AI_MODEL, options)
  }

  log.info('Provider access verified', {
    provider: config.AI_PROVIDER,
    model: config.AI_MODEL,
  })
}
