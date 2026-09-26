/**
 * Exercise the installed Copilot SDK and its bundled runtime without mocks.
 *
 * The default check needs no Copilot subscription. --live additionally checks
 * authenticated model discovery and the session/tool API used by both agents.
 * --cli-login rejects token environment variables so an Enterprise login test
 * cannot silently pass using a different credential.
 */
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = new Set(process.argv.slice(2))
const allowed = new Set(['--live', '--cli-login'])
for (const arg of args) {
  if (!allowed.has(arg)) throw new Error(`Unknown argument: ${arg}`)
}
if (args.has('--cli-login') && !args.has('--live')) {
  throw new Error('--cli-login requires --live')
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

async function checkToolTurn(label, model, reasoningEffort) {
  const nonce = `${label}-${Date.now()}`
  let submitted = false
  const session = await client.createSession({
    model,
    reasoningEffort,
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

try {
  await client.start()
  const reply = await client.ping('compatibility-check')
  assert.equal(reply.message, 'pong: compatibility-check')
  assert.ok(Number.isInteger(reply.protocolVersion))
  process.stdout.write(`Bundled Copilot runtime started (protocol ${reply.protocolVersion}).\n`)

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
    // Search deliberately uses this wire value even though the SDK's public
    // ReasoningEffort type omits it. The live probe detects runtime drift.
    await checkToolTurn('search', model, 'none')

    const authoringModel = process.env.AUTHORING_AI_MODEL || model
    assert.ok(
      models.some((entry) => entry.id === authoringModel),
      `Authoring model ${authoringModel} is not listed`
    )
    await checkToolTurn(
      'authoring',
      authoringModel,
      process.env.AUTHORING_REASONING_EFFORT || 'medium'
    )
    process.stdout.write('Authenticated model listing and both tool sessions passed.\n')
  }
} finally {
  try {
    await client.stop()
  } finally {
    if (baseDirectory) await rm(baseDirectory, { recursive: true, force: true })
  }
}
