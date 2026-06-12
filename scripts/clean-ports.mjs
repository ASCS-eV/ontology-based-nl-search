#!/usr/bin/env node
/**
 * Clean Ports — kills processes on dev server ports before startup.
 *
 * Prevents port conflicts when old dev servers weren't shut down properly.
 * Run this before starting dev servers to ensure clean port assignment.
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

const DEFAULT_PORTS = [
  parseInt(process.env.API_PORT ?? '3003', 10), // API
  parseInt(process.env.DOCS_PORT ?? '5173', 10), // Docs
  parseInt(process.env.WEB_PORT ?? '5174', 10), // Web
]

const PORTS_TO_CLEAN = process.argv.slice(2).map(Number).filter(Boolean)
const ports = PORTS_TO_CLEAN.length > 0 ? PORTS_TO_CLEAN : DEFAULT_PORTS

console.log(`[clean-ports] Cleaning ports: ${ports.join(', ')}`)

async function getProcessOnPort(port) {
  try {
    const { stdout } = await execAsync(
      `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess"`
    )
    const pid = stdout.trim()
    return pid ? parseInt(pid, 10) : null
  } catch {
    return null
  }
}

async function killProcess(pid) {
  try {
    await execAsync(`taskkill /F /PID ${pid}`)
    return true
  } catch {
    return false
  }
}

async function cleanPort(port) {
  const pid = await getProcessOnPort(port)
  if (!pid) {
    console.log(`[clean-ports] Port ${port} is free`)
    return
  }

  console.log(`[clean-ports] Killing process ${pid} on port ${port}`)
  const killed = await killProcess(pid)
  if (killed) {
    console.log(`[clean-ports] ✓ Port ${port} cleaned`)
  } else {
    console.log(`[clean-ports] ✗ Failed to kill process ${pid} on port ${port}`)
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
