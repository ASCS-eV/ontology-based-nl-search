/**
 * Regression tests for the shared post-LLM pipeline.
 *
 * Before this helper, the same six-step sequence
 *   correctFilters → SHACL filter → SHACL ranges → correctDomains
 *   → compileSlots → validateSlots
 * was copy-pasted between the Vercel-SDK and Copilot-SDK agents. A bug
 * fix in one was not in the other. These tests pin the contract of the
 * unified helper directly — both provider call sites become trivial
 * delegations.
 *
 * The suite drives the real workspace ontology through the real
 * SHACL validator and the real compiler. The only mocked surface is
 * the upstream LLM submission, which is constructed by hand.
 */

import { Stopwatch } from '@ontology-search/core/logging'
import { extractVocabulary, getInitializedStore } from '@ontology-search/search'
import { beforeAll, describe, expect, it } from 'vitest'

import { runSlotPipeline, type SlotPipelineSubmission } from '../run-slot-pipeline.js'

let vocabulary: Awaited<ReturnType<typeof extractVocabulary>>

beforeAll(async () => {
  const store = await getInitializedStore()
  vocabulary = await extractVocabulary(store)
}, 60_000)

function submission(overrides: Partial<SlotPipelineSubmission['slots']>): SlotPipelineSubmission {
  return {
    slots: overrides,
    interpretation: { summary: 'test', mappedTerms: [] },
    gaps: [],
  }
}

describe('runSlotPipeline', () => {
  it('corrects case / typo on enum filter values via fuzzy matching', async () => {
    const sw = new Stopwatch()
    // hdmap:roadTypes uses sh:in with values like "motorway". Casing variants
    // ("MOTORWAY") and tiny typos should be corrected by correctFilters before
    // SHACL validation sees them.
    const response = await runSlotPipeline({
      submission: submission({ filters: { roadTypes: 'MOTORWAY' } }),
      vocabulary,
      targetDomain: 'hdmap',
      sw,
    })
    expect(response.sparql).toContain('?roadTypes')
    // The compiler emits the corrected value, not the LLM's original.
    expect(response.sparql).toContain('motorway')
    expect(response.sparql).not.toContain('MOTORWAY')
  }, 60_000)

  it('drops a filter value that violates a declared SHACL constraint', async () => {
    const sw = new Stopwatch()
    // georeference:country requires the ISO two-letter pattern. A bogus
    // value must be dropped from the slots and surface in `gaps`.
    const response = await runSlotPipeline({
      submission: submission({ location: { country: 'notacountry' } }),
      vocabulary,
      targetDomain: 'hdmap',
      sw,
    })
    expect(response.sparql).not.toContain('notacountry')
    expect(response.gaps.length).toBeGreaterThan(0)
    expect(response.gaps.some((g) => g.term.includes('notacountry'))).toBe(true)
  }, 60_000)

  it('drops a range whose property name is not in the ontology', async () => {
    const sw = new Stopwatch()
    // `numberLanes` is a known hallucination — the ontology has
    // numberObjects / numberIntersections / numberTrafficLights instead.
    const response = await runSlotPipeline({
      submission: submission({ ranges: { numberLanes: { min: 1, max: 4 } } }),
      vocabulary,
      targetDomain: 'hdmap',
      sw,
    })
    expect(response.sparql).not.toContain('numberLanes')
    // A gap explains the drop so the LLM caller can revise.
    expect(response.gaps.some((g) => g.term === 'numberLanes')).toBe(true)
  }, 60_000)

  it('produces compilable SPARQL for the full filter + range + location combination', async () => {
    // Policy-gate coverage for combined slots lives in
    // packages/search/src/__tests__/compiler.snapshots.test.ts (task 04); here
    // we only assert the helper threads the inputs through to the compiler
    // and returns a non-trivial result for the integrated case.
    const sw = new Stopwatch()
    const response = await runSlotPipeline({
      submission: submission({
        filters: { roadTypes: 'motorway' },
        ranges: { numberIntersections: { min: 5 } },
        location: { country: 'DE' },
      }),
      vocabulary,
      targetDomain: 'hdmap',
      sw,
    })
    expect(response.sparql).toContain('?asset a hdmap:HdMap')
    expect(response.sparql).toContain('motorway')
    expect(response.sparql).toContain('numberIntersections')
    expect(response.sparql).toMatch(/\?country/)
  }, 60_000)

  it('falls back to targetDomain when the submission has empty domains', async () => {
    const sw = new Stopwatch()
    // Submission has empty filters/ranges and no explicit `domains`. The
    // helper must seed `[targetDomain]` so the compiler narrows to that
    // domain instead of running the cross-domain superclass query.
    const response = await runSlotPipeline({
      submission: submission({}),
      vocabulary,
      targetDomain: 'scenario',
      sw,
    })
    expect(response.sparql).toContain('?asset a scenario:Scenario')
  }, 60_000)

  it('preserves the LLM interpretation summary and concatenates new gaps', async () => {
    const sw = new Stopwatch()
    // Note: the final `validateSlots` step recomputes confidence based on
    // which slots actually survived SHACL — so we don't assert the
    // confidence field. The summary and mapped term identities must
    // survive untouched.
    const originalGap = { term: 'foobar', reason: 'unknown concept' }
    const response = await runSlotPipeline({
      submission: {
        slots: { filters: { roadTypes: 'motorway' } },
        interpretation: {
          summary: 'Looking for HD maps with motorways',
          mappedTerms: [
            { input: 'motorways', mapped: 'motorway', confidence: 'high', property: 'roadTypes' },
          ],
        },
        gaps: [originalGap],
      },
      vocabulary,
      targetDomain: 'hdmap',
      sw,
    })
    expect(response.interpretation.summary).toBe('Looking for HD maps with motorways')
    expect(response.interpretation.mappedTerms).toHaveLength(1)
    expect(response.interpretation.mappedTerms[0]?.input).toBe('motorways')
    expect(response.interpretation.mappedTerms[0]?.mapped).toBe('motorway')
    // The pre-existing gap from the submission survives the merge. The final
    // validateSlots step may enrich it with nearest-vocab `suggestions`, so
    // we assert identity by term/reason rather than deep equality.
    const survived = response.gaps.find((g) => g.term === originalGap.term)
    expect(survived).toBeDefined()
    expect(survived?.reason).toBe(originalGap.reason)
  }, 60_000)

  it('records "post-llm-validation" and "sparql-compile" stages on the stopwatch', async () => {
    const sw = new Stopwatch()
    await runSlotPipeline({
      submission: submission({}),
      vocabulary,
      targetDomain: 'hdmap',
      sw,
    })
    const timings = sw.getTimings()
    const stageNames = timings.map((t) => t.stage)
    expect(stageNames).toContain('post-llm-validation')
    expect(stageNames).toContain('sparql-compile')
  }, 60_000)
})
