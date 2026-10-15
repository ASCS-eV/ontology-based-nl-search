/**
 * Exercise the installed Copilot SDK and its bundled runtime without mocks.
 *
 * The default check needs no Copilot subscription. It proves the SDK's runtime
 * starts, speaks the SDK's protocol, and is the version this repo says it was
 * tested with (`TESTED_RUNTIME_VERSION` in `src/agent/copilot-client.ts`), so an
 * SDK bump cannot leave that constant, and the live matrix the README asks for,
 * behind.
 *
 * --live additionally checks authenticated model discovery and the
 * session/tool API used by both agents, with the reasoning effort the adapters
 * would really send (resolved from the model's advertised capabilities, needs
 * `pnpm --filter @ontology-search/llm build`).
 * --matrix (needs --live) prints, per model, which reasoning efforts this
 * runtime accepts, and fails when the effort the adapters would send is not one
 * of them. Paste its output into the SDK-update PR.
 * --cli-login rejects token environment variables so an Enterprise login test
 * cannot silently pass using a different credential.
 */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = new Set(process.argv.slice(2))
const allowed = new Set(['--live', '--cli-login', '--matrix'])
for (const arg of args) {
  if (!allowed.has(arg)) throw new Error(`Unknown argument: ${arg}`)
}
if (args.has('--cli-login') && !args.has('--live')) {
  throw new Error('--cli-login requires --live')
}
if (args.has('--matrix') && !args.has('--live')) {
  throw new Error('--matrix requires --live')
}

// The regression was a protocol mismatch with an external CLI binary. Always
// exercise the runtime packaged with this exact SDK release.
delete process.env.COPILOT_CLI_PATH

const tokenVariables = [
  'GITHUB_COPILOT_API_TOKEN',
  'COPILOT_GITHUB_TOKEN',
  'GH_TOKEN',
  'GITHUB_TOKEN',
]
if (args.has('--cli-login')) {
  const present = tokenVariables.filter((name) => process.env[name])
  assert.equal(
    present.length,
    0,
    `Unset ${present.join(', ')} to prove that the stored CLI login works`
  )
} else if (!args.has('--live')) {
  // Prevent this credential-free CI check from inheriting a developer's tokens.
  for (const name of tokenVariables) delete process.env[name]
  delete process.env.COPILOT_API_URL
}

const { CopilotClient, defineTool } = await import('@github/copilot-sdk')
const baseDirectory = args.has('--live')
  ? undefined
  : await mkdtemp(join(tmpdir(), 'copilot-sdk-compat-'))
const client = new CopilotClient(
  args.has('--live') ? {} : { baseDirectory, mode: 'empty', useLoggedInUser: false }
)

/** The runtime version the installed SDK bundles, from its own pin (not a public export). */
async function sdkRuntimePin() {
  const pinFile = new URL('./cliVersion.js', import.meta.resolve('@github/copilot-sdk'))
  const match = /COPILOT_CLI_VERSION\s*=\s*"([^"]+)"/.exec(await readFile(pinFile, 'utf8'))
  assert.ok(match, `Cannot read COPILOT_CLI_VERSION from ${pinFile.href}`)
  return match[1]
}

/** The runtime version this repo declares as tested, read from source so no build is needed. */
async function declaredRuntimeVersion() {
  const source = new URL('../src/agent/copilot-client.ts', import.meta.url)
  const match = /TESTED_RUNTIME_VERSION\s*=\s*'([^']+)'/.exec(await readFile(source, 'utf8'))
  assert.ok(match, `Cannot read TESTED_RUNTIME_VERSION from ${source.pathname}`)
  return match[1]
}

/** Import compiled app code (the resolver the adapters use), with a pointer when it is not built. */
async function importBuilt(path) {
  try {
    return await import(new URL(`../dist/${path}`, import.meta.url))
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        `Run "pnpm --filter @ontology-search/llm build" first: dist/${path} is missing`,
        {
          cause: error,
        }
      )
    }
    throw error
  }
}

