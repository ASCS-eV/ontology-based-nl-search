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
import {
  expandFilterConcepts,
  getConceptExpansionIndex,
  getInitializedStore,
} from '@ontology-search/search'
import { compileSlotsWithTrace, resolveKnownDomains } from '@ontology-search/search/compiler'
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
    references?: { domain: string; label?: string }
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

  // 4c. `references.domain` is a cross-reference JOIN target (parent →
  // child via the discovered SHACL reference chain), not a peer of the
  // primary domain. When the LLM emits both `domains: [parent, child]`
  // and `references: { domain: child }`, the compiler's peer-UNION path
  // would silently ignore the references slot and emit two independent
  // arms instead of a join. Canonicalize the reference domain and remove
  // it from the peer set so the single-domain JOIN path is taken.
  // Drop the references slot entirely when the named child isn't an
  // asset domain — the compiler can't build a chain to a phantom.
  let normalizedReferences = submission.slots.references
  let primaryDomains = knownDomains
  if (normalizedReferences?.domain) {
    const [canonicalRef] = await resolveKnownDomains([normalizedReferences.domain])
    if (canonicalRef) {
      normalizedReferences = { ...normalizedReferences, domain: canonicalRef }
      primaryDomains = knownDomains.filter((d) => d !== canonicalRef)
    } else {
      normalizedReferences = undefined
    }
  }

  // Promote a single under-filled reference. The LLM sometimes describes a
  // cross-reference in its narrative (a `references.*` mappedTerm) but leaves
  // the structured `references` slot empty — the legitimate single JOIN would
  // then be reported as "dropped" and never compiled (a real miss observed in
  // testing). When EXACTLY ONE such mapping names a known asset domain, fill
  // the slot so the JOIN compiles. Multiple distinct reference targets are left
  // to the dropped-reference report below — they genuinely need multi-reference
  // support, which is a separate workstream.
  if (!normalizedReferences?.domain) {
    const namedReferences = [
      ...new Set(
        (submission.interpretation.mappedTerms ?? [])
          .filter((t) => t.property?.startsWith('references') && t.mapped?.trim())
          .map((t) => t.mapped!.trim())
      ),
    ]
    if (namedReferences.length === 1) {
      const [canonicalRef] = await resolveKnownDomains([namedReferences[0]!])
      if (canonicalRef) {
        normalizedReferences = { domain: canonicalRef }
        primaryDomains = primaryDomains.filter((d) => d !== canonicalRef)
      }
    }
  }
  endValidation()

  const slots: SearchSlots = {
    domains: primaryDomains,
    filters: shaclResult.filters,
    ranges: rangeResult.ranges,
    references: normalizedReferences,
  }

  // 4d. Honest dropped-reference report. The LLM's mappedTerms array
  // can carry MORE than one `references.domain` entry (one per asset-
  // class the user named), but `slots.references` is a single object —
  // only one survives into the compiled SPARQL. Without an explicit
  // gap, the UI shows multiple `references.domain:` chips but the
  // SPARQL silently uses only one, leaving the user wondering why
  // their second reference didn't filter anything. Emit a gap for
  // each dropped entry so the interpretation panel is truthful about
  // what was compiled vs ignored. N-hop reference chains are tracked
  // as a separate workstream; when they land, this gap goes away.
  const droppedReferenceGaps = collectDroppedReferenceGaps(
    submission.interpretation.mappedTerms ?? [],
    normalizedReferences?.domain
  )

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
    gaps: [...submission.gaps, ...shaclResult.gaps, ...rangeResult.gaps, ...droppedReferenceGaps],
    sparql,
    trace,
  }

  // 6. Final post-compile sanity / confidence-floor pass.
  return validateSlots(rawResponse, vocabulary)
}

/**
 * Inspect the LLM's `mappedTerms` for cross-reference mappings that
 * lost the slot race. `slots.references` is a single object — when
 * the LLM names more than one asset class as a reference target, only
 * the chosen one survives compilation. The others would otherwise
 * disappear silently between the interpretation panel and the SPARQL,
 * leaving the user with a "but I asked for X too" mystery.
 *
 * Returns one gap per dropped entry, deduplicating by the mapped
 * domain name so noise stays low.
 */
function collectDroppedReferenceGaps(
  mappedTerms: ReadonlyArray<{ input?: string; mapped?: string; property?: string }>,
  chosenDomain: string | undefined
): OntologyGap[] {
  const droppedSeen = new Set<string>()
  const out: OntologyGap[] = []
  for (const term of mappedTerms) {
    // Match the property naming the LLM tool schema uses for the
    // references slot — anything starting with `references` (e.g.
    // `references.domain`) is a candidate. We tolerate variants
    // because the slot schema and the prompt examples both use it
    // and the LLM occasionally truncates.
    if (!term.property || !term.property.startsWith('references')) continue
    const mappedDomain = term.mapped?.trim()
    if (!mappedDomain) continue
    if (chosenDomain && mappedDomain === chosenDomain) continue
    if (droppedSeen.has(mappedDomain)) continue
    droppedSeen.add(mappedDomain)
    out.push({
      term: term.input || mappedDomain,
      reason: `Cross-reference to "${mappedDomain}" was dropped — only a single \`references\` slot is supported per query. Re-run the search asking for that link instead, or wait for multi-hop reference chains to ship.`,
      // A current-engine limitation, not an unknown term — drives the UI to
      // group this under "query limitations", not "not in ontology".
      kind: 'limitation',
      // Explicit empty array signals the gap-enricher to leave this
      // alone — schema-limit gaps don't benefit from value-similarity
      // "related concepts", which would just be noise here.
      suggestions: [],
    })
  }
  return out
}
