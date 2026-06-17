#!/usr/bin/env node
/**
 * Clean Ports — kills processes on dev server ports before startup.
 *
 * Prevents port conflicts when old dev servers weren't shut down properly.
 * Run this before starting dev servers to ensure clean port assignment.
 * Cross-platform: PowerShell + taskkill on Windows, lsof + kill elsewhere.
 *
 * Usage:
 *   node scripts/clean-ports.mjs
 *   node scripts/clean-ports.mjs 3003 5174 5173
 *
 * Ports can be configured via environment variables:
 *   API_PORT, WEB_PORT, DOCS_PORT
 */

import { exec } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execAsync = promisify(exec)
const isWindows = process.platform === 'win32'

const DEFAULT_PORTS = [
  parseInt(process.env.API_PORT ?? '3003', 10), // API
  parseInt(process.env.DOCS_PORT ?? '5173', 10), // Docs
  parseInt(process.env.WEB_PORT ?? '5174', 10), // Web
]

const PORTS_TO_CLEAN = process.argv.slice(2).map(Number).filter(Boolean)
const ports = PORTS_TO_CLEAN.length > 0 ? PORTS_TO_CLEAN : DEFAULT_PORTS

/** Parse command stdout into a de-duplicated list of numeric PIDs. */
export function parsePids(stdout) {
  return [...new Set(stdout.split(/\s+/).map(Number).filter(Boolean))]
}

/**
 * Build the platform-specific command that prints the PIDs LISTENING on
 * `port`, one per line (PowerShell on Windows, lsof elsewhere).
 *
 * Windows note: the obvious `Get-NetTCPConnection -LocalPort <port> -State
 * Listen` form raises a non-terminating "no matching objects found" error
 * whenever the port is FREE. `-ErrorAction SilentlyContinue` hides the
 * message but still leaves powershell's exit code at 1, which
 * `child_process.exec` turns into a rejected promise — so a free port (the
 * normal case) looked like an inspection failure and emitted a bogus warning.
 * Listing every listener and filtering in the pipeline never raises that
 * error: a free port exits 0 with empty output.
 */
export function buildListPidsCommand(port, platform = process.platform) {
  if (platform === 'win32') {
    return `powershell -NoProfile -Command "Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq ${port} | Select-Object -ExpandProperty OwningProcess -Unique"`
  }
  return `lsof -ti tcp:${port} -sTCP:LISTEN`
}

/**
 * Return the PIDs LISTENING on `port`. Throws when the discovery tool itself
 * fails (e.g. not installed) so the failure is LOUD — the previous version
 * swallowed the Windows-only `powershell`/`taskkill` "command not found"
 * errors on Linux/macOS and reported every port "free", making cleanup a
 * silent no-op.
 */
export async function getListeningPids(port) {
  if (isWindows) {
    const { stdout } = await execAsync(buildListPidsCommand(port, 'win32'))
    return parsePids(stdout)
  }
  try {
    const { stdout } = await execAsync(buildListPidsCommand(port, process.platform))
    return parsePids(stdout)
  } catch (err) {
    // lsof exits 1 when nothing holds the port — that's "free", not an error.
    if (err?.code === 1) return []
    throw err
  }
}

async function killPid(pid) {
  if (isWindows) {
    await execAsync(`taskkill /F /PID ${pid}`)
  } else {
    await execAsync(`kill -9 ${pid}`)
  }
}

async function cleanPort(port) {
  let pids
  try {
    pids = await getListeningPids(port)
  } catch (err) {
    console.warn(`[clean-ports] ⚠ Could not inspect port ${port}: ${err?.message ?? err}`)
    return
  }

  if (pids.length === 0) {
    console.log(`[clean-ports] Port ${port} is free`)
    return
  }

  for (const pid of pids) {
    if (pid === process.pid) continue
    console.log(`[clean-ports] Killing process ${pid} on port ${port}`)
    try {
      await killPid(pid)
      console.log(`[clean-ports] ✓ Port ${port} cleaned (pid ${pid})`)
    } catch (err) {
      console.log(
        `[clean-ports] ✗ Failed to kill process ${pid} on port ${port}: ${err?.message ?? err}`
      )
    }
  }
}

async function main() {
  console.log(`[clean-ports] Cleaning ports: ${ports.join(', ')}`)

  for (const port of ports) {
    await cleanPort(port)
  }

  // Wait a bit for ports to fully release
  await new Promise((resolve) => setTimeout(resolve, 1000))
  console.log('[clean-ports] Done')
}

// Only run when executed directly (`node scripts/clean-ports.mjs`), so the
// helpers above can be imported by tests without killing anyone's ports.
const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  main().catch((err) => {
    console.error('[clean-ports] Error:', err)
    process.exit(1)
  })
}
