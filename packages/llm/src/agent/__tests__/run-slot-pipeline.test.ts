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
}, 120_000)

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
  }, 120_000)

  it('drops a filter value that violates a declared SHACL constraint', async () => {
    const sw = new Stopwatch()
    // georeference:country requires the ISO two-letter pattern. A bogus
    // value must be dropped from the slots and surface in `gaps`.
    const response = await runSlotPipeline({
      submission: submission({ filters: { country: 'notacountry' } }),
      vocabulary,
      targetDomain: 'hdmap',
      sw,
    })
    expect(response.sparql).not.toContain('notacountry')
    expect(response.gaps.length).toBeGreaterThan(0)
    expect(response.gaps.some((g) => g.term.includes('notacountry'))).toBe(true)
  }, 120_000)

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
  }, 120_000)

  it('promotes a single under-filled reference from mappedTerms into a compiled JOIN', async () => {
    const sw = new Stopwatch()
    // The LLM named a cross-reference in its narrative (mappedTerms) but left
    // the structured `references` slot empty — the legitimate single JOIN must
    // still compile (ositrace -> hdmap via the manifest chain), not be dropped.
    const response = await runSlotPipeline({
      submission: {
        slots: { domains: ['ositrace'] },
        interpretation: {
          summary: 'test',
          mappedTerms: [
            {
              input: 'with maps',
              mapped: 'hdmap',
              confidence: 'low',
              property: 'references.domain',
            },
          ],
        },
        gaps: [],
      },
      vocabulary,
      targetDomain: 'ositrace',
      sw,
    })
    // The cross-domain JOIN to hdmap compiled (the reference target appears).
    expect(response.sparql).toContain('hdmap:HdMap')
    // And it was NOT reported as a dropped/limitation gap.
    expect(response.gaps.some((g) => g.kind === 'limitation')).toBe(false)
  }, 120_000)

  it('applies ALL named references (AND-combined), no longer dropping the extras', async () => {
    const sw = new Stopwatch()
    const response = await runSlotPipeline({
      submission: {
        slots: { domains: ['scenario'], references: { domain: 'ositrace' } },
        interpretation: {
          summary: 'test',
          mappedTerms: [
            {
              input: 'from traces',
              mapped: 'ositrace',
              confidence: 'low',
              property: 'references.domain',
            },
            {
              input: 'with maps',
              mapped: 'hdmap',
              confidence: 'low',
              property: 'references.domain',
            },
          ],
        },
        gaps: [],
      },
      vocabulary,
      targetDomain: 'scenario',
      sw,
    })
    // Multi-reference is now supported: BOTH the slot reference (ositrace) and
    // the additionally-named one (hdmap) compile into JOINs, AND-combined.
    expect(response.sparql).toContain('ositrace:OSITrace')
    expect(response.sparql).toContain('hdmap:HdMap')
    // Nothing is dropped → no limitation gap.
    expect(response.gaps.some((g) => g.kind === 'limitation')).toBe(false)
  }, 120_000)

  it('classifies a gap whose term was successfully mapped as a recognized concept', async () => {
    const sw = new Stopwatch()
    // The LLM emits a gap for "highways" but also mapped it to the roadTypes
    // value "motorway". That is an interpretation note about a concept we DID
    // understand — `recognized`, not `unmapped` (the old "Not in ontology").
    const response = await runSlotPipeline({
      submission: {
        slots: { domains: ['hdmap'], filters: { roadTypes: 'motorway' } },
        interpretation: {
          summary: 'test',
          mappedTerms: [
            { input: 'highways', mapped: 'motorway', confidence: 'high', property: 'roadTypes' },
          ],
        },
        gaps: [{ term: 'highways', reason: 'interpreted as the motorway road type' }],
      },
      vocabulary,
      targetDomain: 'hdmap',
      sw,
    })
    expect(response.gaps.find((g) => g.term === 'highways')?.kind).toBe('recognized')
  }, 120_000)

  it('produces compilable SPARQL for the full filter + range + location combination', async () => {
    // Policy-gate coverage for combined slots lives in
    // packages/search/src/__tests__/compiler.snapshots.test.ts (task 04); here
    // we only assert the helper threads the inputs through to the compiler
    // and returns a non-trivial result for the integrated case.
    const sw = new Stopwatch()
    const response = await runSlotPipeline({
      submission: submission({
        filters: { roadTypes: 'motorway', country: 'DE' },
        ranges: { numberIntersections: { min: 5 } },
      }),
      vocabulary,
      targetDomain: 'hdmap',
      sw,
    })
    expect(response.sparql).toContain('?asset a hdmap:HdMap')
    expect(response.sparql).toContain('motorway')
    expect(response.sparql).toContain('numberIntersections')
    expect(response.sparql).toMatch(/\?country/)
  }, 120_000)

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
  }, 120_000)

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
  }, 120_000)

  it('removes the references child from the peer-domain set so the JOIN path is taken', async () => {
    // Regression: when the LLM emits both `domains: [parent, child]` AND
    // `references: { domain: child }`, the compiler's peer-UNION path was
    // silently ignoring the references slot and emitting two independent
    // arms instead of a join. The pipeline must canonicalise the reference
    // domain and exclude it from the primary-domain set so compileSlots
    // routes through the single-domain cross-reference path.
    //
    // Whether the compiler then emits an actual JOIN depends on the SHACL
    // declaring a chain between the chosen pair (a separate ontology
    // concern). What we assert here is the pipeline-level contract: the
    // child no longer pollutes `slots.domains`, and the compiled SPARQL is
    // NOT a peer UNION of two top-level asset classes.
    const sw = new Stopwatch()
    const response = await runSlotPipeline({
      submission: submission({
        domains: ['scenario', 'hdmap'],
        references: { domain: 'hdmap' },
      }),
      vocabulary,
      targetDomain: 'scenario',
      sw,
    })
    expect(response.interpretation.domains).toEqual(['scenario'])
    expect(response.sparql).toContain('scenario:Scenario')
    // The cross-reference JOIN must emit (either via a SHACL-declared chain
    // or, when the SHACL doesn't surface one, the data-driven any-predicate
    // fallback). The child class is anchored on `?refAsset`, never on
    // `?asset` — that would be a peer-UNION mistake.
    expect(response.sparql).toContain('?refAsset')
    expect(response.sparql).toContain('hdmap:HdMap')
    expect(response.sparql).not.toMatch(/\?asset\s+a\s+hdmap:HdMap/)
    expect(response.sparql).not.toContain('UNION')
  }, 120_000)

  it("drops the references slot when its domain isn't an asset domain", async () => {
    // Defensive: the LLM may name a non-asset support vocabulary (e.g. the
    // gx fallback domain) as the references target. Without resolution that
    // would be carried into the compiler, which would just skip emission.
    // Dropping it in the pipeline keeps the interpretation honest.
    const sw = new Stopwatch()
    const response = await runSlotPipeline({
      submission: submission({
        domains: ['hdmap'],
        references: { domain: 'definitely-not-a-domain' },
      }),
      vocabulary,
      targetDomain: 'hdmap',
      sw,
    })
    expect(response.sparql).not.toContain('?refAsset')
  }, 120_000)

  /**
   * Multi-reference projects only the FIRST referenced asset (`?refAsset` +
   * breadcrumb); additional references are filter-only JOINs (bound but not
   * projected), so the asset must reference all of them while the result shape
   * and breadcrumb stay single-reference. Displaying every referenced asset is
   * a follow-up.
   */
  it('projects the first reference and applies the rest as filter-only JOINs', async () => {
    const sw = new Stopwatch()
    const response = await runSlotPipeline({
      submission: {
        slots: {
          domains: ['scenario'],
          filters: {},
          ranges: {},
          references: [{ domain: 'ositrace' }, { domain: 'hdmap' }],
        },
        interpretation: { summary: 'mock submission', mappedTerms: [] },
        gaps: [],
      },
      vocabulary,
      targetDomain: 'scenario',
      sw,
    })
    // Both references are AND-combined JOINs (both target classes present).
    expect(response.sparql).toContain('ositrace:OSITrace')
    expect(response.sparql).toContain('hdmap:HdMap')
    // Exactly one projected referenced asset (?refAsset); the rest are suffixed
    // filter-only vars that never reach the SELECT.
    expect(response.sparql).toMatch(/SELECT[^\n]*\?refAsset\b/)
    expect(response.sparql).not.toMatch(/SELECT[^\n]*\?refAsset1\b/)
    // No dropping → no limitation gap.
    expect(response.gaps.some((g) => g.kind === 'limitation')).toBe(false)
  }, 120_000)

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
  }, 120_000)
})
