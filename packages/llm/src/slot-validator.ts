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
import type { SchemaVocabulary } from '@ontology-search/search'

import {
  buildAllowedValuesIndex,
  buildNumericPropertySet,
  findBestMatch,
  getSuggestions,
  MAX_PROPERTY_MATCH_DISTANCE,
  MAX_SUGGESTIONS,
  MIN_SUGGESTION_SIMILARITY,
  suggestionScore,
} from './slot-validator-fuzzy.js'
import type { GapKind, LlmStructuredResponse, MappedTerm, OntologyGap } from './types.js'

export type { InstanceValueLookup, ShaclSlotValidationResult } from './slot-validator-shacl.js'
export { validateRangesAgainstShacl, validateSlotsAgainstShacl } from './slot-validator-shacl.js'

/**
 * Validate and correct LLM-submitted slots against the ontology vocabulary.
 *
 * This is the core self-correction layer:
 * 1. For each filter value, check against sh:in allowed values
 * 2. Exact match → high confidence, keep as-is
 * 3. Fuzzy match → medium confidence, correct to nearest valid value
 * 4. No match → remove from filters, add to gaps with suggestions
 * 5. Rewrite interpretation.mappedTerms with objective confidence
 * 6. Enrich gaps with suggestions from real vocabulary
 */
export function validateSlots(
  response: LlmStructuredResponse,
  vocabulary: SchemaVocabulary
): LlmStructuredResponse {
  const allowedIndex = buildAllowedValuesIndex(vocabulary)
  const numericProps = buildNumericPropertySet(vocabulary)

  // Parse the filters from the SPARQL (we need the original slots structure)
  // We work with interpretation.mappedTerms and gaps — the consumer-facing output
  const validatedTerms: MappedTerm[] = []
  const validatedGaps: OntologyGap[] = []
  const correctedFilters = new Map<string, string | string[]>()

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
      const result = findBestMatch(term.mapped, allowedValues)

      if (result) {
        const objectiveConfidence = result.distance === 0 ? 'high' : 'medium'
        validatedTerms.push({
          ...term,
          mapped: result.match,
          confidence: objectiveConfidence,
        })
        correctedFilters.set(propertyName, result.match)
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
          const valueMatch = findBestMatch(term.mapped, propInfo.allowedValues)
          if (valueMatch) {
            validatedTerms.push({
              ...term,
              property: correctedPropName,
              mapped: valueMatch.match,
              confidence: 'medium',
            })
            correctedFilters.set(correctedPropName, valueMatch.match)
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
 * Returns corrected filters with only valid ontology values.
 */
export function correctFilters(
  filters: Record<string, string | string[]>,
  vocabulary: SchemaVocabulary
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
        const match = findBestMatch(v, propInfo.allowedValues)
        return match ? match.match : v
      })
      corrected[propName] = correctedValues
    } else {
      const match = findBestMatch(value, propInfo.allowedValues)
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
  // Build property → Set<domain> index (multi-domain aware). Skip
  // occurrences whose domain couldn't be attributed (empty-string sentinel
  // from the vocabulary extractor) so an unattributed property never injects
  // a phantom domain into the corrected set.
  const propDomainsIndex = new Map<string, Set<string>>()
  const indexProperty = (localName: string, domain: string): void => {
    if (!domain) return
    const existing = propDomainsIndex.get(localName)
    if (existing) {
      existing.add(domain)
    } else {
      propDomainsIndex.set(localName, new Set([domain]))
    }
  }
  for (const prop of vocabulary.enumProperties) indexProperty(prop.localName, prop.domain)
  for (const prop of vocabulary.numericProperties) indexProperty(prop.localName, prop.domain)

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

  // Search across all enum properties for the best matching values
  const allSuggestions: { value: string; score: number; property: string }[] = []

  for (const [propName, { allowedValues }] of allowedIndex) {
    for (const allowed of allowedValues) {
      const score = suggestionScore(gap.term ?? '', allowed)
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