async function checkToolTurn(label, model, reasoningEffort) {
  const nonce = `${label}-${Date.now()}`
  let submitted = false
  const session = await client.createSession({
    model,
    ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    // The probe only needs its own permission-free tool. Reject anything else
    // the model attempts, even if the runtime offers ambient CLI capabilities.
    onPermissionRequest: () => ({ kind: 'reject' }),
    systemMessage: {
      mode: 'replace',
      content: 'Call submit_probe exactly once with the nonce from the user message.',
    },
    tools: [
      defineTool('submit_probe', {
        description: 'Submit the nonce from the user message.',
        skipPermission: true,
        parameters: {
          type: 'object',
          properties: { nonce: { type: 'string' } },
          required: ['nonce'],
          additionalProperties: false,
        },
        handler: async (params) => {
          assert.equal(params.nonce, nonce)
          submitted = true
          return { accepted: true }
        },
      }),
    ],
    availableTools: ['submit_probe'],
  })
  try {
    await session.sendAndWait({ prompt: `Call submit_probe with nonce ${nonce}.` }, 120_000)
    assert.ok(submitted, `${label} session did not deliver its tool call`)
  } finally {
    await session.disconnect()
  }
}

/**
 * One throwaway turn with an explicit reasoning effort (`'omit'` leaves the
 * knob unset), reporting acceptance instead of throwing: the runtimes reject an
 * unsupported effort from `sendAndWait`, not from `createSession`.
 */
async function probeEffort(model, effort) {
  const started = Date.now()
  let session
  try {
    session = await client.createSession({
      model,
      ...(effort === 'omit' ? {} : { reasoningEffort: effort }),
      onPermissionRequest: () => ({ kind: 'reject' }),
      systemMessage: { mode: 'replace', content: 'Answer in one short sentence.' },
      tools: [],
    })
    await session.sendAndWait({ prompt: 'What is 17 times 23?' }, 120_000)
    return { ok: true, ms: Date.now() - started }
  } catch (error) {
    const reason = String(error?.message ?? error)
      .split('\n')[0]
      .slice(0, 110)
    return { ok: false, ms: Date.now() - started, reason }
  } finally {
    await session?.disconnect().catch(() => {})
  }
}

/**
 * Which efforts this runtime accepts per model, and whether the effort the
 * adapters resolve is among them. Printed as a table for the SDK-update PR.
 */
async function runMatrix(models, ids, requests, resolve) {
  const probed = ['omit', 'none', 'low', 'medium']
  const failures = []
  const rows = []
  for (const id of ids) {
    const entry = models.find((m) => m.id === id)
    const advertised = entry?.supportedReasoningEfforts ?? []
    const sends = requests.map(({ label, requested }) => {
      const { effort } = resolve(requested, {
        supportsReasoningEffort: entry?.capabilities?.supports?.reasoningEffort === true,
        supported: advertised,
      })
      return { label, requested, effort: effort ?? 'omit' }
    })
    const results = new Map()
    for (const effort of new Set([...probed, ...sends.map((s) => s.effort)])) {
      results.set(effort, await probeEffort(id, effort))
    }
    rows.push({ id, advertised, results, sends })
    for (const { label, requested, effort } of sends) {
      const result = results.get(effort)
      if (!result.ok) {
        failures.push(
          `${id}: ${label} resolves ${requested} -> ${effort}, rejected: ${result.reason}`
        )
      }
    }
  }
  const cell = (r) =>
    r === undefined ? '-' : r.ok ? `ok ${(r.ms / 1000).toFixed(1)}s` : 'REJECTED'
  const out = process.stdout
  out.write('\nreasoning-effort matrix (this runtime, this account)\n')
  out.write(
    `${'model'.padEnd(24)}${'advertised'.padEnd(34)}${probed.map((p) => p.padEnd(12)).join('')}adapters send\n`
  )
  for (const { id, advertised, results, sends } of rows) {
    out.write(
      `${id.padEnd(24)}${(advertised.join(',') || '(none)').padEnd(34)}${probed
        .map((p) => cell(results.get(p)).padEnd(12))
        .join('')}${sends.map((s) => `${s.label}=${s.effort}`).join(' ')}\n`
    )
  }
  assert.equal(
    failures.length,
    0,
    `The adapters would send a rejected effort:\n  ${failures.join('\n  ')}`
  )
  out.write('\nEvery effort the adapters would send is accepted by this runtime.\n')
}

