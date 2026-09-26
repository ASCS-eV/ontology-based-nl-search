/**
 * The unmodified Claude Code binary, run headless, as the LLM transport of the
 * `claude-code` provider.
 *
 * Why the binary rather than its token: Anthropic designs subscription (OAuth)
 * sign-in for Claude Code itself and states that developers "may not collect,
 * store, or intermediate Claude.ai credentials or session tokens", while it
 * does not prevent "an end user from signing in to the unmodified Claude Code
 * binary with their own Claude subscription" [CLAUDE-CODE-LEGAL] § Authentication
 * and credential use. So this module never reads a credential. It starts the
 * user's own `claude`, which authenticates however the user set it up, and
 * serves whichever model their plan includes — Sonnet and Opus among them,
 * which the API refuses to the bare subscription token outside Claude Code.
 *
 * A search query is untrusted input, so the session it runs in is given
 * nothing to act with [CLAUDE-CODE-CLI]:
 *
 *   --safe-mode                 no CLAUDE.md, hooks, plugins, skills, MCP servers
 *   --tools ""                  no built-in tools: no shell, no file access
 *   --strict-mcp-config         no MCP servers beyond --mcp-config (none given)
 *   --permission-prompts none   anything that would ask for permission is denied
 *   --no-session-persistence    no transcript under ~/.claude/projects
 *
 * It runs in a fresh, empty working directory. The one thing the model can do
 * is return the structured output that `--json-schema` describes, and callers
 * validate that with the canonical Zod schema before anything downstream sees
 * it — the same slot boundary every other provider goes through.
 *
 * [CLAUDE-CODE-LEGAL] https://code.claude.com/docs/en/legal-and-compliance
 * [CLAUDE-CODE-CLI]   https://code.claude.com/docs/en/cli-reference
 */
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { getConfig } from '@ontology-search/core/config'
import { AgentError } from '@ontology-search/core/errors'
import { createComponentLogger } from '@ontology-search/core/logging'
import { z } from 'zod'

const log = createComponentLogger('claude-code')

/** Ceiling for one headless run — the same bound a Copilot turn gets. */
const RUN_TIMEOUT_MS = 120_000
/** `claude auth status` answers from local state; a slow answer is a stuck binary. */
const STATUS_TIMEOUT_MS = 15_000
/** What is buffered from the child's stdout; a result object is a few KB. */
const MAX_STDOUT_BYTES = 8 * 1024 * 1024
/** What is kept of stderr, for error messages only. */
const MAX_STDERR_CHARS = 2_000

/**
 * Credentials the API process may hold for OTHER providers. Claude Code needs
 * none of them, and `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` would switch it
 * from the user's subscription to API-key billing — the opposite of what this
 * provider is for.
 */
const WITHHELD_ENV = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'OPENAI_API_KEY',
  'GITHUB_TOKEN',
  'API_KEY',
] as const

/**
 * The child's environment: the API process's own, minus {@link WITHHELD_ENV},
 * plus `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, which skips the telemetry,
 * error-reporting and update checks the CLI otherwise starts on every launch.
 * Measured on this path: ~1.7 s → ~0.4 s of per-request overhead.
 *
 * The one `process.env` read here is not a source of configuration — every
 * setting this module reads comes from `getConfig()`. It is passed through
 * because the child needs its parent's `HOME` (where Claude Code keeps its own
 * sign-in), `PATH` and proxy settings — the arrangement `bundle-runner.ts`
 * uses for its subprocesses.
 */
export function claudeCodeEnv(
  // eslint-disable-next-line no-restricted-syntax
  env: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const child: NodeJS.ProcessEnv = { ...env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' }
  for (const key of WITHHELD_ENV) delete child[key]
  return child
}

/**
 * The JSON Schema `--json-schema` takes, generated from a Zod schema.
 *
 * Generated as JSON Schema 2020-12 [JSON-SCHEMA-CORE], the dialect of the
 * published slot and scene artifacts, minus the `$schema` declaration: the
 * CLI's validator registers no 2020-12 meta-schema and rejects the document
 * outright ("no schema with key or ref …/draft/2020-12/schema"). The keywords
 * the slot and scene schemas use — `type`, `properties`, `required`, `items`,
 * `enum`, `anyOf`, `propertyNames`, `additionalProperties`, and `$ref` pointers
 * into `$defs`, which resolve as plain JSON Pointers — validate the same way
 * without it, so the contract is unchanged.
 */
export function toCliJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json: Record<string, unknown> = { ...z.toJSONSchema(schema, { target: 'draft-2020-12' }) }
  delete json['$schema']
  return json
}

