/**
 * Contract tests for the headless Claude Code transport.
 *
 * They run the real spawn path against a fake `claude` — a small Node script
 * that records what it was started with and answers like the CLI does — so
 * the properties that matter are pinned without a network call:
 *
 *  - the session is isolated: no tools, no CLAUDE.md/hooks/MCP, no transcript,
 *    a fresh empty working directory that is removed afterwards;
 *  - no credential of the app's reaches the child, and nothing the child needs
 *    is put on argv where `ps` shows it (the user turn goes to stdin);
 *  - every failure an operator can fix names the fix; a caller's abort is
 *    passed through as-is, never reported as a fault.
 */
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { AgentError } from '@ontology-search/core/errors'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { slotSubmissionSchema } from '../agent/tools.js'
import {
  claudeCodeEnv,
  runClaudeCodeStructured,
  toCliJsonSchema,
  verifyClaudeCodeLogin,
} from '../claude-code-cli.js'

/** Answers like `claude -p --output-format json` / `claude auth status`, per FAKE_CLAUDE_MODE. */
const FAKE_CLAUDE = `#!${process.execPath}
const fs = require('node:fs')
const args = process.argv.slice(2)
const mode = process.env.FAKE_CLAUDE_MODE || 'success'
let stdin = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => (stdin += chunk))
process.stdin.on('end', () => {
  const promptAt = args.indexOf('--system-prompt-file')
  if (process.env.FAKE_CLAUDE_RECORD) {
    fs.writeFileSync(process.env.FAKE_CLAUDE_RECORD, JSON.stringify({
      args,
      stdin,
      cwd: process.cwd(),
      systemPrompt: promptAt >= 0 ? fs.readFileSync(args[promptAt + 1], 'utf8') : null,
      env: Object.fromEntries(
        ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'OPENAI_API_KEY', 'GITHUB_TOKEN', 'API_KEY',
         'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', 'HOME'].map((k) => [k, process.env[k] ?? null])
      ),
    }))
  }
  const result = (fields) => process.stdout.write(JSON.stringify({ type: 'result', ...fields }))
  switch (mode) {
    case 'success':
      result({ is_error: false, num_turns: 2, duration_api_ms: 1234, structured_output: { ok: true } })
      break
    case 'bad-model':
      result({ is_error: true, api_error_status: 404, result: "There's an issue with the selected model" })
      process.exitCode = 1
      break
    case 'signed-out':
      result({ is_error: true, api_error_status: null, result: 'Not logged in · Please run /login' })
      process.exitCode = 1
      break
    case 'usage-limit':
      result({ is_error: true, api_error_status: 429, result: 'Claude usage limit reached. Resets at 5pm.' })
      process.exitCode = 1
      break
    case 'no-result':
      process.stderr.write('Error: --json-schema is not a valid JSON Schema\\n')
      process.exitCode = 1
      break
    case 'hang':
      setTimeout(() => {}, 60000)
      break
    case 'auth-in':
      process.stdout.write(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'team' }))
      break
    case 'auth-out':
      process.stdout.write(JSON.stringify({ loggedIn: false, authMethod: 'none' }))
      break
  }
})
`

let dir: string
let executable: string
let recordPath: string
const TOUCHED_ENV = ['FAKE_CLAUDE_MODE', 'FAKE_CLAUDE_RECORD', 'ANTHROPIC_API_KEY', 'GITHUB_TOKEN']
const savedEnv = new Map<string, string | undefined>()

interface Record {
  args: string[]
  stdin: string
  cwd: string
  systemPrompt: string | null
  env: { [key: string]: string | null }
}
const readRecord = (): Record => JSON.parse(readFileSync(recordPath, 'utf8')) as Record

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'fake-claude-'))
  executable = join(dir, 'claude')
  writeFileSync(executable, FAKE_CLAUDE)
  chmodSync(executable, 0o755)
  recordPath = join(dir, 'record.json')
  for (const key of TOUCHED_ENV) savedEnv.set(key, process.env[key])
  process.env['FAKE_CLAUDE_RECORD'] = recordPath
})

afterEach(() => {
  delete process.env['FAKE_CLAUDE_MODE']
  delete process.env['ANTHROPIC_API_KEY']
  delete process.env['GITHUB_TOKEN']
  rmSync(recordPath, { force: true })
})

afterAll(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  rmSync(dir, { recursive: true, force: true })
})

const baseRun = () => ({
  model: 'claude-sonnet-5',
  systemPrompt: 'SYSTEM PROMPT',
  userMessage: 'German highways with 3 lanes',
  jsonSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
  executable,
})

function mode(value: string): void {
  process.env['FAKE_CLAUDE_MODE'] = value
}

