import { z } from 'zod'

import { ConfigError } from '../errors/index.js'

/**
 * Centralized, validated application configuration.
 *
 * All environment variable access is consolidated here.
 * The schema is validated once at startup — invalid config
 * fails fast with clear error messages.
 */

const sparqlModeSchema = z.enum(['memory', 'remote'])
const authoringModeSchema = z.enum(['wasm', 'null'])
const residualModeSchema = z.enum(['in-process', 'external'])
const aiProviderSchema = z.enum([
  'openai',
  'ollama',
  'copilot',
  'anthropic',
  'claude-cli',
  'vibe-cli',
])
/**
 * Copilot reasoning-effort levels (the SDK's `reasoningEffort` on
 * `createSession`). `none` disables reasoning; `low`→`max` trade latency for
 * depth. Search forces `none`; the generative authoring agent turns it on.
 */
const reasoningEffortSchema = z.enum(['none', 'low', 'medium', 'high', 'xhigh', 'max'])

const envSchema = z.object({
  // SPARQL Store
  SPARQL_MODE: sparqlModeSchema.default('memory'),
  SPARQL_ENDPOINT: z.string().url().optional(),
  SPARQL_CACHE_SIZE: z.coerce.number().int().positive().default(256),
  SPARQL_CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(300_000),
  /** Maximum LIMIT the SPARQL policy will accept; queries above are rejected. */
  SPARQL_MAX_LIMIT: z.coerce.number().int().positive().default(500),
  /**
   * Default LIMIT the compiler embeds in every emitted query. Must be
   * ≤ `SPARQL_MAX_LIMIT` (the policy ceiling) — enforced below via
   * cross-field validation. Operators tune throughput vs. payload size
   * via this knob without recompiling.
   */
  SPARQL_DEFAULT_LIMIT: z.coerce.number().int().positive().default(100),
  /** Remote SPARQL HTTP timeout. Composed with caller signals via AbortSignal.any. */
  SPARQL_REMOTE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  /**
   * Maximum number of SHACL per-value validation results retained in the
   * in-memory LRU cache. Shapes are immutable for the process lifetime
   * but the value space is unbounded — so we bound the cache instead.
   */
  SHACL_CACHE_SIZE: z.coerce.number().int().positive().default(1024),

  // Authoring backend (NL → .xosc)
  /**
   * Selects the authoring backend `getAuthoringBackend()` returns, mirroring
   * `SPARQL_MODE`: `wasm` (default) loads the in-process OpenSCENARIO WASM
   * engine (packages/authoring-wasm); `null` is a deterministic no-engine
   * backend for tests and for running the pipeline without loading the engine.
   */
  AUTHORING_MODE: authoringModeSchema.default('wasm'),

  /**
   * Selects the residual-gate backend `getResidualChecker()` returns
   * (packages/authoring-gate), mirroring `AUTHORING_MODE`: `in-process`
   * (default) runs only the pure analytic-geometry continuity check;
   * `external` additionally enables an opt-in out-of-process simulator adapter
   * (esmini / qc-framework) for collision / physics rules. When no external
   * runner is configured those simulation-only rules are reported `skipped`,
   * never a false pass.
   */
  RESIDUAL_MODE: residualModeSchema.default('in-process'),

  /**
   * Command the `external` residual backend invokes to run an out-of-process
   * ASAM Quality Checker bundle (e.g. `qc-opendrive`). Invoked with the
   * framework's own contract — `$ASAM_QC_FRAMEWORK_CONFIG_FILE` and
   * `$ASAM_QC_FRAMEWORK_WORKING_DIR` in the environment — and its `.xqar`
   * result is imported as gaps carrying the bundle's own rule UIDs. Unset
   * (default) means no bundle runs and the rules it would decide stay
   * `skipped`, never a false pass.
   */
  RESIDUAL_EXTERNAL_COMMAND: z.string().min(1).optional(),

  /**
   * Maximum bounded repair iterations the scene-authoring agent performs
   * (packages/llm) when a pipeline pass returns IR-fixable gaps. The agent
   * always runs at least one authoring pass; this caps the RE-prompts after
   * it, so total LLM round-trips are `AUTHORING_MAX_REPAIRS + 1`. On
   * exhaustion the agent returns the best artifact plus the outstanding gaps
   * — never a silently-invalid document.
   */
  AUTHORING_MAX_REPAIRS: z.coerce.number().int().nonnegative().default(2),

  // AI / LLM
  /**
   * Default provider and model.
   *
   * These match what `.env.example`, the README and the startup guide all
   * document as the default setup — a local Ollama, no API key. They used to
   * default to `openai` / `gpt-4o` instead, which contradicted every one of
   * those documents and, because the cross-field check below requires
   * `OPENAI_API_KEY` for that provider, meant a machine with no `.env.local`
   * could not start at all. Defaults now describe a configuration that runs.
   */
  AI_PROVIDER: aiProviderSchema.default('ollama'),
  AI_MODEL: z.string().min(1).default('qwen3:8b'),
  /**
   * Optional model override for the GENERATIVE authoring agent (NL → `.xosc`).
   * Authoring is scenario composition, not the deterministic slot-filling of
   * search, so it benefits from a stronger, reasoning-capable model. When unset,
   * authoring reuses `AI_MODEL`. Example (Copilot provider): `claude-opus-4.8`.
   */
  AUTHORING_AI_MODEL: z.string().min(1).optional(),
  /**
   * Copilot reasoning effort for the authoring agent. Unlike search — which
   * forces `none` because slot-filling is deterministic and SHACL-validated —
   * authoring turns reasoning ON so the model captures nuanced dynamics
   * (relative speeds, "slows down", timing). Applied only for the `copilot`
   * provider; other providers reason via `LLM_THINKING` / a model family.
   */
  AUTHORING_REASONING_EFFORT: reasoningEffortSchema.default('medium'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  /** GitHub token for the Copilot SDK. Sourced from env or `gh auth token`. */
  GITHUB_TOKEN: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434/v1'),
  /**
   * Base URL for the Mistral OpenAI-compatible API, used by the
   * `vibe-cli` provider (which reuses the API key the Mistral `vibe`
   * CLI stored in `~/.vibe/.env`). Defaults to Mistral's hosted
   * endpoint; override to point at a local model server.
   */
  MISTRAL_BASE_URL: z.string().url().default('https://api.mistral.ai/v1'),
  /** Maximum tool-calling steps the Vercel-SDK agent will perform. */
  LLM_MAX_AGENT_STEPS: z.coerce.number().int().positive().default(3),

  // Outbound HTTP proxy. Declared here for documentation and discoverability
  // only — the values are consumed by undici's `EnvHttpProxyAgent`, which reads
  // `process.env` itself (including the lowercase spellings `https_proxy` /
  // `http_proxy` / `no_proxy`, which are equally honoured but not restated
  // here). See `../net/proxy.ts`; same pattern as the logger's `LOG_LEVEL`.
  // Node does NOT apply these to `fetch` on its own, which is why the API
  // installs a dispatcher at startup.
  /** Proxy for outbound HTTPS, e.g. `http://proxy.example.corp:8080`. */
  HTTPS_PROXY: z.string().optional(),
  /** Proxy for outbound HTTP. */
  HTTP_PROXY: z.string().optional(),
  /** Comma-separated hosts that bypass the proxy, e.g. `localhost,127.0.0.1`. */
  NO_PROXY: z.string().optional(),
  /**
   * Sampling temperature passed to the LLM — an OPT-IN override, unset by
   * default so no sampling parameter is sent at all.
   *
   * It cannot default to `0`: `temperature` (with `top_p` / `top_k`) was
   * REMOVED from the Anthropic Messages API in the Claude 4.7 generation, and
   * every model from that generation on — including the default `AI_MODEL`
   * `claude-sonnet-5` — rejects a non-default value with
   * `400 "temperature is deprecated for this model"`
   * [ANTHROPIC-MSG] `/v1/messages` § Request. Sending a default of `0`
   * therefore failed every single search request on the default configuration.
   *
   * Determinism does not depend on this knob: the LLM only ever fills
   * `SearchSlots` through one tool call, and the SPARQL compiler is
   * deterministic given those slots.
   *
   * Set it only for a provider/model that still accepts sampling parameters
   * (openai, ollama, vibe-cli, or a pre-4.7 Anthropic model). On a model that
   * removed them the provider's own 400 surfaces — the value is never silently
   * discarded. The Copilot SDK doesn't expose this knob and ignores it.
   */
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).optional(),
  /**
   * Anthropic-only reasoning mode. Three accepted forms:
   *
   *   - `off` (default) — no reasoning; same speed as a plain completion.
   *   - `adaptive`      — the model decides when and how deeply to think.
   *   - a positive int  — a fixed hidden chain-of-thought token budget
   *                       (Anthropic recommends ≥ 1024).
   *
   * The mode is explicit rather than inferred because the two on-modes are
   * NOT interchangeable across model generations, and picking the wrong one
   * is a hard 400 rather than a downgrade [ANTHROPIC-MSG] `/v1/messages`
   * § Request:
   *
   *   - `adaptive` requires Claude 4.6 or newer (through Sonnet 5 / Opus 5).
   *     Older models reject it.
   *   - A fixed budget (`thinking.budget_tokens`) was REMOVED in the Claude
   *     4.7 generation; 4.7 and newer reject it. It remains the only way to
   *     enable reasoning on pre-4.6 models such as `claude-haiku-4-5` and
   *     `claude-sonnet-4-5`.
   *
   * Since only the operator knows which model `AI_MODEL` points at, this is
   * a deliberate choice rather than something the code guesses from a model
   * allowlist — the same reasoning as {@link LLM_TEMPERATURE}.
   *
   * Ignored by every other Vercel-SDK provider:
   *   - Mistral exposes reasoning via a separate model family
   *     (`magistral-*`); change `AI_MODEL` to enable it there.
   *   - OpenAI `o1` / `o4` are reasoning-by-design; the budget is
   *     fixed by the model, not the caller.
   *   - Ollama and the local providers don't implement this concept.
   */
  LLM_THINKING: z
    // Order matters: the enum is tried first, because `z.coerce.number()`
    // would turn 'off' into NaN and report a misleading "expected number".
    .union([z.enum(['off', 'adaptive']), z.coerce.number().int().positive()])
    .default('off'),
  /**
   * Schema-retrieval routing budget: at most this many primary domains are
   * selected per query for the composed system prompt.
   */
  RETRIEVAL_MAX_DOMAINS: z.coerce.number().int().positive().default(3),
  /** Schema-retrieval selection budget: at most this many term cards per query. */
  RETRIEVAL_MAX_CARDS: z.coerce.number().int().positive().default(40),
  /**
   * Bound on the raw SHACL fragment payload per query, in characters.
   * Overflowing fragments degrade to distilled one-line cards (coverage is
   * kept), so the composed prompt stays bounded even when upstream shapes
   * grow.
   */
  RETRIEVAL_MAX_CONTEXT_CHARS: z.coerce.number().int().positive().default(45_000),

  // Ontology
  /**
   * Single directory of ontology artifacts, overriding the default cache. The
   * default source is the distribution pinned in `ontology-package.json`,
   * materialized into `.ontology/` by `scripts/fetch-ontology.mjs`; this is for
   * deployments that mount the artifacts elsewhere.
   */
  ONTOLOGY_ARTIFACTS_PATH: z.string().optional(),
  /**
   * Override the workspace root for ontology source discovery. Used by tests
   * that seed a temp workspace, and by deployments that mount the artifacts
   * at a non-default path.
   */
  ONTOLOGY_ROOT: z.string().optional(),

  // API
  /** Port the API HTTP server listens on. */
  API_PORT: z.coerce.number().int().positive().default(3003),
  /** Maximum incoming request body size in bytes; larger payloads are rejected. */
  API_MAX_BODY_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(64 * 1024),
  /**
   * Maximum length (characters) of a natural-language search `query`. Bounds
   * the prompt forwarded to the LLM: the body-size limit caps the whole request,
   * but within that an arbitrarily long `query` is an unbounded LLM-cost /
   * latency amplification vector, so the query string is capped separately.
   */
  API_MAX_QUERY_CHARS: z.coerce.number().int().positive().default(2000),
  /**
   * Comma-separated list of allowed CORS origins. The literal `*` means
   * "any origin" (development default). For production, set to the
   * scheme+host(:port) of every browser frontend that may call the API;
   * any other origin is rejected at the CORS preflight.
   *
   * Cross-validated below: NODE_ENV=production + `*` fails fast.
   */
  CORS_ALLOWED_ORIGINS: z.string().default('*'),
  /**
   * Token-bucket rate limit, average requests per second. `0` disables
   * rate limiting entirely (development default). Per-client buckets
   * are keyed by `x-forwarded-for` (or `x-real-ip`, or a shared key
   * when no forwarded header is set).
   */
  RATE_LIMIT_RPS: z.coerce.number().nonnegative().default(0),
  /**
   * Token-bucket burst capacity. Allows short spikes above the RPS
   * average before requests start getting throttled. Only consulted
   * when `RATE_LIMIT_RPS > 0`.
   */
  RATE_LIMIT_BURST: z.coerce.number().int().positive().default(10),
  /**
   * Optional API key for request authentication. Empty (the default) leaves
   * the API open — correct for local development and for deployments that
   * terminate authentication at an upstream gateway. When set, every request
   * except the `/health` readiness probe must present the key, as either
   * `Authorization: Bearer <key>` or `x-api-key: <key>`; mismatches get 401.
   */
  API_KEY: z.string().optional(),
  /**
   * Explicit acknowledgement that the API may run WITHOUT authentication in
   * production (e.g. it sits behind a gateway / trusted network that
   * authenticates upstream). Required to start in production when `API_KEY`
   * is empty — see the cross-field guard below. Default `false` so an open
   * public deployment can't happen by accident (fail-safe, mirroring the
   * `CORS_ALLOWED_ORIGINS="*"` production guard).
   */
  API_ALLOW_UNAUTHENTICATED: z.stringbool().default(false),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).optional(),

  // Feature flags
  /**
   * Enable the GraphQL intermediate layer: schema endpoint, GraphQL
   * serialization in SSE stream, and the inline editor in the web UI.
   * Defaults to `true` in development for immediate visibility; set to
   * `false` to hide the feature entirely (endpoints return 404, SSE
   * omits the `graphql` event, UI hides the editor step).
   */
  FEATURE_GRAPHQL_LAYER: z.stringbool().default(true),

  // Runtime (set by the process manager / test runner, never by the operator)
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type AppConfig = z.infer<typeof envSchema>

/**
 * Every environment variable this schema reads.
 *
 * Exported so tooling can check a `.env.local` against the real contract
 * instead of a hand-maintained copy of it — a variable that exists here but is
 * undocumented in `.env.example` is invisible to operators, and a variable
 * documented there but absent here is silently ignored at runtime. A drift
 * test asserts the two agree.
 */
export const CONFIG_ENV_KEYS: readonly string[] = Object.keys(envSchema.shape)

let cachedConfig: AppConfig | null = null

/**
 * ` (received: "…")` for a value rejected against a closed vocabulary, else
 * the empty string.
 *
 * Zod lists the accepted options but not what it got, which hides the two most
 * common causes outright: a stray quote or trailing space (`"ollama "`), and a
 * case mismatch.
 *
 * Only `invalid_value` issues are echoed, and that is the safety rule as much
 * as a formatting one: the code is raised exclusively by the enum/boolean
 * settings above, every one of which is a documented vocabulary in
 * `.env.example`. Credentials are free-form strings — they cannot produce this
 * issue — so no secret can reach the message. Keep it that way: do not extend
 * this to other issue codes.
 */
function receivedSuffix(issue: { code: string; path: PropertyKey[] }): string {
  if (issue.code !== 'invalid_value') return ''
  const key = String(issue.path[0] ?? '')
  const received = key ? process.env[key] : undefined
  return received === undefined ? '' : ` (received: ${JSON.stringify(received)})`
}

/**
 * Parse and validate environment variables into a typed config object.
 * Cached after first successful parse.
 *
 * @throws {ConfigError} with detailed validation messages on invalid config
 */
export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}${receivedSuffix(issue)}`)
      .join('\n')
    throw new ConfigError(`Invalid environment configuration:\n${formatted}`)
  }

  // Validate cross-field constraints
  if (result.data.SPARQL_MODE === 'remote' && !result.data.SPARQL_ENDPOINT) {
    throw new ConfigError('SPARQL_ENDPOINT is required when SPARQL_MODE is "remote"')
  }
  if (result.data.SPARQL_DEFAULT_LIMIT > result.data.SPARQL_MAX_LIMIT) {
    throw new ConfigError(
      `SPARQL_DEFAULT_LIMIT (${result.data.SPARQL_DEFAULT_LIMIT}) must be ≤ SPARQL_MAX_LIMIT (${result.data.SPARQL_MAX_LIMIT}); the compiler default would be rejected by the policy gate.`
    )
  }
  if (result.data.NODE_ENV === 'production' && result.data.CORS_ALLOWED_ORIGINS.trim() === '*') {
    throw new ConfigError(
      'CORS_ALLOWED_ORIGINS="*" is unsafe in production. Set it to a comma-separated list of exact frontend origins (e.g. "https://app.example.com").'
    )
  }
  // Only enforce API key requirements outside of test environment
  if (result.data.NODE_ENV !== 'test') {
    if (result.data.AI_PROVIDER === 'openai' && !result.data.OPENAI_API_KEY) {
      throw new ConfigError('OPENAI_API_KEY is required when AI_PROVIDER is "openai"')
    }
    if (result.data.AI_PROVIDER === 'anthropic' && !result.data.ANTHROPIC_API_KEY) {
      throw new ConfigError('ANTHROPIC_API_KEY is required when AI_PROVIDER is "anthropic"')
    }
    // Fail-safe auth posture: a production API must not be left open by accident.
    // Require either an API key, or an explicit opt-out for deployments that
    // authenticate upstream (gateway / trusted network). Runs after the
    // provider-key checks so their more specific error surfaces first.
    if (
      result.data.NODE_ENV === 'production' &&
      !result.data.API_KEY &&
      !result.data.API_ALLOW_UNAUTHENTICATED
    ) {
      throw new ConfigError(
        'No API authentication configured in production. Set API_KEY to require a key, ' +
          'or set API_ALLOW_UNAUTHENTICATED=true to run open deliberately (e.g. behind a ' +
          'gateway that authenticates). /search invokes an LLM per request, so an ' +
          'unauthenticated public endpoint is a cost/abuse risk.'
      )
    }
  }

  cachedConfig = result.data
  return cachedConfig
}

/**
 * Reset cached config (for testing purposes only).
 */
export function resetConfig(): void {
  cachedConfig = null
}
