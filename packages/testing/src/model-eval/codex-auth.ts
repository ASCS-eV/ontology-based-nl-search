import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

const GROUP_OR_OTHER_ACCESS = 0o077

export interface CodexCliCredentials {
  accessToken: string
  accountId: string
  expiresAt?: number
}

/**
 * Read the current ChatGPT login written by the Codex CLI. Credentials are
 * returned in memory only; callers must never place them in run artifacts.
 */
export function readCodexCliCredentials(
  codexHome = join(homedir(), '.codex')
): CodexCliCredentials {
  const path = join(codexHome, 'auth.json')
  let mode: number | undefined
  try {
    mode = statSync(path).mode
  } catch (cause) {
    throw new Error(`Codex CLI credentials not found at ${path}. Run "codex login" first.`, {
      cause,
    })
  }

  if (platform() !== 'win32' && (mode & GROUP_OR_OTHER_ACCESS) !== 0) {
    const octal = (mode & 0o777).toString(8).padStart(3, '0')
    throw new Error(
      `Codex CLI credentials at ${path} have permissions 0${octal}. Run "chmod 600 ${path}" and retry.`
    )
  }

  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (cause) {
    throw new Error(`Could not read Codex CLI credentials at ${path}.`, { cause })
  }
  return parseCodexCliCredentials(raw, path)
}

/** Parse the small credential subset needed by the smoke runner. */
export function parseCodexCliCredentials(
  raw: string,
  path = 'auth.json',
  now = Date.now()
): CodexCliCredentials {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (cause) {
    throw new Error(`Codex CLI credentials at ${path} are not valid JSON.`, { cause })
  }

  const auth = value as {
    auth_mode?: unknown
    tokens?: { access_token?: unknown; account_id?: unknown }
  } | null
  const accessToken = auth?.tokens?.access_token
  const accountId = auth?.tokens?.account_id
  if (
    auth?.auth_mode !== 'chatgpt' ||
    typeof accessToken !== 'string' ||
    accessToken.length === 0
  ) {
    throw new Error(`No ChatGPT access token in ${path}. Run "codex login" first.`)
  }
  if (typeof accountId !== 'string' || accountId.length === 0) {
    throw new Error(`No ChatGPT account id in ${path}. Run "codex login" again.`)
  }

  const expiresAt = jwtExpiry(accessToken)
  if (expiresAt !== undefined && expiresAt <= now) {
    throw new Error(`Codex CLI access token in ${path} has expired. Run "codex login" again.`)
  }
  return { accessToken, accountId, ...(expiresAt === undefined ? {} : { expiresAt }) }
}

/** Read the installed client version without invoking a shell. */
export function readCodexCliVersion(executable = 'codex'): string {
  let output: string
  try {
    output = execFileSync(executable, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (cause) {
    throw new Error(`Could not run "${executable} --version". Install or update Codex CLI.`, {
      cause,
    })
  }
  return parseCodexCliVersion(output)
}

export function parseCodexCliVersion(output: string): string {
  const match = output.match(/\bcodex-cli\s+(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/)
  if (!match?.[1]) throw new Error('Could not parse the installed Codex CLI version.')
  return match[1]
}

function jwtExpiry(token: string): number | undefined {
  const payload = token.split('.')[1]
  if (!payload) return undefined
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: unknown
    }
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : undefined
  } catch {
    return undefined
  }
}