describe('runClaudeCodeStructured', () => {
  it('runs the binary isolated and returns its structured output', async () => {
    mode('success')
    const result = await runClaudeCodeStructured(baseRun())

    expect(result).toEqual({ structuredOutput: { ok: true }, numTurns: 2, durationApiMs: 1234 })
    const { args, stdin, cwd, systemPrompt } = readRecord()
    // Nothing to act with: no tools, no customizations, no MCP, no prompts, no transcript.
    expect(args).toContain('--print')
    expect(args).toContain('--safe-mode')
    expect(args.slice(args.indexOf('--tools'), args.indexOf('--tools') + 2)).toEqual([
      '--tools',
      '',
    ])
    expect(args).toContain('--strict-mcp-config')
    expect(
      args.slice(args.indexOf('--permission-prompts'), args.indexOf('--permission-prompts') + 2)
    ).toEqual(['--permission-prompts', 'none'])
    expect(args).toContain('--no-session-persistence')
    expect(args.slice(args.indexOf('--model'), args.indexOf('--model') + 2)).toEqual([
      '--model',
      'claude-sonnet-5',
    ])
    expect(JSON.parse(args[args.indexOf('--json-schema') + 1] ?? '')).toEqual(baseRun().jsonSchema)
    // The prompt travels in a file and the user turn on stdin — neither on argv.
    expect(systemPrompt).toBe('SYSTEM PROMPT')
    expect(stdin).toBe('German highways with 3 lanes')
    expect(args.join(' ')).not.toContain('German highways')
    // A fresh working directory, gone afterwards with the prompt file in it.
    expect(cwd).not.toBe(process.cwd())
    expect(existsSync(cwd)).toBe(false)
  })

  it("withholds the app's credentials from the child and skips nonessential traffic", async () => {
    mode('success')
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-would-switch-billing'
    process.env['GITHUB_TOKEN'] = 'gho_not-for-claude'

    await runClaudeCodeStructured(baseRun())

    const { env } = readRecord()
    expect(env['ANTHROPIC_API_KEY']).toBeNull()
    expect(env['GITHUB_TOKEN']).toBeNull()
    expect(env['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC']).toBe('1')
    // Claude Code finds its own sign-in through HOME, so that must survive.
    expect(env['HOME']).toBe(process.env['HOME'])
  })

  it('names the model and the aliases to use when the CLI reports it unavailable', async () => {
    mode('bad-model')
    const run = runClaudeCodeStructured({ ...baseRun(), model: 'claude-nope' })
    await expect(run).rejects.toBeInstanceOf(AgentError)
    await expect(run).rejects.toThrow(/no model "claude-nope".*"sonnet" or "opus"/)
  })

  it('tells the user how to sign in when Claude Code is signed out', async () => {
    mode('signed-out')
    await expect(runClaudeCodeStructured(baseRun())).rejects.toThrow(/claude auth login/)
  })

  it("keeps the CLI's own wording for faults that are not configuration", async () => {
    mode('usage-limit')
    await expect(runClaudeCodeStructured(baseRun())).rejects.toThrow(
      /Claude usage limit reached\. Resets at 5pm\..*AI_PROVIDER=claude-code/
    )
  })

  it('reports what the CLI printed when it exits without a result', async () => {
    mode('no-result')
    await expect(runClaudeCodeStructured(baseRun())).rejects.toThrow(
      /without a result\. It said: Error: --json-schema is not a valid JSON Schema/
    )
  })

  it('points a missing executable at the install docs and CLAUDE_CODE_EXECUTABLE', async () => {
    const run = runClaudeCodeStructured({ ...baseRun(), executable: join(dir, 'no-such-claude') })
    await expect(run).rejects.toBeInstanceOf(AgentError)
    await expect(run).rejects.toThrow(/was not found.*CLAUDE_CODE_EXECUTABLE/)
  })

  it("passes a caller's abort through as-is and stops the run", async () => {
    mode('hang')
    const controller = new AbortController()
    const run = runClaudeCodeStructured({ ...baseRun(), signal: controller.signal })
    setTimeout(() => controller.abort(new Error('client went away')), 100)
    await expect(run).rejects.toThrow('client went away')
  })

  it('turns its own timeout into an actionable error', async () => {
    mode('hang')
    await expect(runClaudeCodeStructured({ ...baseRun(), timeoutMs: 300 })).rejects.toThrow(
      /did not answer within 0\.3 s/
    )
  })
})

describe('claudeCodeEnv', () => {
  it('drops the credentials of other providers and keeps the rest', () => {
    const env = claudeCodeEnv({
      PATH: '/usr/bin',
      HOME: '/home/someone',
      ANTHROPIC_API_KEY: 'a',
      ANTHROPIC_AUTH_TOKEN: 'b',
      OPENAI_API_KEY: 'c',
      GITHUB_TOKEN: 'd',
      API_KEY: 'e',
    })
    expect(env).toEqual({
      PATH: '/usr/bin',
      HOME: '/home/someone',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    })
  })
})

describe('toCliJsonSchema', () => {
  it('is the 2020-12 schema minus the $schema declaration the CLI cannot resolve', () => {
    const full = z.toJSONSchema(slotSubmissionSchema, { target: 'draft-2020-12' }) as {
      [key: string]: unknown
    }
    const cli = toCliJsonSchema(slotSubmissionSchema)

    expect(full['$schema']).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(cli).not.toHaveProperty('$schema')
    const { $schema: _dialect, ...rest } = full
    expect(cli).toEqual(rest)
  })
})

describe('verifyClaudeCodeLogin', () => {
  it('passes when Claude Code reports a sign-in', async () => {
    mode('auth-in')
    await expect(verifyClaudeCodeLogin({ executable })).resolves.toBeUndefined()
    expect(readRecord().args).toEqual(['auth', 'status'])
  })

  it('fails with sign-in advice when Claude Code is signed out', async () => {
    mode('auth-out')
    await expect(verifyClaudeCodeLogin({ executable })).rejects.toThrow(/claude auth login/)
  })

  it('fails with the install advice when the binary is missing', async () => {
    await expect(
      verifyClaudeCodeLogin({ executable: join(dir, 'no-such-claude') })
    ).rejects.toThrow(/CLAUDE_CODE_EXECUTABLE/)
  })
})
