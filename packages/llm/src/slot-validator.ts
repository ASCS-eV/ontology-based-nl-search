/**
 * Slot Validator — post-LLM validation and correction of submitted slots.
 *
 * Validates filter values against the actual ontology vocabulary (sh:in).
 * Fuzzy-matches invalid values to the nearest valid entry.
 * Recomputes confidence objectively:
 *   - exact match → high
 *   - fuzzy match (edit distance ≤ threshold) → medium
 *   - no match → removed from slots, reported as gap
 *
 * Generates suggestions for gaps from real vocabulary using string distance.
 */
import type { OntologyVocabulary } from '@ontology-search/search'

import type { LlmStructuredResponse, MappedTerm, OntologyGap } from './types.js'

/** Maximum edit distance for a fuzzy match to be accepted */
const FUZZY_THRESHOLD = 4

/** Maximum suggestions to generate per gap */
const MAX_SUGGESTIONS = 5

/** Minimum similarity score (0-1) to include a suggestion */
const MIN_SUGGESTION_SIMILARITY = 0.3

/**
 * Levenshtein edit distance between two strings.
 * Uses Wagner–Fischer dynamic programming (O(n×m) time, O(min(n,m)) space).
 */
function editDistance(a: string, b: string): number {
  const la = a.length
  const lb = b.length

  // Short-circuit for empty strings or identical strings
  if (la === 0) return lb
  if (lb === 0) return la
  if (a === b) return 0

  // Ensure b is shorter for O(min(n,m)) space
  if (la < lb) return editDistance(b, a)

  let prev = Array.from({ length: lb + 1 }, (_, j) => j)
  let curr = new Array<number>(lb + 1).fill(0)

  for (let i = 1; i <= la; i++) {
    curr[0] = i
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j]! + 1, // deletion
        curr[j - 1]! + 1, // insertion
        prev[j - 1]! + cost // substitution
      )
    }
    ;[prev, curr] = [curr, prev]
  }

  return prev[lb]!
}

/** Normalized similarity score (0-1) based on edit distance */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - editDistance(a, b) / maxLen
}

/**
 * Find the best fuzzy match for a value in a list of allowed values.
 * Returns null if no match within threshold.
 */
function findBestMatch(
  value: string,
  allowedValues: string[]
): { match: string; distance: number; similarity: number } | null {
  if (!value) return null
  const normalizedValue = value.toLowerCase().trim()

  let bestMatch: string | null = null
  let bestDistance = Infinity

  for (const allowed of allowedValues) {
    const normalizedAllowed = allowed.toLowerCase().trim()

    // Exact match (case-insensitive)
    if (normalizedValue === normalizedAllowed) {
      return { match: allowed, distance: 0, similarity: 1 }
    }

    // Substring containment — "motorway" matches if input is "motorways" or vice versa
    if (
      normalizedValue.includes(normalizedAllowed) ||
      normalizedAllowed.includes(normalizedValue)
    ) {
      const dist = Math.abs(normalizedValue.length - normalizedAllowed.length)
      if (dist < bestDistance) {
        bestDistance = dist
        bestMatch = allowed
      }
      continue
    }

    const dist = editDistance(normalizedValue, normalizedAllowed)
    if (dist < bestDistance) {
      bestDistance = dist
      bestMatch = allowed
    }
  }

  if (bestMatch === null || bestDistance > FUZZY_THRESHOLD) return null

  return {
    match: bestMatch,
    distance: bestDistance,
    similarity: similarity(normalizedValue, bestMatch.toLowerCase()),
  }
}

/**
 * Get top-N suggestions from a property's allowed values, ranked by similarity.
 */
function getSuggestions(
  value: string,
  allowedValues: string[],
  max: number = MAX_SUGGESTIONS
): string[] {
  if (!value) return []
  const normalizedValue = value.toLowerCase().trim()

  return allowedValues
    .map((v) => ({ value: v, score: similarity(normalizedValue, v.toLowerCase()) }))
    .filter((s) => s.score >= MIN_SUGGESTION_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.value)
}

/**
 * Build a lookup of property name → allowed values from vocabulary.
 * Merges allowed values from all domains when the same localName appears
 * in multiple domains (e.g., hdmap:formatType and tzip21:formatType).
 */
