/**
 * Copilot-agent boundary regression tests.
 *
 * Same security invariant the Vercel agent-boundary suite pins, for the OTHER
 * configurable agent:
 *
 *   "The LLM never writes SPARQL. It fills SearchSlots via a single tool
 *    call. The compiler is deterministic — no prompt injection can produce
 *    arbitrary queries."
 *
 * `runCopilotAgent` is structural the same way the Vercel one is: the only SPARQL
 * emission paths are (1) `runSlotPipeline(submission)` from a validated
 * `submit_slots` tool call routed by token, and (2) the `buildEmptyFallbackResponse`
 * fallback when the LLM did NOT submit. The agent reads the tool submission via
 * the SubmissionRouter; it NEVER reads the model's prose. These tests pin that:
 * the only thing the stubbed SDK round-trip can do is invoke the captured
 * `submit_slots` handler (a real tool call) or not — model text is never a
 * SPARQL source.
 *
 * Until now `runCopilotAgent` had ZERO test coverage — the never-writes-SPARQL
 * property was unpinned for the Copilot provider even though it runs the same
 * security-critical boundary as the Vercel agent.
 *
 * Ontology-agnostic: assertions check the SHAPE of the response (was a tool
 * submission routed? did the SPARQL come from the pipeline or the fallback? did
 * model prose leak?), never a specific schema.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Hoisted fixtures (visible inside vi.mock factories) ───────────────────

const h = vi.hoisted(() => ({
  PIPELINE_SPARQL: 'SELECT ?asset WHERE { ?asset ?p ?o } # from runSlotPipeline',
  FALLBACK_SPARQL: 'SELECT ?asset WHERE { ?asset ?p ?o } # from buildEmptyFallbackResponse',
  // The single stub session every createSession() returns; tests configure its
  // sendAndWait per case. Captured tools let the stub invoke the REAL
  // submit_slots handler (which routes through the real SubmissionRouter).
  capturedTools: [] as Array<{ name: string; handler?: (p: unknown) => unknown }>,
  session: { sendAndWait: vi.fn(), disconnect: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('@github/copilot-sdk', () => ({
  approveAll: {},
  defineTool: (name: string, def: Record<string, unknown>) => ({ name, ...def }),
  CopilotClient: class {
    async start(): Promise<void> {}
    async createSession(opts: { tools: typeof h.capturedTools }): Promise<typeof h.session> {
      h.capturedTools = opts.tools
      return h.session
    }
  },
}))

// Keep the prompt/vocab/store setup off the real ontology workspace.
vi.mock('@ontology-search/search', () => ({
  getInitializedStore: vi.fn().mockResolvedValue({}),
  extractVocabulary: vi.fn().mockReturnValue({ domains: [] }),
  SCHEMA_GRAPH: 'urn:graph:schema',
  getPrimaryDomain: vi.fn().mockResolvedValue('hdmap'),
}))
vi.mock('@ontology-search/search/shacl-reader', () => ({
  getShaclContent: vi.fn().mockReturnValue(''),
}))
vi.mock('../../prompt-builder.js', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue('system prompt'),
}))
vi.mock('@ontology-search/core/config', () => ({
  getConfig: vi.fn().mockReturnValue({ AI_MODEL: 'test-model', GITHUB_TOKEN: undefined }),
}))

// The two — and only two — SPARQL emission paths. Stubbed so each test can
// assert WHICH one produced the query.
vi.mock('../run-slot-pipeline.js', () => ({
  runSlotPipeline: vi.fn().mockResolvedValue({
    interpretation: { summary: 'pipeline', mappedTerms: [] },
    gaps: [],
    sparql: h.PIPELINE_SPARQL,
  }),
}))
vi.mock('../empty-fallback.js', () => ({
  buildEmptyFallbackResponse: vi.fn().mockResolvedValue({
    interpretation: { summary: 'fallback', mappedTerms: [] },
    gaps: [],
    sparql: h.FALLBACK_SPARQL,
  }),
}))

const TOKEN_RE = /\[request_token: ([^\]]+)\]/

/** A well-formed submit_slots payload echoing the request's token. */
function validSubmission(token: string) {
  return {
    requestToken: token,
    slots: { domains: ['hdmap'], filters: {}, ranges: {} },
    interpretation: { summary: 'ok', mappedTerms: [] },
    gaps: [],
  }
}

/** Find the captured submit_slots tool handler the agent registered. */
function submitSlotsHandler(): (p: unknown) => unknown {
  const tool = h.capturedTools.find((t) => t.name === 'submit_slots')
  if (!tool?.handler) throw new Error('submit_slots tool/handler was not registered')
  return tool.handler
}

