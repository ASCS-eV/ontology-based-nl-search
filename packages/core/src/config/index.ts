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
const aiProviderSchema = z.enum([
  'openai',
  'ollama',
  'copilot',
  'anthropic',
  'claude-cli',
  'vibe-cli',
])

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

  // AI / LLM
  AI_PROVIDER: aiProviderSchema.default('openai'),
  AI_MODEL: z.string().min(1).default('gpt-4o'),
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
  /**
   * Sampling temperature passed to the LLM. Slot-filling is an
   * extraction task, so `0` (greedy decoding — same input always
   * yields the same output) is the right default. Honoured by every
   * Vercel-SDK provider (openai, ollama, anthropic, claude-cli,
   * vibe-cli). The Copilot SDK doesn't expose this knob and ignores
   * it. Raise above 0 only when intentionally introducing variance
   * (e.g. A/B comparisons or creative-task experiments).
   */
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0),
  /**
   * Anthropic-only: token budget for the model's hidden
   * chain-of-thought. `0` (default) disables reasoning — same speed as
   * the regular chat completion. Set to a positive integer (Anthropic
   * recommends ≥ 1024) to enable; the answer becomes more accurate on
   * hard disambiguation cases but the call takes 2–5× longer.
   *
   * Ignored by every other Vercel-SDK provider:
   *   - Mistral exposes reasoning via a separate model family
   *     (`magistral-*`); change `AI_MODEL` to enable it there.
   *   - OpenAI `o1` / `o4` are reasoning-by-design; the budget is
   *     fixed by the model, not the caller.
   *   - Ollama and the local providers don't implement this concept.
   */
  LLM_THINKING_BUDGET: z.coerce.number().int().nonnegative().default(0),
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
  ONTOLOGY_REPO: z.string().default('ASCS-eV/ontology-management-base'),
  ONTOLOGY_BRANCH: z.string().default('main'),
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

  // Runtime (set by Next.js)
  NEXT_RUNTIME: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type AppConfig = z.infer<typeof envSchema>

let cachedConfig: AppConfig | null = null

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
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
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
