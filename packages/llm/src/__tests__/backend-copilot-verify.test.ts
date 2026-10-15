/**
 * The Copilot backend's startup check.
 *
 * `verify()` is the only place a misconfigured model can be caught while the
 * operator is still watching the server start: a session creation succeeds for
 * a model the runtime would later reject, and the one startup model call
 * (cache priming) swallows its failure. So the order and the short-circuit are
 * the contract: the configured model is checked against the account's listing
 * FIRST, and a failure stops before any session is created or primed.
 */
import { AgentError } from '@ontology-search/core/errors'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ calls: [] as string[], listed: true }))

vi.mock('../agent/agent-policy.js', () => ({
  getAgentPolicy: () => ({ model: 'configured-model' }),
}))
vi.mock('../agent/copilot-client.js', () => ({
  verifyModelListed: vi.fn(async (model: string | undefined) => {
    h.calls.push(`verifyModelListed:${model}`)
    if (!h.listed) throw new AgentError(`Copilot does not list the model '${model}'`)
  }),
}))
vi.mock('../agent/copilot-agent.js', () => ({
  getPersistentSession: vi.fn(async () => {
    h.calls.push('getPersistentSession')
  }),
  primeCacheInBackground: vi.fn(() => {
    h.calls.push('primeCacheInBackground')
  }),
  runCopilotAgent: vi.fn(),
}))
vi.mock('@ontology-search/core/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ontology-search/core/config')>()),
  getConfig: () => ({ AI_PROVIDER: 'copilot', AI_MODEL: 'configured-model' }),
}))

import { getAgentBackend } from '../backend.js'

beforeEach(() => {
  h.calls = []
  h.listed = true
})

describe('copilot backend verify()', () => {
  it('checks the configured model first, then creates the session and primes the cache', async () => {
    await getAgentBackend().verify()
    expect(h.calls).toEqual([
      'verifyModelListed:configured-model',
      'getPersistentSession',
      'primeCacheInBackground',
    ])
  })

  it('stops at an unlisted model, before any session is created or primed', async () => {
    h.listed = false
    await expect(getAgentBackend().verify()).rejects.toBeInstanceOf(AgentError)
    expect(h.calls).toEqual(['verifyModelListed:configured-model'])
  })
})
