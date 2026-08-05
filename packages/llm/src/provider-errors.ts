/**
 * Translate provider/SDK failures into typed, actionable errors.
 *
 * The Vercel AI SDK and the Copilot SDK report transport-level facts, not
 * configuration advice, and two of their messages actively mislead in this
 * app's context:
 *
 *   - `Cannot connect to API: connect ECONNREFUSED 127.0.0.1:11434` reads as
 *     "this app's API is down" when it means "Ollama is not running". It names
 *     neither the provider nor the setting that points at it.
 *   - `invalid x-api-key` is what the Anthropic endpoint returns for ANY
 *     rejected credential, including the OAuth bearer token the `claude-cli`
 *     provider sends — where there is no `x-api-key` header at all. Operators
 *     go looking for a key they never configured.
 *
 * So every provider failure is classified once, here, and re-thrown as an
 * {@link AgentError} whose message names the provider, the setting that
 * selects it, and the command that fixes it. `AgentError` is a 503 the API
 * forwards to the client verbatim, so the advice reaches whoever hit the
 * failure instead of only the server's terminal.
 *
 * Unrecognized failures are left alone: a wrong guess is worse than the raw
 * message, because it sends the operator to the wrong knob.
 */
import type { AppConfig } from '@ontology-search/core/config'
import { AgentError } from '@ontology-search/core/errors'

/** What went wrong, at the level an operator can act on. */
export type ProviderFailureKind = 'unreachable' | 'unauthorized' | 'model-not-found'

export interface ProviderContext {
  provider: AppConfig['AI_PROVIDER']
  model: string
  /** Where the request went, when the provider is endpoint-configurable. */
  endpoint?: string | undefined
}

/** Nested error shapes the AI SDK uses to carry the real cause. */
interface NestedError {
  message?: unknown
  statusCode?: unknown
  cause?: unknown
  lastError?: unknown
  errors?: unknown
}

/**
 * Flatten an error chain into the text and HTTP status it carries.
 *
 * The SDK wraps: `AI_RetryError` holds `lastError` (and `errors[]`), which is
 * an `AI_APICallError` holding both a `statusCode` and a `cause` — the actual
 * `ECONNREFUSED`. Classifying only the outermost message misses all of it.
 */
export function collectErrorFacts(
  error: unknown,
  depth = 0
): { text: string; statusCode: number | undefined } {
  if (depth > 5 || error === null || error === undefined) {
    return { text: '', statusCode: undefined }
  }
  if (typeof error === 'string') return { text: error, statusCode: undefined }
  if (typeof error !== 'object') return { text: String(error), statusCode: undefined }

  const node = error as NestedError
  const parts: string[] = []
  if (typeof node.message === 'string') parts.push(node.message)
  let statusCode = typeof node.statusCode === 'number' ? node.statusCode : undefined

  const nested = [node.cause, node.lastError, ...(Array.isArray(node.errors) ? node.errors : [])]
  for (const child of nested) {
    const facts = collectErrorFacts(child, depth + 1)
    if (facts.text) parts.push(facts.text)
    statusCode ??= facts.statusCode
  }
  return { text: parts.join(' | '), statusCode }
}

/** Network-level failures: nothing answered, so there is no status code. */
const UNREACHABLE =
  /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|socket hang up|fetch failed|Cannot connect to API|network error|getaddrinfo/i
/** Credential rejections, by message — the status check covers the rest. */
const UNAUTHORIZED =
  /invalid x-api-key|invalid[_ ]api[_ ]key|unauthorized|authentication_error|permission_error|invalid token|expired token|OAuth/i
/** The endpoint answered, but does not know the requested model. */
const MODEL_NOT_FOUND =
  /model .*not found|not found.*model|unknown model|does not exist|no such model|try pulling it first/i

/**
 * Classify a provider failure, or return undefined when it is not one of the
 * three configuration faults this module can advise on.
 */
export function classifyProviderFailure(error: unknown): ProviderFailureKind | undefined {
  const { text, statusCode } = collectErrorFacts(error)
  if (statusCode === 401 || statusCode === 403) return 'unauthorized'
  if (UNAUTHORIZED.test(text)) return 'unauthorized'
  if (statusCode === 404 || MODEL_NOT_FOUND.test(text)) return 'model-not-found'
  if (statusCode === undefined && UNREACHABLE.test(text)) return 'unreachable'
  return undefined
}