export interface ClaudeCodeRunOptions {
  /** `--model`: a full id (`claude-sonnet-5`) or an alias the CLI resolves (`sonnet`, `opus`). */
  model: string
  systemPrompt: string
  /** The user turn. Written to stdin — never argv, so it has no length limit and never shows in `ps`. */
  userMessage: string
  /** From {@link toCliJsonSchema}. */
  jsonSchema: Record<string, unknown>
  signal?: AbortSignal
  /** Defaults to `CLAUDE_CODE_EXECUTABLE`. */
  executable?: string
  timeoutMs?: number
}

export interface ClaudeCodeRunResult {
  /** The structured output, NOT yet validated: callers parse it with their Zod schema. */
  structuredOutput: unknown
  numTurns: number | undefined
  durationApiMs: number | undefined
}

/** The fields read from the CLI's `--output-format json` result object. */
const cliResultSchema = z.object({
  is_error: z.boolean().optional(),
  result: z.string().optional(),
  api_error_status: z.number().nullable().optional(),
  structured_output: z.unknown().optional(),
  num_turns: z.number().optional(),
  duration_api_ms: z.number().optional(),
})
type CliResult = z.infer<typeof cliResultSchema>

/** Advice for a missing or signed-out login, shared by the run and the startup check. */
export function claudeCodeLoginAdvice(): string {
  return (
    'Claude Code is not signed in. Run `claude` and sign in with your Claude account ' +
    '(or `claude auth login`). No API restart is needed: every request starts a fresh ' +
    '`claude` process.'
  )
}

function missingExecutableAdvice(executable: string): string {
  return (
    `Claude Code ("${executable}") was not found. Install it ` +
    '(https://code.claude.com/docs/en/setup) and sign in, or set CLAUDE_CODE_EXECUTABLE ' +
    'to the full path of the `claude` binary.'
  )
}

function context(model: string): string {
  return ` (AI_PROVIDER=claude-code, AI_MODEL=${model})`
}

function stderrNote(stderr: string): string {
  const line = stderr.trim().split('\n')[0]?.trim()
  return line ? ` It said: ${line.slice(0, 300)}` : ''
}

/** How the CLI words a missing or rejected login. */
const NOT_SIGNED_IN = /not logged in|please run \/login|invalid api key/i

/**
 * Turn a result the CLI flagged `is_error` into an actionable error. Only two
 * faults are the operator's to fix here — the model and the login — and each
 * gets its own advice. Anything else (a usage limit, an overloaded model, a
 * network failure) keeps the CLI's own message, which is already written for a
 * person; rewording it would only lose detail.
 */
export function cliErrorToAgentError(result: CliResult, model: string): AgentError {
  const message = result.result?.trim() || 'Claude Code reported an error without a message.'
  if (result.api_error_status === 404) {
    return new AgentError(
      `Claude Code has no model "${model}" available to this login (AI_MODEL). Use a model ` +
        'your plan includes: an alias such as "sonnet" or "opus" resolves to the latest one, ' +
        `or a full id such as "claude-sonnet-5".${context(model)}`
    )
  }
  if (
    result.api_error_status === 401 ||
    result.api_error_status === 403 ||
    NOT_SIGNED_IN.test(message)
  ) {
    return new AgentError(`${claudeCodeLoginAdvice()}${context(model)}`)
  }
  return new AgentError(`Claude Code could not complete the request: ${message}${context(model)}`)
}

interface ProcessOutcome {
  stdout: string
  stderr: string
  code: number | null
}

interface ProcessOptions {
  cwd: string
  input: string
  timeoutMs: number
  signal?: AbortSignal | undefined
  model: string
}

/**
 * Spawn the CLI and collect its output. A caller's abort rejects with the
 * caller's own reason (a cancelled request is not a fault and must not be
 * reported as one); our timeout and a missing binary become actionable
 * errors. The shell is never involved — arguments go to the binary verbatim.
 */
