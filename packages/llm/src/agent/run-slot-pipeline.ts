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
import type { OntologyVocabulary } from '@ontology-search/search'
import {
  expandFilterConcepts,
  getConceptExpansionIndex,
  getInitializedStore,
  ShaclValidator,
} from '@ontology-search/search'
import { compileSlotsWithTrace, resolveKnownDomains } from '@ontology-search/search/compiler'
import type { ReferenceFilter, SearchSlots } from '@ontology-search/search/slots'
import { normalizeReferences } from '@ontology-search/search/slots'

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
    // Accept the array form and the legacy single-object form; normalized to an
    // array before compilation.
    references?: { domain: string; label?: string } | { domain: string; label?: string }[]
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
  // 1b. Concept-hierarchy expansion: if a filter value names a broad
  // SKOS concept ("Europe", "Scandinavia", a vehicle super-category),
  // expand it to its transitive narrower members so a literal-valued
  // property matches the explicit set. Data-driven — no region table
  // is hardcoded; an ontology with no SKOS hierarchy gets a no-op.
  const store = await getInitializedStore()
  const conceptIndex = await getConceptExpansionIndex(store)
  const expandedFilters = expandFilterConcepts(fuzzedFilters, conceptIndex)
  // 2. SHACL gate: enforces every Core constraint declared in the shapes
  // graph (sh:pattern, sh:datatype, …) on every filter value, including
  // the geographic and license keys that used to live in dedicated
  // sub-shapes. Values that fail are dropped and emitted as gaps.
  const shacl = await ShaclValidator.fromWorkspace()
  const shaclResult = await validateSlotsAgainstShacl(expandedFilters, shacl, vocabulary)
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
  // 4b. Drop any domain the registry can't resolve — an LLM-hallucinated
  // "unknown", a typo, or an extraction artifact. The compiler skips these
  // silently when building UNION arms, so leaving them in `slots.domains`
  // only pollutes the interpretation with a phantom `domain:unknown` row
  // that never affected the SPARQL. Filtering here keeps the interpretation
  // honest about what was actually compiled.
  const knownDomains = await resolveKnownDomains(correctedDomains)

  // 4c. references.* are cross-reference JOIN targets (parent → child via the
  // discovered chain), not peers of the primary domain. Normalize to an array,
  // promote any references the LLM named in its narrative but omitted from the
  // structured slot (a real miss observed in testing — now ALL named ones are
  // promoted, since multiple references are supported), then canonicalize each
  // to a known asset domain, drop unknowns, dedupe, and remove them from the
  // peer set so the single-domain JOIN path (not peer-UNION) is taken. The
  // compiler AND-combines the resulting references.
  const requestedRefs = normalizeReferences(
    submission.slots.references as ReferenceFilter | ReferenceFilter[] | undefined
  )
  const slotRefDomains = new Set(requestedRefs.map((r) => r.domain))
  for (const named of new Set(
    (submission.interpretation.mappedTerms ?? [])
      .filter((t) => t.property?.startsWith('references') && t.mapped?.trim())
      .map((t) => t.mapped!.trim())
  )) {
    if (!slotRefDomains.has(named)) requestedRefs.push({ domain: named })
  }

  const normalizedReferences: ReferenceFilter[] = []
  const referencedDomains = new Set<string>()
  for (const ref of requestedRefs) {
    const [canonical] = await resolveKnownDomains([ref.domain])
    if (canonical && !referencedDomains.has(canonical)) {
      referencedDomains.add(canonical)
      normalizedReferences.push({ ...ref, domain: canonical })
    }
  }
  const primaryDomains = knownDomains.filter((d) => !referencedDomains.has(d))
  endValidation()

  const slots: SearchSlots = {
    domains: primaryDomains,
    filters: shaclResult.filters,
    ranges: rangeResult.ranges,
    references: normalizedReferences.length > 0 ? normalizedReferences : undefined,
  }

  // 5. Deterministic SPARQL compilation. Capture the traceability plan
  // so per-row breadcrumbs surface downstream in `ExecutionResult` —
  // the trace is `undefined` for plain queries (no cross-reference JOIN).
  const endCompile = sw.time('sparql-compile')
  const { sparql, trace } = await compileSlotsWithTrace(slots)
  endCompile()

  // Enrich interpretation with the final domains and applied filters
  // so the user can see exactly what was compiled.
  const enrichedInterpretation = {
    ...submission.interpretation,
    domains: slots.domains,
    appliedFilters: Object.keys(slots.filters).length > 0 ? slots.filters : undefined,
  }

  const rawResponse: LlmStructuredResponse = {
    interpretation: enrichedInterpretation,
    gaps: [...submission.gaps, ...shaclResult.gaps, ...rangeResult.gaps],
    sparql,
    trace,
  }

  // 6. Final post-compile sanity / confidence-floor pass.
  return validateSlots(rawResponse, vocabulary)
}
