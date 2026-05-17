/**
 * Post-LLM slot validation + compilation pipeline shared by every agent.
 *
 * Both the Vercel-SDK agent and the Copilot agent ran the same six steps
 * after the LLM produced a slot submission:
 *
 *   1. Fuzzy-match enum values (case / typo correction against `sh:in`).
 *   2. SHACL filter validation — drop values that violate any Core constraint.
 *   3. SHACL range validation — drop ranges with hallucinated property names.
 *   4. `correctDomains` — reassign domains based on which properties survived.
 *   5. `compileSlots` — deterministic SPARQL emission.
 *   6. `validateSlots` — final post-compile sanity / confidence-floor pass.
 *
 * Until this module those steps were copy-pasted across the two agents.
 * A bug fix in one provider was not in the other; testing the pipeline at
 * the unit level required two parallel suites. Pulling the steps out makes
 * the post-LLM contract a single, directly-testable function regardless of
 * which provider supplied the submission.
 *
 * @see packages/llm/src/agent/index.ts — Vercel-SDK caller
 * @see packages/llm/src/agent/copilot-agent.ts — Copilot-SDK caller
 */

import type { Stopwatch } from '@ontology-search/core/logging'
import { ShaclValidator } from '@ontology-search/ontology/shacl-validator'
import type { OntologyVocabulary } from '@ontology-search/search'
import { compileSlots } from '@ontology-search/search/compiler'
import type { SearchSlots } from '@ontology-search/search/slots'

import {
  correctDomains,
  correctFilters,
  validateRangesAgainstShacl,
  validateSlots,
  validateSlotsAgainstShacl,
} from '../slot-validator.js'
import type { LlmStructuredResponse, OntologyGap, QueryInterpretation } from '../types.js'

/**
 * Shape of a slot submission as received from any LLM provider.
 *
 * The two existing submission types (`SlotSubmissionParams` from
 * `tools.ts` and `Submission` from `submission-router.ts`) are
 * structurally compatible with this interface — both have an `interpretation`
 * and `gaps` matching the canonical search types, plus a `slots` shape with
 * the same optional fields. Keeping this interface here, rather than in
 * either submission module, avoids a directional dependency between the two
 * provider files.
 */
export interface SlotPipelineSubmission {
  slots: {
    domains?: string[]
    filters?: Record<string, string | string[]>
    ranges?: Record<string, { min?: number; max?: number }>
    location?: {
      country?: string | string[]
      state?: string | string[]
      region?: string | string[]
      city?: string | string[]
    }
    license?: string
  }
  interpretation: QueryInterpretation
  gaps: OntologyGap[]
}

export interface SlotPipelineInput {
  submission: SlotPipelineSubmission
  vocabulary: OntologyVocabulary
  /** Fallback domain when the submission's `slots.domains` is empty. */
  targetDomain: string
  /**
   * Stopwatch from the calling agent. The pipeline records two sub-stages
   * here — `post-llm-validation` and `sparql-compile` — so existing trace
   * output remains identical. The caller attaches the final `timings` on
   * its return value via `sw.getTimings()`.
   */
  sw: Stopwatch
}

/**
 * Run the post-LLM pipeline. Returns the validated `LlmStructuredResponse`
 * **without** `timings` — the caller appends `sw.getTimings()` on its own
 * return so the recorded stages cover the whole agent invocation, not just
 * this helper.
 */
export async function runSlotPipeline(input: SlotPipelineInput): Promise<LlmStructuredResponse> {
  const { submission, vocabulary, targetDomain, sw } = input

  const endValidation = sw.time('post-llm-validation')
  // 1. Fuzzy match: case / typo correction against sh:in enums.
  const fuzzedFilters = correctFilters(submission.slots.filters ?? {}, vocabulary)
  // 2. SHACL gate: enforces every Core constraint declared in the shapes
  // graph (sh:pattern, sh:datatype, …) on filters, location, and license.
  // Values that fail are dropped from slots and emitted as gaps.
  const shacl = await ShaclValidator.fromWorkspace()
  const shaclResult = await validateSlotsAgainstShacl(
    fuzzedFilters,
    submission.slots.location,
    submission.slots.license,
    shacl,
    vocabulary
  )
  // 3. Ranges go through their own check: numeric values always pass SHACL
  // datatype constraints, so we only need to confirm the property name is
  // known. Hallucinated keys (e.g. `numberLanes`) are dropped here.
  const rangeResult = validateRangesAgainstShacl(submission.slots.ranges ?? {}, shacl)
  // 4. Reassign domains based on the union of surviving filter / range keys.
  const correctedDomains = correctDomains(
    submission.slots.domains ?? [targetDomain],
    shaclResult.filters,
    rangeResult.ranges,
    vocabulary
  )
  endValidation()

  const slots: SearchSlots = {
    domains: correctedDomains,
    filters: shaclResult.filters,
    ranges: rangeResult.ranges,
    location: shaclResult.location,
    license: shaclResult.license,
  }

  // 5. Deterministic SPARQL compilation.
  const endCompile = sw.time('sparql-compile')
  const sparql = await compileSlots(slots)
  endCompile()

  const rawResponse: LlmStructuredResponse = {
    interpretation: submission.interpretation,
    gaps: [...submission.gaps, ...shaclResult.gaps, ...rangeResult.gaps],
    sparql,
  }

  // 6. Final post-compile sanity / confidence-floor pass.
  return validateSlots(rawResponse, vocabulary)
}
