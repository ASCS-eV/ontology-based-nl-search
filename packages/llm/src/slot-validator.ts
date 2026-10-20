/**
 * Slot Validator — post-LLM validation and correction of submitted slots.
 *
 * Two layers, applied in order:
 *
 *  1. Fuzzy match against `sh:in` enumerations — corrects case and typos
 *     ("Motorway" → "motorway", "hihgway" → "highway"). This is a UX layer.
 *
 *  2. Generic SHACL Core validation against every constraint declared in the
 *     shapes graph (sh:pattern, sh:datatype, sh:in, sh:minLength, sh:nodeKind,
 *     sh:class, value ranges, …). This is the correctness gate — no value
 *     reaches the SPARQL compiler unless its property's full set of SHACL
 *     constraints is satisfied. Implementation lives in
 *     @ontology-search/ontology/shacl-validator and is graph-driven; no
 *     constraint type is hardcoded here.
 *
 * Confidence is recomputed objectively from the validation outcome:
 *   - exact match + SHACL conforms → high
 *   - fuzzy match + SHACL conforms → medium
 *   - SHACL violation or no fuzzy candidate → removed, reported as gap
 *
 * Suggestions for gaps come from the same vocabulary the LLM saw, using
 * string distance.
 */
import type { GapKind, MappedTerm, OntologyGap } from '@ontology-search/api-types'
import type { SchemaVocabulary } from '@ontology-search/search'
import type { LlmStructuredResponse } from '@ontology-search/search/types'

import type { PrefixMap } from './prefix-map.js'
import {
  buildAllowedValuesIndex,
  buildNumericPropertySet,
  findBestMatch,
  getSuggestions,
  MAX_PROPERTY_MATCH_DISTANCE,
  MAX_SUGGESTIONS,
  MIN_SUGGESTION_SIMILARITY,
  POOL_NORM_B,
  suggestionScore,
} from './slot-validator-fuzzy.js'

export type { InstanceValueLookup, ShaclSlotValidationResult } from './slot-validator-shacl.js'
export { validateRangesAgainstShacl, validateSlotsAgainstShacl } from './slot-validator-shacl.js'

/**
 * Grade the interpretation's mapped terms against the ontology vocabulary.
 *
 * The slots themselves are already corrected and SHACL-gated; this pass
 * rewrites the consumer-facing interpretation:
 * 1. A term whose `mapped` value is in the property's `sh:in` → high confidence
 * 2. A fuzzy match → medium confidence, corrected to the nearest valid value
 * 3. Otherwise the compiled slots decide: `mapped` is the model's free-text
 *    explanation and may describe the value instead of stating it
 *    ("scenarioCategory = 'cut-in'"). When the slots hold allowed values for
 *    the property, the term is anchored to them at high confidence.
 * 4. Neither → low confidence, reported as a gap with suggestions
 * 5. The model's own gaps are enriched with vocabulary suggestions
 */