function runProcess(
  executable: string,
  args: readonly string[],
  options: ProcessOptions
): Promise<ProcessOutcome> {
  return new Promise((resolve, reject) => {
    const timeout = AbortSignal.timeout(options.timeoutMs)
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: claudeCodeEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
      signal,
    })

    let settled = false
    const stdout: Buffer[] = []
    let stdoutBytes = 0
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length
      if (stdoutBytes <= MAX_STDOUT_BYTES) stdout.push(chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_STDERR_CHARS) stderr += chunk.toString('utf8')
    })

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (settled) return
      settled = true
      if (error.name === 'AbortError') {
        reject(
          options.signal?.aborted
            ? (options.signal.reason ?? error)
            : new AgentError(
                `Claude Code did not answer within ${options.timeoutMs / 1000} s.` +
                  context(options.model)
              )
        )
        return
      }
      if (error.code === 'ENOENT') {
        reject(new AgentError(missingExecutableAdvice(executable)))
        return
      }
      reject(error)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      resolve({ stdout: Buffer.concat(stdout).toString('utf8'), stderr, code })
    })

    // EPIPE when the child exits before reading stdin; `close` reports the outcome.
    child.stdin.on('error', () => {})
    child.stdin.end(options.input)
  })
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/**
 * Run one headless Claude Code turn that must answer with structured output.
 *
 * Resolves with the structured output (unvalidated) or throws an
 * {@link AgentError} naming the setting or command that fixes the failure.
 */
export async function runClaudeCodeStructured(
  options: ClaudeCodeRunOptions
): Promise<ClaudeCodeRunResult> {
  const executable = options.executable ?? getConfig().CLAUDE_CODE_EXECUTABLE
  // Fresh and empty: nothing for the session to discover, and the system
  // prompt file is removed with it.
  const workDir = await mkdtemp(join(tmpdir(), 'ontology-search-claude-'))
  try {
    const promptFile = join(workDir, 'system-prompt.md')
    await writeFile(promptFile, options.systemPrompt, { mode: 0o600 })
    const args = [
      '--print',
      '--safe-mode',
      '--tools',
      '',
      '--strict-mcp-config',
      '--permission-prompts',
      'none',
      '--no-session-persistence',
      '--output-format',
      'json',
      '--model',
      options.model,
      '--system-prompt-file',
      promptFile,
      '--json-schema',
      JSON.stringify(options.jsonSchema),
    ]
    const { stdout, stderr, code } = await runProcess(executable, args, {
      cwd: workDir,
      input: options.userMessage,
      timeoutMs: options.timeoutMs ?? RUN_TIMEOUT_MS,
      signal: options.signal,
      model: options.model,
    })

    const parsed = cliResultSchema.safeParse(parseJson(stdout))
    if (!parsed.success) {
      throw new AgentError(
        `Claude Code exited (code ${code ?? 'none'}) without a result.${stderrNote(stderr)}` +
          context(options.model)
      )
    }
    if (parsed.data.is_error) throw cliErrorToAgentError(parsed.data, options.model)
    return {
      structuredOutput: parsed.data.structured_output,
      numTurns: parsed.data.num_turns,
      durationApiMs: parsed.data.duration_api_ms,
    }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

const authStatusSchema = z.object({
  loggedIn: z.boolean(),
  authMethod: z.string().optional(),
  subscriptionType: z.string().nullable().optional(),
})

/**
 * Startup check: the binary runs and is signed in. `claude auth status`
 * answers from local state, so this costs no model call and no quota — the
 * model itself is checked by the first request, like every cloud provider.
 */
export async function verifyClaudeCodeLogin(options: { executable?: string } = {}): Promise<void> {
  const config = getConfig()
  const executable = options.executable ?? config.CLAUDE_CODE_EXECUTABLE
  const { stdout, stderr, code } = await runProcess(executable, ['auth', 'status'], {
    cwd: tmpdir(),
    input: '',
    timeoutMs: STATUS_TIMEOUT_MS,
    model: config.AI_MODEL,
  })
  const status = authStatusSchema.safeParse(parseJson(stdout))
  if (!status.success) {
    throw new AgentError(
      `Could not read \`${executable} auth status\` (exit code ${code ?? 'none'}).${stderrNote(stderr)}`
    )
  }
  if (!status.data.loggedIn) throw new AgentError(claudeCodeLoginAdvice())
  // The auth method and plan only — never the account's email or organisation.
  log.info('Claude Code login verified', {
    authMethod: status.data.authMethod,
    subscriptionType: status.data.subscriptionType,
  })
}
