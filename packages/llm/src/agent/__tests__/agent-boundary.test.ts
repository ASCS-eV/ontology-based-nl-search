/**
 * Agent boundary regression tests.
 *
 * The CLAUDE.md security invariant:
 *
 *   "The LLM never writes SPARQL. It fills SearchSlots via a single tool
 *    call. The compiler is deterministic — same slots always produce the
 *    same query. This is the security model: no prompt injection can
 *    produce arbitrary queries."
 *
 * The invariant is structural: the agent extracts `submit_slots` tool
 * results from `result.steps[].toolResults`. It never reads
 * `result.text`. So no LLM-emitted text bytes can become SPARQL — the
 * only two SPARQL emission paths are:
 *
 *   1. `runSlotPipeline(submission)` — compiles from a validated
 *      submission. SHACL gates filter out any value that violates a
 *      declared constraint.
 *   2. The fallback `compileSlots(fallbackSlots)` where `fallbackSlots`
 *      is a synthetic object the agent builds when the LLM did NOT
 *      tool-call.
 *
 * These tests pin that structural property with mocks. They are
 * intentionally ontology-agnostic: assertions check the SHAPE of the
 * response (was a tool call extracted? did the SPARQL get rebuilt? did
 * the LLM text leak?) rather than any specific schema. Sister tests
 * `submission-router.test.ts` and `run-slot-pipeline.test.ts` cover
 * the per-component contracts in detail.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Hoisted constants (visible inside vi.mock factories) ──────────────────

const { PIPELINE_SPARQL, FALLBACK_SPARQL } = vi.hoisted(() => ({
  PIPELINE_SPARQL: 'SELECT ?asset WHERE { ?asset ?p ?o } # from runSlotPipeline',
  FALLBACK_SPARQL: 'SELECT ?asset WHERE { ?asset ?p ?o } # from compileSlots fallback',
}))

// ─── Module-level mocks (hoisted by vitest) ────────────────────────────────

// `ai` package: only `generateText`, `stepCountIs`, and `tool` are used by
// the agent. `tool` is a passthrough so tools.ts's schema definition still
// resolves; we never execute the tool inside these tests.
vi.mock('ai', () => ({
  generateText: vi.fn(),
  stepCountIs: vi.fn().mockReturnValue(undefined),
  tool: vi.fn().mockImplementation((def) => def),
}))

// Provider injection — return a stub model. The mocked `generateText`
// ignores the model argument anyway.
vi.mock('../../provider.js', () => ({
  getModel: vi.fn().mockReturnValue({}),
}))

// Replace the prompt-building dependencies so the agent does not touch the
// real ontology workspace. Vocabulary shape is irrelevant — these tests
// don't run `runSlotPipeline` for real.
vi.mock('@ontology-search/search', () => ({
  extractVocabulary: vi
    .fn()
    .mockResolvedValue({ properties: new Map(), valueToProperty: new Map(), domains: [] }),
  getInitializedStore: vi.fn().mockResolvedValue({}),
}))

vi.mock('@ontology-search/search/shacl-reader', () => ({
  getShaclContent: vi.fn().mockReturnValue([]),
}))

// Mock the two downstream emission paths so we can assert WHICH path was
// taken without needing the real compiler / schema / SPARQL store. The
// distinct mock outputs (PIPELINE_SPARQL / FALLBACK_SPARQL, hoisted above)
// let assertions distinguish the two paths cleanly.
vi.mock('../run-slot-pipeline.js', () => ({
  runSlotPipeline: vi.fn().mockImplementation(async ({ submission }) => ({
    interpretation: submission.interpretation,
    gaps: submission.gaps,
    sparql: PIPELINE_SPARQL,
  })),
}))

vi.mock('@ontology-search/search/compiler', () => ({
  compileSlots: vi.fn().mockResolvedValue(FALLBACK_SPARQL),
}))

vi.mock('../../prompt-builder.js', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue('mocked system prompt'),
}))

// ─── Imports come AFTER vi.mock() calls ────────────────────────────────────

import { generateText } from 'ai'

import { runSparqlAgent } from '../index.js'

// ─── Test helpers ──────────────────────────────────────────────────────────

/** Shape the agent expects from `result.steps[].toolResults[]`. */
interface FakeToolResult {
  toolName: string
  output: unknown
}

