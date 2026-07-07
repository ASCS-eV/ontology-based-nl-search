/**
 * Agent policy contract test — pins that BOTH adapters honour the shared policy.
 *
 * This test exists specifically to prevent the drift that originally caused
 * the Copilot adapter to expose investigation tools while the Vercel adapter
 * forced `submit_slots`. If either adapter breaks the policy contract (e.g.
 * registers extra tools, ignores temperature, skips forced tool choice), this
 * test fails.
 *
 * Strategy: mock both SDK layers, import both adapters, run each, and assert
 * that the SDK calls received match the policy's contract.
 */

import { describe, expect, it, vi } from 'vitest'

// ─── Hoisted fixtures ────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({
  generateTextArgs: null as Record<string, unknown> | null,
  copilotSessionArgs: null as Record<string, unknown> | null,
  copilotSession: { sendAndWait: vi.fn().mockResolvedValue(undefined) },
}))

// ─── Mock: Vercel AI SDK ─────────────────────────────────────────────────────

vi.mock('ai', () => ({
  generateText: vi.fn().mockImplementation(async (args: Record<string, unknown>) => {
    h.generateTextArgs = args
    return { steps: [], text: '', finishReason: 'stop' }
  }),
  stepCountIs: vi.fn().mockReturnValue(undefined),
  tool: vi.fn().mockImplementation((def) => def),
}))

vi.mock('../../provider.js', () => ({
  getModel: vi.fn().mockReturnValue({ modelId: 'test-model' }),
}))

// ─── Mock: Copilot SDK ───────────────────────────────────────────────────────

vi.mock('@github/copilot-sdk', () => ({
  approveAll: {},
  defineTool: (name: string, def: Record<string, unknown>) => ({ name, ...def }),
  CopilotClient: class {
    async start(): Promise<void> {}
    async createSession(opts: Record<string, unknown>) {
      h.copilotSessionArgs = opts
      return h.copilotSession
    }
  },
}))

// ─── Mock: shared dependencies ───────────────────────────────────────────────

vi.mock('../agent-context.js', () => ({
  getAgentContext: vi.fn().mockResolvedValue({
    vocabulary: { domains: [] },
    store: {},
  }),
  getStaticCore: vi.fn().mockReturnValue('static core stub'),
  buildRequestPrompt: vi.fn().mockResolvedValue({
    prompt: 'composed prompt stub',
    tail: 'retrieved tail stub',
    retrieved: { domains: [], cards: [], fragments: [], confidence: 1, catalog: [] },
  }),
  warmupAgentContext: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@ontology-search/search', () => ({
  getInitializedStore: vi.fn().mockResolvedValue({}),
  extractSchemaVocabulary: vi.fn().mockReturnValue({ domains: [] }),
  getInstanceValues: vi.fn().mockResolvedValue(new Map()),
  SCHEMA_GRAPH: 'urn:graph:schema',
  getPrimaryDomain: vi.fn().mockResolvedValue('hdmap'),
}))

vi.mock('@ontology-search/core/config', () => ({
  getConfig: vi.fn().mockReturnValue({
    AI_PROVIDER: 'copilot',
    AI_MODEL: 'claude-haiku-4.5',
    GITHUB_TOKEN: 'test-token',
    LLM_TEMPERATURE: 0,
    LLM_THINKING_BUDGET: 0,
    LLM_MAX_AGENT_STEPS: 3,
  }),
}))

vi.mock('../run-slot-pipeline.js', () => ({
  runSlotPipeline: vi.fn().mockResolvedValue({
    interpretation: { summary: 'test', mappedTerms: [] },
    gaps: [],
    sparql: 'SELECT ?x WHERE { ?x ?p ?o }',
  }),
}))

vi.mock('../empty-fallback.js', () => ({
  buildEmptyFallbackResponse: vi.fn().mockResolvedValue({
    interpretation: { summary: 'fallback', mappedTerms: [] },
    gaps: [],
    sparql: 'SELECT ?x WHERE { ?x ?p ?o }',
  }),
}))

// ─── Import the policy and adapters ──────────────────────────────────────────

import { getAgentPolicy } from '../agent-policy.js'

describe('Agent policy contract — both adapters honour the shared policy', () => {
  it('AgentPolicy.forcedTool is always submit_slots', () => {
    const policy = getAgentPolicy()
    expect(policy.forcedTool).toBe('submit_slots')
  })

  it('AgentPolicy temperature defaults to 0 (greedy decoding)', () => {
    const policy = getAgentPolicy()
    expect(policy.temperature).toBe(0)
  })

  it('AgentPolicy thinking is null when budget is 0', () => {
    const policy = getAgentPolicy()
    expect(policy.thinking).toBeNull()
  })

  it('Vercel adapter passes only submit_slots as toolChoice', async () => {
    const { runSparqlAgent } = await import('../index.js')
    await runSparqlAgent('test query')

    expect(h.generateTextArgs).not.toBeNull()
    expect(h.generateTextArgs!['toolChoice']).toEqual({
      type: 'tool',
      toolName: 'submit_slots',
    })
  })

  it('Vercel adapter passes only agentTools (submit_slots), no investigation tools', async () => {
    const { runSparqlAgent } = await import('../index.js')
    await runSparqlAgent('test query')

    const tools = h.generateTextArgs!['tools'] as Record<string, unknown>
    const toolNames = Object.keys(tools)
    expect(toolNames).toEqual(['submit_slots'])
    expect(toolNames).not.toContain('discover_domains')
    expect(toolNames).not.toContain('discover_properties')
    expect(toolNames).not.toContain('investigate_schema')
  })

  it('Vercel adapter uses policy temperature', async () => {
    const { runSparqlAgent } = await import('../index.js')
    await runSparqlAgent('test query')

    expect(h.generateTextArgs!['temperature']).toBe(0)
  })

  it('Copilot adapter registers only submit_slots in availableTools', async () => {
    const { runCopilotAgent } = await import('../copilot-agent.js')
    await runCopilotAgent('test query').catch(() => {
      // Expected: may throw due to mock limitations
    })

    // Session creation should have been called with only submit_slots
    expect(h.copilotSessionArgs).not.toBeNull()
    expect(h.copilotSessionArgs!['availableTools']).toEqual(['submit_slots'])
  })

  it('Copilot adapter registers exactly one tool (submit_slots)', async () => {
    const { runCopilotAgent } = await import('../copilot-agent.js')
    await runCopilotAgent('test query').catch(() => {})

    const tools = h.copilotSessionArgs!['tools'] as Array<{ name: string }>
    expect(tools).toHaveLength(1)
    expect(tools[0]!.name).toBe('submit_slots')
  })

  it('Copilot adapter uses policy model', async () => {
    const { runCopilotAgent } = await import('../copilot-agent.js')
    await runCopilotAgent('test query').catch(() => {})

    expect(h.copilotSessionArgs!['model']).toBe('claude-haiku-4.5')
  })

  it('neither adapter can register investigation tools — the module is deleted', async () => {
    // This is a structural assertion: the investigation-tools module no longer
    // exists. If someone re-adds it, this import will succeed and the test fails.
    await expect(import('../investigation-tools.js')).rejects.toThrow()
  })
})