export function validateSlots(
  response: LlmStructuredResponse,
  vocabulary: SchemaVocabulary,
  prefixes?: PrefixMap
): LlmStructuredResponse {
  const allowedIndex = buildAllowedValuesIndex(vocabulary)
  const numericProps = buildNumericPropertySet(vocabulary)

  const validatedTerms: MappedTerm[] = []
  const validatedGaps: OntologyGap[] = []

  // Track which mapped terms we've validated
  for (const term of response.interpretation.mappedTerms) {
    const propertyName = term.property

    // Numeric range terms — keep as-is (validated structurally, not by vocabulary)
    if (propertyName && numericProps.has(propertyName)) {
      validatedTerms.push({
        ...term,
        confidence: 'high', // numeric values are structurally validated
      })
      continue
    }

    // Domain selection — not vocabulary-validated
    if (propertyName === 'domains' || propertyName === 'domain') {
      validatedTerms.push(term)
      continue
    }

    // Enum property — validate against sh:in
    if (propertyName && allowedIndex.has(propertyName)) {
      const { allowedValues } = allowedIndex.get(propertyName)!
      const result = findBestMatch(term.mapped, allowedValues, prefixes)

      if (result) {
        const objectiveConfidence = result.distance === 0 ? 'high' : 'medium'
        validatedTerms.push({
          ...term,
          mapped: result.match,
          confidence: objectiveConfidence,
        })
        continue
      }

      const slotValues = slotValuesFor(response.slots, propertyName).filter((value) =>
        allowedValues.includes(value)
      )
      if (slotValues.length > 0) {
        // The compiled slots are authoritative. Prefer the values the
        // explanation names; otherwise show every value the query used.
        const cited = slotValues.filter((value) =>
          term.mapped.toLowerCase().includes(value.toLowerCase())
        )
        validatedTerms.push({
          ...term,
          mapped: [...new Set(cited.length > 0 ? cited : slotValues)].join(', '),
          confidence: 'high',
        })
      } else {
        // No match — keep as low-confidence mapped term so it stays in refine UI
        const suggestions = getSuggestions(term.mapped, allowedValues)
        validatedTerms.push({
          ...term,
          confidence: 'low' as MappedTerm['confidence'],
        })
        validatedGaps.push({
          term: term.input,
          reason: `"${term.mapped}" is not a valid value for ${propertyName}`,
          kind: 'unmapped',
          suggestions: suggestions.length > 0 ? suggestions : undefined,
        })
      }
    } else if (propertyName) {
      // Property name itself is unknown — check if it's close to any known property
      const knownProps = [...allowedIndex.keys(), ...numericProps]
      const propMatch = findBestMatch(propertyName, knownProps)

      if (propMatch && propMatch.distance <= MAX_PROPERTY_MATCH_DISTANCE) {
        // Property name was close enough — try matching the value
        const correctedPropName = propMatch.match
        const propInfo = allowedIndex.get(correctedPropName)

        if (propInfo) {
          const valueMatch = findBestMatch(term.mapped, propInfo.allowedValues, prefixes)
          if (valueMatch) {
            validatedTerms.push({
              ...term,
              property: correctedPropName,
              mapped: valueMatch.match,
              confidence: 'medium',
            })
            continue
          }
        }
      }

      // Unknown property, no recovery
      validatedTerms.push({
        ...term,
        confidence: 'low' as MappedTerm['confidence'],
      })
    } else {
      // No property assigned — keep LLM's assessment
      validatedTerms.push(term)
    }
  }

  // Inputs the LLM successfully mapped to an ontology property. Used to tell a
  // "recognized concept" gap (an interpretation note about something we DID
  // understand) apart from a genuinely unmapped term.
  const mappedInputs = new Set(validatedTerms.filter((t) => t.property).map((t) => t.input))

  // Enrich existing gaps with vocabulary suggestions and classify their kind.
  for (const gap of response.gaps) {
    const enrichedGap = enrichGapWithSuggestions(gap, allowedIndex)
    validatedGaps.push({ ...enrichedGap, kind: classifyGapKind(enrichedGap, mappedInputs) })
  }

  return {
    interpretation: {
      summary: response.interpretation.summary,
      mappedTerms: validatedTerms,
      domains: response.interpretation.domains,
      appliedFilters: response.interpretation.appliedFilters,
    },
    gaps: validatedGaps,
    sparql: response.sparql,
    // Preserve the compiler's traceability plans — this final validation pass
    // must not strip them, or per-row reference breadcrumbs never reach the UI.
    trace: response.trace,
    // Preserve validated slots for downstream serialization (e.g. GraphQL layer).
    slots: response.slots,
  }
}

/**
 * Correct filter values in SearchSlots based on validation results.
 * Returns corrected filters with only valid ontology values. `prefixes`
 * resolves prefixed names an LLM echoed from the shapes' Turtle.
 */
export function correctFilters(
  filters: Record<string, string | string[]>,
  vocabulary: SchemaVocabulary,
  prefixes?: PrefixMap
): Record<string, string | string[]> {
  const allowedIndex = buildAllowedValuesIndex(vocabulary)
  const corrected: Record<string, string | string[]> = {}

  for (const [propName, value] of Object.entries(filters)) {
    const propInfo = allowedIndex.get(propName)

    if (!propInfo) {
      // Unknown property — pass through (might be a valid non-enum property)
      corrected[propName] = value
      continue
    }

    if (Array.isArray(value)) {
      // Per element: prefer the fuzzy-matched canonical value; fall
      // back to the raw element so the downstream SHACL gate can emit
      // a structured gap. Without this pass-through, values too far
      // from any sh:in entry are silently dropped and the caller sees
      // an empty filter with no explanation.
      const correctedValues: string[] = value.map((v) => {
        const match = findBestMatch(v, propInfo.allowedValues, prefixes)
        return match ? match.match : v
      })
      corrected[propName] = correctedValues
    } else {
      const match = findBestMatch(value, propInfo.allowedValues, prefixes)
      // Same pass-through rationale as the array branch.
      corrected[propName] = match ? match.match : value
    }
  }

  return corrected
}

