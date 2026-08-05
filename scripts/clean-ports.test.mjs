/**
 * Regression tests for clean-ports port discovery.
 *
 * Bug: on Windows the discovery command used
 *   Get-NetTCPConnection -LocalPort <port> -State Listen -ErrorAction SilentlyContinue
 * which raises a non-terminating "no matching objects found" error whenever
 * the port is FREE. SilentlyContinue hides the text but still leaves
 * powershell's exit code at 1, so `child_process.exec` rejected and
 * clean-ports printed a bogus "⚠ Could not inspect port <port>" warning for
 * the perfectly-normal free-port case. These lock in the fix (filter listeners
 * in-pipeline so a free port exits 0).
 *
 * Zero-dependency on purpose: clean-ports.mjs runs before `build`, so it (and
 * its test) must not rely on any workspace package. Run with `node --test`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildListPidsCommand,
  getListeningPids,
  parsePids,
  resolveServicePorts,
  selectPorts,
} from './clean-ports.mjs'

test('service ports follow the configured environment, not hard-coded numbers', () => {
  assert.deepEqual(resolveServicePorts({}), { api: 3003, docs: 5173, web: 5174 })
  assert.deepEqual(resolveServicePorts({ API_PORT: '4000', WEB_PORT: '8080' }), {
    api: 4000,
    docs: 5173,
    web: 8080,
  })
})

test('--api cleans the CONFIGURED api port, not the default one', () => {
  // Regression: the dev scripts passed a literal 3003, so moving the API with
  // API_PORT cleaned a port nothing was listening on and left the real one held.
  assert.deepEqual(selectPorts(['--api'], { API_PORT: '4000' }), [4000])
  assert.deepEqual(selectPorts(['--web'], { WEB_PORT: '8080' }), [8080])
})

test('explicit ports still win, and no arguments cleans every service', () => {
  assert.deepEqual(selectPorts(['3003', '5174'], {}), [3003, 5174])
  assert.deepEqual(selectPorts([], { API_PORT: '4000' }), [4000, 5173, 5174])
})

test('importing the module does not load .env.local into the process', () => {
  // The port settings are read when the CLI runs, not at import: a test (or
  // any other importer) must not have the repo's .env.local applied to it.
  const before = { ...process.env }
  selectPorts(['--api'], { API_PORT: '4000' })
  assert.deepEqual({ ...process.env }, before)
})

test('parsePids de-duplicates and drops non-numeric/empty tokens', () => {
  assert.deepEqual(parsePids('123\r\n123\n  456 \n\n'), [123, 456])
  assert.deepEqual(parsePids(''), [])
  assert.deepEqual(parsePids('   \n  '), [])
})

test('windows command does not use the -LocalPort query that errors on a free port', () => {
  const cmd = buildListPidsCommand(3003, 'win32')
  // The old form errored ("no matching objects") and exited 1 when the port
  // was free. The fix must not reintroduce that `-LocalPort <port> -State
  // Listen` query shape.
  assert.ok(
    !/-LocalPort\s+3003\b/i.test(cmd),
    `must not query Get-NetTCPConnection by -LocalPort: ${cmd}`
  )
  assert.match(cmd, /Get-NetTCPConnection -State Listen/)
  assert.match(cmd, /Where-Object LocalPort -eq 3003/)
})

test('non-windows command uses lsof', () => {
  assert.equal(buildListPidsCommand(5174, 'linux'), 'lsof -ti tcp:5174 -sTCP:LISTEN')
  assert.equal(buildListPidsCommand(5174, 'darwin'), 'lsof -ti tcp:5174 -sTCP:LISTEN')
})

// Behavioral end-to-end check — only meaningful where PowerShell exists.
// Before the fix this rejected (exit code 1) for a free port; now it must
// resolve to [] without throwing.
test(
  'getListeningPids resolves to [] for a free port instead of failing',
  { skip: process.platform !== 'win32' },
  async () => {
    // A high, almost-certainly-unbound port.
    const pids = await getListeningPids(59321)
    assert.deepEqual(pids, [])
  }
)