/** How each provider is authenticated, in the operator's own terms. */
function credentialAdvice(provider: ProviderContext['provider']): string {
  switch (provider) {
    case 'openai':
      return 'Check OPENAI_API_KEY in .env.local.'
    case 'anthropic':
      return 'Check ANTHROPIC_API_KEY in .env.local.'
    case 'claude-cli':
      // The endpoint says "invalid x-api-key" even though this provider sends
      // an OAuth bearer token and no x-api-key header — say so, or the
      // operator hunts for a key that was never part of this setup.
      return (
        'This provider sends the OAuth token from ~/.claude/.credentials.json as a bearer ' +
        'token — the endpoint reports "invalid x-api-key" for any rejected credential, so ' +
        'that wording does not mean a key is misconfigured. Run `claude` to re-authenticate, ' +
        'then restart the API.'
      )
    case 'vibe-cli':
      return 'Run `vibe --setup` to refresh the Mistral key in ~/.vibe/.env, then restart the API.'
    case 'copilot':
      return 'Set GITHUB_TOKEN in .env.local (get one with `gh auth token`).'
    case 'ollama':
      return 'Ollama normally needs no credentials — check whether OLLAMA_BASE_URL points at a gateway that does.'
  }
}

/** What to do when nothing answered at the other end. */
function reachabilityAdvice(ctx: ProviderContext): string {
  if (ctx.provider === 'ollama') {
    return (
      `Ollama is not reachable at ${ctx.endpoint ?? 'OLLAMA_BASE_URL'}. Start it with ` +
      '`ollama serve`, or point OLLAMA_BASE_URL at the host that runs it.'
    )
  }
  return (
    `Could not reach the ${ctx.provider} endpoint${ctx.endpoint ? ` (${ctx.endpoint})` : ''}. ` +
    'Check connectivity, and set HTTPS_PROXY / NO_PROXY if this machine reaches the internet ' +
    'through a proxy — Node does not read them on its own.'
  )
}

/**
 * What to do when the endpoint answered 404 / "no such model".
 *
 * A 404 has a second cause worth naming: on an endpoint-configurable provider
 * it is equally often a base URL pointing somewhere that does not serve this
 * API at all (`OLLAMA_BASE_URL` without its `/v1` suffix, say). Advising only
 * "pull the model" there would be the same kind of confident misdirection this
 * module exists to remove, so both causes are stated when both are possible.
 */
function modelAdvice(ctx: ProviderContext): string {
  const base = `The ${ctx.provider} provider does not offer a model named "${ctx.model}" (AI_MODEL).`
  if (ctx.provider === 'ollama') {
    return (
      `${base} Pull it first: \`ollama pull ${ctx.model}\`. It must support tool calling. ` +
      `If it IS pulled, check OLLAMA_BASE_URL (${ctx.endpoint ?? 'unset'}) — a base URL that ` +
      'does not serve the OpenAI-compatible API answers 404 the same way.'
    )
  }
  const endpointNote = ctx.endpoint
    ? ` If the model name is right, check the base URL (${ctx.endpoint}) — one that does not serve this API answers 404 the same way.`
    : ''
  return `${base} Set AI_MODEL to a model this provider serves; it must support tool calling.${endpointNote}`
}

/**
 * Convert a provider failure into an {@link AgentError} that names the cause
 * and the fix, or return undefined to leave the original error alone.
 *
 * Aborts are never translated — a cancelled request is not a fault.
 */
export function toProviderAgentError(error: unknown, ctx: ProviderContext): AgentError | undefined {
  if (error instanceof DOMException && error.name === 'AbortError') return undefined
  // Already typed and already actionable (e.g. the credentials-file errors
  // raised before the request is even built).
  if (error instanceof AgentError) return undefined

  const kind = classifyProviderFailure(error)
  if (!kind) return undefined

  const advice =
    kind === 'unauthorized'
      ? `The ${ctx.provider} provider rejected the credentials. ${credentialAdvice(ctx.provider)}`
      : kind === 'unreachable'
        ? reachabilityAdvice(ctx)
        : modelAdvice(ctx)

  return new AgentError(`${advice} (AI_PROVIDER=${ctx.provider}, AI_MODEL=${ctx.model})`, {
    cause: error,
  })
}

/**
 * The provider context implied by the validated config.
 *
 * `model` follows the caller: authoring may run a different model from search
 * (`AUTHORING_AI_MODEL`), and naming the wrong one in the advice would send
 * the operator to a setting they did not use.
 */
export function providerContextFromConfig(
  config: AppConfig,
  { authoring = false }: { authoring?: boolean } = {}
): ProviderContext {
  const endpointByProvider: Partial<Record<AppConfig['AI_PROVIDER'], string>> = {
    ollama: config.OLLAMA_BASE_URL,
    'vibe-cli': config.MISTRAL_BASE_URL,
  }
  return {
    provider: config.AI_PROVIDER,
    model: (authoring ? config.AUTHORING_AI_MODEL : undefined) ?? config.AI_MODEL,
    endpoint: endpointByProvider[config.AI_PROVIDER],
  }
}

/**
 * Run `operation`, translating any provider failure it raises. The single
 * choke point both agent adapters go through.
 */
export async function withProviderErrorTranslation<T>(
  ctx: ProviderContext,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toProviderAgentError(error, ctx) ?? error
  }
}