/**
 * Correct domain selection based on which properties are actually used.
 *
 * If the LLM selected one domain but the filters describe properties that
 * only exist in a different domain, the corrected list should include the
 * actual property domain — this prevents empty result sets caused by a
 * domain/property mismatch.
 *
 * CRITICAL: a property may exist in multiple domains. When the LLM's
 * domain choice already covers the property, we respect that choice
 * rather than rewriting it.
 */
export function correctDomains(
  domains: string[],
  filters: Record<string, string | string[]>,
  ranges: Record<string, { min?: number; max?: number }>,
  vocabulary: SchemaVocabulary
): string[] {
  // Property → Set<domain> over EVERY resolvable property, not just the
  // enumerated and numeric ones.
  //
  // Building this from `enumProperties`/`numericProperties` alone made the
  // membership test below answer "no" for a leaf that is merely typed
  // (`sh:datatype` with no `sh:in`). Two domains can declare the same leaf
  // name under different IRIs with one enumerating it and the other not; the
  // non-enumerating domain then looked as though it lacked the property, and
  // the caller's correct domain choice was widened with the other domain —
  // silently broadening a precise query. `propertyDomains` is derived from the
  // compiler's own path index, so this asks exactly the right question: can
  // the compiler resolve this property in that domain?
  const propDomainsIndex = new Map<string, Set<string>>()
  for (const [localName, domains] of vocabulary.propertyDomains) {
    // Skip occurrences whose domain couldn't be attributed so an
    // unattributable property never injects a phantom domain.
    const attributed = domains.filter((domain) => domain.length > 0)
    if (attributed.length > 0) propDomainsIndex.set(localName, new Set(attributed))
  }

  // Collect domains required by filter/range properties
  // If a property exists in the LLM's chosen domain, use that
  // Otherwise, use the property's actual domain(s)
  const requiredDomains = new Set<string>()
  const currentSet = new Set(domains)

  for (const propName of Object.keys(filters)) {
    const propDomains = propDomainsIndex.get(propName)
    if (!propDomains) continue

    // If property exists in any of the LLM's chosen domains, don't override
    const matchesChosen = [...propDomains].some((d) => currentSet.has(d))
    if (matchesChosen) {
      // LLM chose correctly, keep their choice
      continue
    }

    // Property doesn't exist in chosen domains, add its actual domains
    for (const d of propDomains) {
      requiredDomains.add(d)
    }
  }

  for (const propName of Object.keys(ranges)) {
    const propDomains = propDomainsIndex.get(propName)
    if (!propDomains) continue

    const matchesChosen = [...propDomains].some((d) => currentSet.has(d))
    if (matchesChosen) {
      continue
    }

    for (const d of propDomains) {
      requiredDomains.add(d)
    }
  }

  if (requiredDomains.size === 0) return domains

  // If LLM's domains already cover all properties, keep as-is
  if ([...requiredDomains].every((d) => currentSet.has(d))) {
    return domains
  }

  // Merge required domains with existing
  return [...new Set([...domains, ...requiredDomains])]
}

/** The filter part of a slot scope: the top-level slots or one reference. */
interface FilterScope {
  filters?: Record<string, string | string[]>
  references?: readonly FilterScope[]
}

/**
 * Every value the slots hold for `property`: the top-level filters and the
 * reference-scoped filters at any depth, the values the compiler used.
 */
function slotValuesFor(scope: FilterScope | undefined, property: string): string[] {
  if (!scope) return []
  const own = scope.filters?.[property]
  return [
    ...(own === undefined ? [] : Array.isArray(own) ? own : [own]),
    ...(scope.references ?? []).flatMap((reference) => slotValuesFor(reference, property)),
  ]
}