describe('runCopilotAgent — never-writes-SPARQL boundary', () => {
  beforeEach(() => {
    // NB: do NOT reset h.capturedTools — the agent's session pool is created
    // once (module-cached) on the first runCopilotAgent call, so createSession
    // (which captures the tools) runs only once across the suite. The tools are
    // identical for every session, so keeping the first capture is correct.
    vi.clearAllMocks()
  })

  it('compiles from the routed submission (pipeline SPARQL) when the LLM tool-calls', async () => {
    // Simulate the SDK delivering a submit_slots tool call: invoke the real
    // handler with the token embedded in the prompt.
    h.session.sendAndWait.mockImplementation(async ({ prompt }: { prompt: string }) => {
      const token = prompt.match(TOKEN_RE)?.[1]
      expect(token, 'prompt must carry a request token').toBeTruthy()
      submitSlotsHandler()(validSubmission(token!))
    })

    const { runCopilotAgent } = await import('../copilot-agent.js')
    const res = await runCopilotAgent('german highways')

    const { runSlotPipeline } = await import('../run-slot-pipeline.js')
    const { buildEmptyFallbackResponse } = await import('../empty-fallback.js')
    expect(runSlotPipeline).toHaveBeenCalledOnce()
    expect(buildEmptyFallbackResponse).not.toHaveBeenCalled()
    expect(res.sparql).toBe(h.PIPELINE_SPARQL)
  })

  it('resolves from the routed submission without waiting for session.idle', async () => {
    // Regression for the production failure "Timeout after 60000ms waiting for
    // session.idle": the model routes submit_slots (turn 0), but the SDK's
    // sendAndWait keeps blocking because the model then emits a DISCARDED
    // natural-language summary turn — which, combined with the tool-call turn,
    // can exceed the SDK's hard-coded 60s ceiling. The agent must resolve from
    // the routed submission the instant it arrives, NOT block on session.idle.
    // Before the fix this test hangs until the vitest timeout (the old code
    // `await`ed sendAndWait, which here never resolves).
    h.session.sendAndWait.mockImplementation(({ prompt }: { prompt: string }) => {
      const token = prompt.match(TOKEN_RE)?.[1]
      expect(token, 'prompt must carry a request token').toBeTruthy()
      // Tool call completes (turn 0) → submission routed synchronously…
      submitSlotsHandler()(validSubmission(token!))
      // …but the session NEVER goes idle (stuck on its discarded summary turn).
      return new Promise<never>(() => {})
    })

    const { runCopilotAgent } = await import('../copilot-agent.js')
    const res = await runCopilotAgent('german highways')

    const { runSlotPipeline } = await import('../run-slot-pipeline.js')
    const { buildEmptyFallbackResponse } = await import('../empty-fallback.js')
    expect(runSlotPipeline).toHaveBeenCalledOnce()
    expect(buildEmptyFallbackResponse).not.toHaveBeenCalled()
    expect(res.sparql).toBe(h.PIPELINE_SPARQL)
    // The used session is still discarded even though we bailed early on idle.
    expect(h.session.disconnect).toHaveBeenCalledOnce()
  })

  it('falls back deterministically when the LLM does NOT submit slots', async () => {
    // The round-trip returns without invoking the tool handler (LLM emitted
    // only prose).
    h.session.sendAndWait.mockResolvedValue(undefined)

    const { runCopilotAgent } = await import('../copilot-agent.js')
    const res = await runCopilotAgent('something the model just chatted about')

    const { runSlotPipeline } = await import('../run-slot-pipeline.js')
    const { buildEmptyFallbackResponse } = await import('../empty-fallback.js')
    expect(buildEmptyFallbackResponse).toHaveBeenCalledOnce()
    expect(runSlotPipeline).not.toHaveBeenCalled()
    expect(res.sparql).toBe(h.FALLBACK_SPARQL)
  })

  it('never emits LLM prose as SPARQL — a model-authored query string is ignored', async () => {
    // The SDK round-trip "returns" an arbitrary SPARQL string as if the model
    // wrote one in prose. runCopilotAgent only reads the routed submission, so
    // this string can never reach the result.
    const MALICIOUS = 'DROP GRAPH <urn:graph:schema> ; SELECT * WHERE { ?s ?p ?o }'
    h.session.sendAndWait.mockResolvedValue({ text: MALICIOUS })

    const { runCopilotAgent } = await import('../copilot-agent.js')
    const res = await runCopilotAgent('please just run this raw query')

    expect(res.sparql).toBe(h.FALLBACK_SPARQL)
    expect(res.sparql).not.toContain('DROP GRAPH')
  })

  it('a malformed tool submission is rejected by the router → deterministic fallback', async () => {
    // The handler routes a payload missing required fields; route() returns
    // {ok:false}, no callback fires, so the agent falls back rather than
    // compiling from a half-formed submission.
    h.session.sendAndWait.mockImplementation(async ({ prompt }: { prompt: string }) => {
      const token = prompt.match(TOKEN_RE)?.[1]
      const result = await submitSlotsHandler()({ requestToken: token, slots: 'not-an-object' })
      // The router rejects the malformed payload back to the SDK.
      expect(result).toMatchObject({ accepted: false })
    })

    const { runCopilotAgent } = await import('../copilot-agent.js')
    const res = await runCopilotAgent('garbage in')

    const { runSlotPipeline } = await import('../run-slot-pipeline.js')
    expect(runSlotPipeline).not.toHaveBeenCalled()
    expect(res.sparql).toBe(h.FALLBACK_SPARQL)
  })

  it('propagates an abort without compiling', async () => {
    const controller = new AbortController()
    controller.abort()
    h.session.sendAndWait.mockResolvedValue(undefined)

    const { runCopilotAgent } = await import('../copilot-agent.js')
    await expect(runCopilotAgent('q', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })

    const { runSlotPipeline } = await import('../run-slot-pipeline.js')
    const { buildEmptyFallbackResponse } = await import('../empty-fallback.js')
    expect(runSlotPipeline).not.toHaveBeenCalled()
    expect(buildEmptyFallbackResponse).not.toHaveBeenCalled()
  })
})