interface FakeStep {
  toolResults: FakeToolResult[]
  text?: string
}

/**
 * Build a minimal valid LLM submission. Property names are synthetic
 * (`anyProp`, `anyValue`) so the test asserts structural routing, not
 * any specific ontology vocabulary.
 */
function fakeSubmission(): FakeToolResult['output'] {
  return {
    slots: {
      domains: [],
      filters: { anyProp: 'anyValue' },
      ranges: {},
    },
    interpretation: { summary: 'fake summary', mappedTerms: [] },
    gaps: [],
  }
}

/** Drive `generateText` to return a result with the given steps. */
function mockLlmResult(steps: FakeStep[]): void {
  vi.mocked(generateText).mockResolvedValueOnce({
    steps,
  } as unknown as Awaited<ReturnType<typeof generateText>>)
}

beforeEach(() => {
  vi.clearAllMocks()
  // After clearAllMocks the runSlotPipeline / compileSlots mocks need to be
  // restored — clearAllMocks resets implementations.
  void vi.mocked(generateText).mockReset()
})

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('runSparqlAgent — agent boundary', () => {
  /**
   * Happy path: the LLM tool-calls `submit_slots` with a valid submission.
   * The agent must route the submission to `runSlotPipeline` and return
   * its SPARQL — proving the tool-call extraction works.
   */
  it('routes a valid submit_slots tool call to the post-LLM pipeline', async () => {
    mockLlmResult([{ toolResults: [{ toolName: 'submit_slots', output: fakeSubmission() }] }])

    const response = await runSparqlAgent('an opaque user query')

    expect(response.sparql).toBe(PIPELINE_SPARQL)
    expect(response.interpretation.summary).toBe('fake summary')
  })

  /**
   * Core security regression: if the LLM does NOT call `submit_slots`,
   * the agent must fall back to compiling synthetic empty slots. Any
   * text the LLM produced (including raw SPARQL) is ignored — only the
   * `result.steps[].toolResults[]` channel is read.
   *
   * Prompt-injection class this test pins: "LLM emits `DROP ALL` in
   * its text response". The returned `result.sparql` must contain
   * exactly the deterministic fallback emission — none of the injected
   * bytes.
   */
  it('falls back to compiler-generated SPARQL when no tool call is made — LLM text is ignored', async () => {
    const maliciousText =
      'DROP ALL ; INSERT DATA { <http://attacker/> <http://attacker/p> "pwn" } ; LOAD <http://attacker/evil.ttl>'
    mockLlmResult([{ toolResults: [], text: maliciousText }])

    const response = await runSparqlAgent('user query whose response is hostile')

    // Fallback SPARQL is the only emission path — none of the LLM's
    // text bytes reach the compiled query.
    expect(response.sparql).toBe(FALLBACK_SPARQL)
    expect(response.sparql).not.toContain('DROP')
    expect(response.sparql).not.toContain('INSERT')
    expect(response.sparql).not.toContain('LOAD')
    expect(response.sparql).not.toContain('attacker')
    expect(response.sparql).not.toContain(maliciousText)
  })

  /**
   * Variant: the LLM emits a perfectly valid SPARQL string in its text
   * channel (NOT as a tool call). The agent must still ignore it.
   * Without this regression the agent could be tricked into returning
   * an LLM-authored query to the client and bypassing the compiler.
   */
  it('ignores a SPARQL string emitted in result.text when there is no tool call', async () => {
    const llmAuthoredSparql =
      'SELECT ?secret WHERE { ?secret <http://attacker/passwd> ?leak } LIMIT 100000'
    mockLlmResult([{ toolResults: [], text: llmAuthoredSparql }])

    const response = await runSparqlAgent('test')

    expect(response.sparql).toBe(FALLBACK_SPARQL)
    expect(response.sparql).not.toContain('secret')
    expect(response.sparql).not.toContain('passwd')
    expect(response.sparql).not.toContain('100000')
  })

  /**
   * When the LLM emits multiple `submit_slots` tool calls in a single
   * response, the agent picks the first via `Array.prototype.find`.
   * Pinning that here guards against an accidental switch to `.findLast`,
   * `.filter`, or iteration order changes that would make the choice
   * non-deterministic across providers.
   */
  it('uses only the first submit_slots when the LLM emits multiple', async () => {
    const first = {
      slots: { domains: [], filters: { which: 'first' }, ranges: {} },
      interpretation: { summary: 'first', mappedTerms: [] },
      gaps: [],
    }
    const second = {
      slots: { domains: [], filters: { which: 'second' }, ranges: {} },
      interpretation: { summary: 'second', mappedTerms: [] },
      gaps: [],
    }
    mockLlmResult([
      {
        toolResults: [
          { toolName: 'submit_slots', output: first },
          { toolName: 'submit_slots', output: second },
        ],
      },
    ])

    const response = await runSparqlAgent('test')

    expect(response.interpretation.summary).toBe('first')
  })

  /**
   * Unknown tool names are ignored. Only `submit_slots` is consumed —
   * any other tool name the LLM hallucinates (e.g. `execute_sparql`) is
   * silently dropped and the agent takes the fallback path.
   *
   * This guards against an injection vector where a malicious system
   * prompt convinces the LLM to invoke a tool the agent never declared.
   */
  it('ignores tool calls with names other than submit_slots', async () => {
    mockLlmResult([
      {
        toolResults: [
          {
            toolName: 'execute_sparql',
            output: { query: 'DELETE WHERE { ?s ?p ?o }' },
          },
          {
            toolName: 'arbitrary_tool',
            output: { anything: 'goes' },
          },
        ],
      },
    ])

    const response = await runSparqlAgent('test')

    expect(response.sparql).toBe(FALLBACK_SPARQL)
    expect(response.sparql).not.toContain('DELETE')
  })

  /**
   * Empty `steps` array (a degenerate LLM response). The agent must
   * still produce a valid response via the fallback — never throw
   * something the API layer could mistake for a crash.
   */
  it('handles a degenerate empty-steps response via the fallback', async () => {
    mockLlmResult([])

    const response = await runSparqlAgent('test')

    expect(response.sparql).toBe(FALLBACK_SPARQL)
    expect(response.gaps.length).toBeGreaterThan(0)
  })

  /**
   * `LLM_TEMPERATURE` flows through to the LLM call so the
   * "deterministic by default" contract is observable from the wire.
   * Zero is the right default for an extraction task; without this
   * pin a future refactor could silently drop the field and re-
   * introduce the Mistral run-to-run variance we caught in the
   * browser pass.
   */
  it('forwards LLM_TEMPERATURE to generateText (default 0 for deterministic extraction)', async () => {
    mockLlmResult([{ toolResults: [{ toolName: 'submit_slots', output: fakeSubmission() }] }])
    await runSparqlAgent('test')
    const lastCall = vi.mocked(generateText).mock.lastCall
    expect(lastCall?.[0]?.temperature).toBe(0)
  })

  /**
   * `LLM_THINKING_BUDGET` is OFF by default — no `providerOptions` block
   * should land in the call, regardless of provider. Wiring it always
   * would shift the request shape and could break providers that
   * reject unrecognised provider-option keys.
   */
  it('omits providerOptions when LLM_THINKING_BUDGET is 0 (default)', async () => {
    mockLlmResult([{ toolResults: [{ toolName: 'submit_slots', output: fakeSubmission() }] }])
    await runSparqlAgent('test')
    const lastCall = vi.mocked(generateText).mock.lastCall
    expect(lastCall?.[0]?.providerOptions).toBeUndefined()
  })

  /**
   * The agent must forward `options.signal` to `generateText` so client
   * disconnects cancel the LLM call (the criterion #16 contract). This
   * pins the wiring at the boundary.
   */
  it('forwards options.signal to generateText for cancellation', async () => {
    mockLlmResult([{ toolResults: [{ toolName: 'submit_slots', output: fakeSubmission() }] }])

    const controller = new AbortController()
    await runSparqlAgent('test', { signal: controller.signal })

    const lastCall = vi.mocked(generateText).mock.lastCall
    expect(lastCall?.[0]?.abortSignal).toBe(controller.signal)
  })
})