function buildAllowedValuesIndex(
  vocabulary: OntologyVocabulary
): Map<string, { allowedValues: string[]; domain: string }> {
  const index = new Map<string, { allowedValues: string[]; domain: string }>()
  for (const prop of vocabulary.enumProperties) {
    const existing = index.get(prop.localName)
    if (existing) {
      // Merge allowed values from multiple domains (deduplicated)
      const merged = new Set([...existing.allowedValues, ...prop.allowedValues])
      existing.allowedValues = [...merged]
    } else {
      index.set(prop.localName, {
        allowedValues: [...prop.allowedValues],
        domain: prop.domain,
      })
    }
  }
  return index
}

/** Build a set of known numeric property names */
function buildNumericPropertySet(vocabulary: OntologyVocabulary): Set<string> {
  return new Set(vocabulary.numericProperties.map((p) => p.localName))
}

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
  vocabulary: OntologyVocabulary
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

    // Location fields (country, state, city, region) and license are not enum-validated
    if (isLocationOrLicenseProperty(propertyName)) {
      validatedTerms.push(term)
      continue
    }

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
          suggestions: suggestions.length > 0 ? suggestions : undefined,
        })
      }
    } else if (propertyName) {
      // Property name itself is unknown — check if it's close to any known property
      const knownProps = [...allowedIndex.keys(), ...numericProps]
      const propMatch = findBestMatch(propertyName, knownProps)

      if (propMatch && propMatch.distance <= 2) {
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

  // Enrich existing gaps with vocabulary suggestions
  for (const gap of response.gaps) {
    // Try to find suggestions across all enum properties
    const enrichedGap = enrichGapWithSuggestions(gap, allowedIndex)
    validatedGaps.push(enrichedGap)
  }

  return {
    interpretation: {
      summary: response.interpretation.summary,
      mappedTerms: validatedTerms,
    },
    gaps: validatedGaps,
    sparql: response.sparql,
  }
}

/**
 * Correct filter values in SearchSlots based on validation results.
 * Returns corrected filters with only valid ontology values.
 */
export function correctFilters(
  filters: Record<string, string | string[]>,
  vocabulary: OntologyVocabulary
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
      const correctedValues: string[] = []
      for (const v of value) {
        const match = findBestMatch(v, propInfo.allowedValues)
        if (match) correctedValues.push(match.match)
      }
      if (correctedValues.length > 0) corrected[propName] = correctedValues
    } else {
      const match = findBestMatch(value, propInfo.allowedValues)
      if (match) corrected[propName] = match.match
    }
  }

  return corrected
}

/**
 * Correct domain selection based on which properties are actually used.
 *
 * If the LLM selected domain "scenario" but all filters belong to "hdmap",
 * the domain list should include "hdmap". This prevents empty results from
 * querying the wrong asset type.
 *
 * CRITICAL: Properties can exist in multiple domains (e.g., roadTypes in both hdmap and ositrace).
 * We must respect the LLM's domain choice when a property exists in that domain.
 */
export function correctDomains(
  domains: string[],
  filters: Record<string, string | string[]>,
  ranges: Record<string, { min?: number; max?: number }>,
  vocabulary: OntologyVocabulary
): string[] {
  // Build property → Set<domain> index (multi-domain aware)
  const propDomainsIndex = new Map<string, Set<string>>()
  for (const prop of vocabulary.enumProperties) {
    const existing = propDomainsIndex.get(prop.localName)
    if (existing) {
      existing.add(prop.domain)
    } else {
      propDomainsIndex.set(prop.localName, new Set([prop.domain]))
    }
  }
  for (const prop of vocabulary.numericProperties) {
    const existing = propDomainsIndex.get(prop.localName)
    if (existing) {
      existing.add(prop.domain)
    } else {
      propDomainsIndex.set(prop.localName, new Set([prop.domain]))
    }
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

/** Enrich a gap with suggestions from the most relevant vocabulary properties */
function enrichGapWithSuggestions(
  gap: OntologyGap,
  allowedIndex: Map<string, { allowedValues: string[]; domain: string }>
): OntologyGap {
  // If gap already has good suggestions, keep them
  if (gap.suggestions && gap.suggestions.length > 0) return gap

  // Search across all enum properties for the best matching values
  const allSuggestions: { value: string; score: number; property: string }[] = []

  for (const [propName, { allowedValues }] of allowedIndex) {
    for (const allowed of allowedValues) {
      const score = similarity((gap.term ?? '').toLowerCase(), allowed.toLowerCase())
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

/** Check if a property is a location or license field (not vocabulary-validated) */
function isLocationOrLicenseProperty(propertyName: string | undefined): boolean {
  if (!propertyName) return false
  return ['country', 'state', 'region', 'city', 'license'].includes(propertyName)
}
