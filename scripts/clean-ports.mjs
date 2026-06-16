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

console.log(`[clean-ports] Cleaning ports: ${ports.join(', ')}`)

/** Parse command stdout into a de-duplicated list of numeric PIDs. */
function parsePids(stdout) {
  return [...new Set(stdout.split(/\s+/).map(Number).filter(Boolean))]
}

/**
 * Return the PIDs LISTENING on `port`. Cross-platform: PowerShell on
 * Windows, lsof elsewhere. Throws when the discovery tool itself fails
 * (e.g. not installed) so the failure is LOUD — the previous version
 * swallowed the Windows-only `powershell`/`taskkill` "command not found"
 * errors on Linux/macOS and reported every port "free", making cleanup a
 * silent no-op.
 */
async function getListeningPids(port) {
  if (isWindows) {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`
    )
    return parsePids(stdout)
  }
  try {
    const { stdout } = await execAsync(`lsof -ti tcp:${port} -sTCP:LISTEN`)
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
  for (const port of ports) {
    await cleanPort(port)
  }

  // Wait a bit for ports to fully release
  await new Promise((resolve) => setTimeout(resolve, 1000))
  console.log('[clean-ports] Done')
}

main().catch((err) => {
  console.error('[clean-ports] Error:', err)
  process.exit(1)
})
