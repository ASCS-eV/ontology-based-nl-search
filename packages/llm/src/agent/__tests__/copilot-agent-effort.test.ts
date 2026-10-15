/**
 * What the Copilot adapters actually put on `createSession`.
 *
 * `reasoning-effort.test.ts` proves the rule; this proves the adapters apply it:
 * the effort that leaves the process is one the runtime advertises for the
 * model, for search and for authoring, and a runtime that cannot say is never
 * sent an unverifiable `'none'`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  created: [] as Array<Record<string, unknown>>,
  models: [] as unknown[],
  listFails: false,
  config: {} as Record<string, unknown>,
}))

vi.mock('@github/copilot-sdk', () => ({
  approveAll: {},
  defineTool: (name: string, def: Record<string, unknown>) => ({ name, ...def }),
  CopilotClient: class {
    async start(): Promise<void> {}
    async getStatus() {
      return { version: '1.0.85', protocolVersion: 3 }
    }
    async listModels() {
      if (h.listFails) throw new Error('listing unavailable')
      return h.models
    }
    async createSession(opts: Record<string, unknown>) {
      h.created.push(opts)
      return { disconnect: async () => {}, sendAndWait: async () => undefined }
    }
  },
}))
vi.mock('@ontology-search/core/config', () => ({ getConfig: () => h.config }))
vi.mock('../agent-context.js', () => ({
  getAgentContext: vi.fn().mockResolvedValue({ vocabulary: { domains: [] }, store: {} }),
  getStaticCore: vi.fn().mockReturnValue('static core stub'),
  buildRequestPrompt: vi.fn(),
  warmupAgentContext: vi.fn(),
}))
vi.mock('../../authoring/scene-prompt.js', () => ({ getSceneStaticCore: () => 'scene core stub' }))
vi.mock('@ontology-search/search', () => ({}))
vi.mock('@ontology-search/ontology/domain-registry', () => ({ getPrimaryDomain: vi.fn() }))
vi.mock('../run-slot-pipeline.js', () => ({ runSlotPipeline: vi.fn() }))
vi.mock('../empty-fallback.js', () => ({ buildEmptyFallbackResponse: vi.fn() }))

const model = (id: string, reasoning: boolean, ...efforts: string[]) => ({
  id,
  name: id,
  capabilities: { supports: { vision: false, reasoningEffort: reasoning } },
  ...(reasoning ? { supportedReasoningEfforts: efforts } : {}),
})

beforeEach(() => {
  vi.resetModules()
  h.created = []
  h.listFails = false
  h.models = [
    model('claude-sonnet-5', true, 'low', 'medium', 'high', 'xhigh', 'max'),
    model('gpt-5.4', true, 'none', 'low', 'medium', 'high', 'xhigh'),
    model('claude-haiku-4.5', false),
    model('mai-code-1.1-flash', true, 'low', 'medium', 'high'),
  ]
  h.config = {
    AI_PROVIDER: 'copilot',
    AI_MODEL: 'claude-sonnet-5',
    GITHUB_TOKEN: undefined,
    LLM_TEMPERATURE: 0,
    LLM_THINKING: 'off',
    LLM_MAX_AGENT_STEPS: 3,
    AUTHORING_REASONING_EFFORT: 'xhigh',
  }
})

/** Create the search pool and return what its sessions were created with. */
async function searchSessions(): Promise<Array<Record<string, unknown>>> {
  const { getPersistentSession } = await import('../copilot-agent.js')
  await getPersistentSession()
  // The pool fills in the background; give it a tick to settle.
  await new Promise((resolve) => setTimeout(resolve, 10))
  return h.created
}

describe('search sessions', () => {
  it('send none to a model that advertises it', async () => {
    h.config.AI_MODEL = 'gpt-5.4'
    const sessions = await searchSessions()
    expect(sessions.length).toBeGreaterThan(0)
    for (const s of sessions) expect(s['reasoningEffort']).toBe('none')
  })

  it.each(['claude-sonnet-5', 'mai-code-1.1-flash'])(
    'never send none to %s, which does not advertise it: the weakest advertised effort instead',
    async (id) => {
      h.config.AI_MODEL = id
      const sessions = await searchSessions()
      expect(sessions.length).toBeGreaterThan(0)
      for (const s of sessions) expect(s['reasoningEffort']).toBe('low')
    }
  )

  it('leave the knob unset for a model without reasoning-effort support', async () => {
    h.config.AI_MODEL = 'claude-haiku-4.5'
    const sessions = await searchSessions()
    expect(sessions.length).toBeGreaterThan(0)
    for (const s of sessions) expect(s).not.toHaveProperty('reasoningEffort')
  })

  it('do not send an unverifiable none when the model listing is unavailable', async () => {
    h.listFails = true
    const sessions = await searchSessions()
    expect(sessions.length).toBeGreaterThan(0)
    for (const s of sessions) expect(s).not.toHaveProperty('reasoningEffort')
  })

  it('decide from the advertised list, not the model id (a future model id behaves the same)', async () => {
    h.models = [model('claude-sonnet-9', true, 'low', 'high')]
    h.config.AI_MODEL = 'claude-sonnet-9'
    const sessions = await searchSessions()
    for (const s of sessions) expect(s['reasoningEffort']).toBe('low')
  })
})

describe('authoring sessions', () => {
  it('clamp an unadvertised configured effort to the strongest advertised one below it', async () => {
    h.config.AI_MODEL = 'mai-code-1.1-flash'
    const { fillSceneCopilot } = await import('../../authoring/fill-scene-copilot.js')
    await fillSceneCopilot('author a cut-in')
    expect(h.created).toHaveLength(1)
    expect(h.created[0]?.['reasoningEffort']).toBe('high')
  })

  it('forward an advertised configured effort unchanged', async () => {
    h.config.AI_MODEL = 'claude-sonnet-5'
    const { fillSceneCopilot } = await import('../../authoring/fill-scene-copilot.js')
    await fillSceneCopilot('author a cut-in')
    expect(h.created[0]?.['reasoningEffort']).toBe('xhigh')
  })
})
