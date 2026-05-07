import { z } from 'zod'

/**
 * Centralized, validated application configuration.
 *
 * All environment variable access is consolidated here.
 * The schema is validated once at startup — invalid config
 * fails fast with clear error messages.
 */

const sparqlModeSchema = z.enum(['memory', 'remote'])
const aiProviderSchema = z.enum(['openai', 'ollama', 'copilot'])

const envSchema = z.object({
  // SPARQL Store
  SPARQL_MODE: sparqlModeSchema.default('memory'),
  SPARQL_ENDPOINT: z.string().url().optional(),
  SPARQL_CACHE_SIZE: z.coerce.number().int().positive().default(256),
  SPARQL_CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(300_000),

  // AI / LLM
  AI_PROVIDER: aiProviderSchema.default('openai'),
  AI_MODEL: z.string().min(1).default('gpt-4o'),
  OPENAI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434/v1'),

  // Ontology
  ONTOLOGY_REPO: z.string().default('ASCS-eV/ontology-management-base'),
  ONTOLOGY_BRANCH: z.string().default('main'),
  ONTOLOGY_ARTIFACTS_PATH: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).optional(),

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
 * @throws {Error} with detailed validation messages on invalid config
 */
export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${formatted}`)
  }

  // Validate cross-field constraints
  if (result.data.SPARQL_MODE === 'remote' && !result.data.SPARQL_ENDPOINT) {
    throw new Error('SPARQL_ENDPOINT is required when SPARQL_MODE is "remote"')
  }

  // Only enforce API key requirements outside of test environment
  if (result.data.NODE_ENV !== 'test') {
    if (result.data.AI_PROVIDER === 'openai' && !result.data.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER is "openai"')
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