try {
  await client.start()
  const reply = await client.ping('compatibility-check')
  assert.equal(reply.message, 'pong: compatibility-check')
  assert.ok(Number.isInteger(reply.protocolVersion))

  // The wire protocol version did not change when the runtime started
  // validating reasoning efforts (1.0.85 -> 1.0.91), so the handshake alone
  // cannot tell an SDK bump from a behaviour change. The runtime version can.
  const pin = await sdkRuntimePin()
  const declared = await declaredRuntimeVersion()
  assert.equal(
    declared,
    pin,
    `TESTED_RUNTIME_VERSION (${declared}) in src/agent/copilot-client.ts must equal the runtime the SDK bundles (${pin}). ` +
      'After an SDK bump update it, then run the live matrix: ' +
      'AI_MODEL=<model> pnpm --filter @ontology-search/llm exec node scripts/copilot-sdk-compat.mjs --live --cli-login --matrix'
  )
  const status = await client.getStatus()
  assert.equal(
    status.version,
    pin,
    `The started runtime reports ${status.version}, not the ${pin} the SDK pins`
  )
  process.stdout.write(
    `Bundled Copilot runtime ${status.version} started (protocol ${reply.protocolVersion}).\n`
  )

  if (args.has('--live')) {
    const auth = await client.getAuthStatus()
    assert.ok(auth.isAuthenticated, auth.statusMessage || 'Copilot is not authenticated')
    if (args.has('--cli-login')) {
      assert.equal(auth.authType, 'user', 'Expected a stored Copilot CLI login')
      if (process.env.COPILOT_EXPECTED_HOST) {
        assert.equal(
          auth.host?.replace(/\/$/, ''),
          process.env.COPILOT_EXPECTED_HOST.replace(/\/$/, ''),
          'Copilot CLI login is for a different host'
        )
      }
    }
    const model = process.env.AI_MODEL
    assert.ok(model, 'Set AI_MODEL to the Copilot search model before --live')
    const models = await client.listModels()
    assert.ok(
      models.some((entry) => entry.id === model),
      `AI_MODEL ${model} is not listed`
    )
    const authoringModel = process.env.AUTHORING_AI_MODEL || model
    assert.ok(
      models.some((entry) => entry.id === authoringModel),
      `Authoring model ${authoringModel} is not listed`
    )

    // The effort the adapters would really send: the policy's request resolved
    // against what the runtime advertises for the model, by the same code.
    const { resolveReasoningEffort } = await importBuilt('agent/reasoning-effort.js')
    const resolveFor = (id, requested) => {
      const entry = models.find((m) => m.id === id)
      return resolveReasoningEffort(requested, {
        supportsReasoningEffort: entry?.capabilities?.supports?.reasoningEffort === true,
        supported: entry?.supportedReasoningEfforts ?? [],
      })
    }
    const authoringRequested = process.env.AUTHORING_REASONING_EFFORT || 'medium'
    const search = resolveFor(model, 'none')
    const authoring = resolveFor(authoringModel, authoringRequested)
    const describe = (requested, { effort, adjustment }) =>
      `${requested} -> ${effort ?? '(unset)'}${adjustment ? ` [${adjustment}]` : ''}`
    process.stdout.write(`search effort: ${describe('none', search)}\n`)
    process.stdout.write(`authoring effort: ${describe(authoringRequested, authoring)}\n`)

    await checkToolTurn('search', model, search.effort)
    await checkToolTurn('authoring', authoringModel, authoring.effort)
    process.stdout.write('Authenticated model listing and both tool sessions passed.\n')

    if (args.has('--matrix')) {
      const ids = (
        process.env.COPILOT_MATRIX_MODELS || [...new Set([model, authoringModel])].join(',')
      )
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
      await runMatrix(
        models,
        ids,
        [
          { label: 'search', requested: 'none' },
          { label: 'authoring', requested: authoringRequested },
        ],
        resolveReasoningEffort
      )
    }
  }
} finally {
  try {
    await client.stop()
  } finally {
    if (baseDirectory) await rm(baseDirectory, { recursive: true, force: true })
  }
}