/**
 * Assign a {@link GapKind} to a gap that doesn't already carry one. Gaps our
 * own code creates set `kind` explicitly (SHACL value/property rejections →
 * `unmapped`; dropped cross-references → `limitation`); this classifies the
 * LLM's own raw gaps. A gap whose term was ALSO successfully mapped to an
 * ontology property is a recognized concept — an interpretation note about
 * something we understood — not an unknown term.
 */
function classifyGapKind(gap: OntologyGap, mappedInputs: ReadonlySet<string>): GapKind {
  if (gap.kind) return gap.kind
  if (mappedInputs.has(gap.term)) return 'recognized'
  return 'unmapped'
}

/** Enrich a gap with suggestions from the most relevant vocabulary properties */
function enrichGapWithSuggestions(
  gap: OntologyGap,
  allowedIndex: Map<string, { allowedValues: string[]; domain: string }>
): OntologyGap {
  // If gap already has good suggestions, keep them. An explicit
  // empty array is the "do not enrich" sentinel — used by gaps
  // that describe a schema limitation rather than a value mismatch
  // (e.g. dropped-reference gaps from `collectDroppedReferenceGaps`).
  // Adding "related concepts" to a "we don't support this shape yet"
  // explanation only misleads the reader.
  if (Array.isArray(gap.suggestions)) return gap

  // Search across all enum properties for the best matching values, weighted
  // by how much evidence a hit in that property actually carries.
  const allSuggestions: { value: string; score: number; property: string }[] = []
  const evidence = poolEvidenceWeights(allowedIndex)
  const term = (gap.term ?? '').trim().toLowerCase()

  for (const [propName, { allowedValues }] of allowedIndex) {
    const weight = evidence.get(propName) ?? 1
    for (const allowed of allowedValues) {
      // Damping dilutes *resemblance*, not *identity*. Weighting every
      // candidate by pool size makes a large enough vocabulary entirely
      // unsuggestable — the similarity score is capped at 1, so once the
      // weight falls below the floor no value can pass, including one the
      // user typed verbatim. A term identical to a vocabulary value is
      // unambiguous evidence however many siblings that value has, and
      // scores 1 by definition rather than by fuzzy measurement.
      const exact = allowed.toLowerCase() === term
      const score = exact ? 1 : suggestionScore(gap.term ?? '', allowed) * weight
      if (score >= MIN_SUGGESTION_SIMILARITY) {
        allSuggestions.push({ value: allowed, score, property: propName })
      }
    }
  }

  // Sort by score, take top N, include property context
  const topSuggestions = allSuggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => `${s.value} (${s.property})`)

  return {
    ...gap,
    suggestions: topSuggestions.length > 0 ? topSuggestions : gap.suggestions,
  }
}

/**
 * Per-property evidence weight for suggestion scoring, in (0, 1].
 *
 * A fuzzy hit inside a closed vocabulary of a few values is real evidence.
 * A fuzzy hit inside an identifier code list of thousands of entries is
 * almost none: with that many entries *something* always resembles *some*
 * word of a free-text gap, and those near-matches drown the genuine
 * concept suggestions.
 *
 * The weight is pivoted length normalization against the mean pool size of
 * this vocabulary — the same normalization the schema-index ranker applies,
 * and deliberately corpus-relative rather than an absolute size cutoff. A
 * cutoff encodes "ontologies look like ours"; on a vocabulary set where
 * every enum is large it would suppress every suggestion, whereas a
 * corpus-relative weight correctly treats size as carrying no signal there.
 * Capped at 1 so a small pool is never boosted above its raw similarity.
 *
 * Applies to fuzzy hits only — see {@link enrichGapWithSuggestions} for why
 * an exact value match is exempt.
 */
function poolEvidenceWeights(
  allowedIndex: Map<string, { allowedValues: string[]; domain: string }>
): Map<string, number> {
  const sizes = [...allowedIndex].map(
    ([name, { allowedValues }]) => [name, allowedValues.length] as const
  )
  const populated = sizes.filter(([, size]) => size > 0)
  const weights = new Map<string, number>()
  if (populated.length === 0) return weights
  const mean = populated.reduce((sum, [, size]) => sum + size, 0) / populated.length
  for (const [name, size] of populated) {
    const ratio = size / mean
    weights.set(name, Math.min(1, 1 / (1 - POOL_NORM_B + POOL_NORM_B * ratio)))
  }
  return weights
}
