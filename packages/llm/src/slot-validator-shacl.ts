/**
 * SHACL slot validation (ADR 0003) — drops slot filter/range values that
 * violate a declared SHACL constraint (and unknown property keys), surfacing
 * each as a gap with nearest-vocabulary suggestions. Depends on the fuzzy leaf.
 */
import type { OntologyVocabulary, ShaclValidator } from '@ontology-search/search'

import { buildAllowedValuesIndex, getSuggestions } from './slot-validator-fuzzy.js'
import type { OntologyGap } from './types.js'

/**
 * Result of SHACL-validating an entire slot set.
 *
 * Returns the cleansed `filters` map plus any gaps for values that failed
 * SHACL constraints. The caller composes these into a SearchSlots object.
 *
 * All constraints flow through one generic surface: `filters` keyed by SHACL
 * leaf local names.
 */
export interface ShaclSlotValidationResult {
  filters: Record<string, string | string[]>
  gaps: OntologyGap[]
}

/**
 * Validate every value in `filters` against the full SHACL Core
 * constraint set declared in the shapes graph.
 *
 * Generic by construction:
 *   - looks up slot keys → property IRI(s) via the SHACL validator's index,
 *   - runs the validator against a candidate dataset per (property, value),
 *   - on violation, removes the value from the slot fragment and emits a gap
 *     describing the failed constraint component.
 *
 * Fuzzy matching against `sh:in` happens before this step (see correctFilters)
 * so case/typo errors don't generate false negatives. After fuzzy correction,
 * SHACL is the final gate — nothing reaches the SPARQL compiler unless every
 * declared constraint on the property is satisfied.
 *
 * Every constraint lives in `filters` keyed by the SHACL leaf local name,
 * and the same validation loop handles geography, license, and any
 * other leaf the schema declares.
 */
export async function validateSlotsAgainstShacl(
  filters: Record<string, string | string[]>,
  shaclValidator: ShaclValidator,
  vocabulary?: OntologyVocabulary
): Promise<ShaclSlotValidationResult> {
  const cleanFilters: Record<string, string | string[]> = {}
  const gaps: OntologyGap[] = []

  // Build a fast lookup of known-good enum values per slot. Values that
  // already matched an sh:in enumeration during the correctFilters phase
  // are guaranteed to pass SHACL validation — skipping the expensive engine
  // call (~3s per invocation) for these is the single biggest speed win.
  const enumIndex = vocabulary ? buildAllowedValuesIndex(vocabulary) : undefined

  // Filters — every key/value pair gets a SHACL check unless it can be
  // short-circuited via the enum index. Arrays use the batch validator.
  //
  // BEFORE checking values, we verify the slot KEY itself exists in the
  // ontology. The LLM occasionally invents property names (e.g. `numberLanes`
  // when only `numberObjects` exists). Such keys would otherwise pass through
  // the compiler silently and produce 0 results with no diagnostic. Dropping
  // them here with a gap surfaces the mismatch to the caller.
  for (const [slotKey, value] of Object.entries(filters)) {
    if (!shaclValidator.isKnownSlotKey(slotKey)) {
      const sample = Array.isArray(value) ? value.join(', ') : value
      gaps.push({
        term: slotKey,
        reason: `"${slotKey}" is not a known property in the ontology — value(s) "${sample}" cannot be filtered.`,
        kind: 'unmapped',
      })
      continue
    }

    // Fast path: if every value is a known enum member, skip the SHACL engine
    // entirely. The sh:in constraint is the only one that applies to enum
    // properties, and correctFilters already matched these values.
    const enumInfo = enumIndex?.get(slotKey)
    if (enumInfo) {
      const enumSet = new Set(enumInfo.allowedValues)
      if (Array.isArray(value)) {
        const kept = value.filter((v): v is string => typeof v === 'string' && enumSet.has(v))
        if (kept.length > 0) cleanFilters[slotKey] = kept
        // Values not in enum still need SHACL validation
        const needsCheck = value.filter(
          (v): v is string => typeof v === 'string' && !enumSet.has(v)
        )
        if (needsCheck.length > 0) {
          const validated = await checkArrayAndAccumulate(
            slotKey,
            needsCheck,
            shaclValidator,
            gaps,
            vocabulary
          )
          if (validated.length > 0) {
            const prev = cleanFilters[slotKey]
            cleanFilters[slotKey] = Array.isArray(prev) ? [...prev, ...validated] : validated
          }
        }
      } else if (enumSet.has(value)) {
        cleanFilters[slotKey] = value
      } else {
        const ok = await checkAndAccumulate(slotKey, value, shaclValidator, gaps, vocabulary)
        if (ok) cleanFilters[slotKey] = value
      }
      continue
    }

    if (Array.isArray(value)) {
      const kept = await checkArrayAndAccumulate(slotKey, value, shaclValidator, gaps, vocabulary)
      if (kept.length > 0) cleanFilters[slotKey] = kept
    } else {
      const ok = await checkAndAccumulate(slotKey, value, shaclValidator, gaps, vocabulary)
      if (ok) cleanFilters[slotKey] = value
    }
  }

  return { filters: cleanFilters, gaps }
}

/**
 * Drop range entries whose slot key is unknown to the ontology, and emit a
 * gap for each. SHACL doesn't help here directly — ranges always carry
 * numeric values that pass `sh:datatype xsd:integer/float`, so the only
 * way to catch hallucinated property names (e.g. `numberLanes`) is the
 * same `isKnownSlotKey` check we apply to filters.
 *
 * Returns the cleansed ranges record and the per-key gaps.
 */
export function validateRangesAgainstShacl(
  ranges: Record<string, { min?: number; max?: number }>,
  shaclValidator: ShaclValidator
): {
  ranges: Record<string, { min?: number; max?: number }>
  gaps: OntologyGap[]
} {
  const clean: Record<string, { min?: number; max?: number }> = {}
  const gaps: OntologyGap[] = []
  for (const [slotKey, range] of Object.entries(ranges)) {
    if (!shaclValidator.isKnownSlotKey(slotKey)) {
      const bound =
        range.min !== undefined && range.max !== undefined
          ? `${range.min}..${range.max}`
          : (range.min ?? range.max ?? '?')
      gaps.push({
        term: slotKey,
        reason: `"${slotKey}" is not a known property in the ontology — range ${bound} cannot be filtered.`,
        kind: 'unmapped',
      })
      continue
    }
    clean[slotKey] = range
  }
  return { ranges: clean, gaps }
}

/**
 * Validate a single (slot, value) and accumulate a gap on failure.
 *
 * When `vocabulary` is supplied, gaps are enriched with Phase 4 data-driven
 * suggestions: the top-N distinct literal values actually observed for the
 * property in the instance data, ranked by edit distance from the rejected
 * value. Generic — no property is special-cased.
 */
async function checkAndAccumulate(
  slotKey: string,
  value: string,
  shaclValidator: ShaclValidator,
  gaps: OntologyGap[],
  vocabulary?: OntologyVocabulary
): Promise<boolean> {
  const result = await shaclValidator.validateBySlotName(slotKey, value)

  // No SHACL shape for this slot → can't refute, accept.
  if (result.resolvedIris.length === 0) return true

  if (result.conforms) return true

  const reasons = result.violations
    .map((v) => {
      const constraint = v.sourceConstraintComponent.split(/[#/]/).pop() ?? 'constraint'
      return `${constraint}${v.message ? `: ${v.message}` : ''}`
    })
    .join('; ')

  const suggestions = vocabulary
    ? dataDrivenSuggestions(value, result.resolvedIris, vocabulary)
    : undefined

  gaps.push({
    term: value,
    reason: `"${value}" failed SHACL validation for ${slotKey} (${reasons})`,
    kind: 'unmapped',
    suggestions: suggestions && suggestions.length > 0 ? suggestions : undefined,
  })
  return false
}

/**
 * Batch counterpart of `checkAndAccumulate`. Validates every non-empty string
 * in `values` against the slot's SHACL constraints in a single engine call
 * per resolved property IRI, returning the surviving values and pushing a
 * gap for every rejected element.
 */
async function checkArrayAndAccumulate(
  slotKey: string,
  values: ReadonlyArray<unknown>,
  shaclValidator: ShaclValidator,
  gaps: OntologyGap[],
  vocabulary?: OntologyVocabulary
): Promise<string[]> {
  // Preserve input order; SHACL outcomes are looked up by stringified value.
  const candidates = values.filter((v): v is string => typeof v === 'string' && v.length > 0)
  if (candidates.length === 0) return []

  const batch = await shaclValidator.validateBySlotNameBatch(slotKey, candidates)
  const kept: string[] = []
  for (const value of candidates) {
    const result = batch.get(value)
    if (!result) continue

    // No SHACL shape for this slot → can't refute, accept.
    if (result.resolvedIris.length === 0) {
      kept.push(value)
      continue
    }

    if (result.conforms) {
      kept.push(value)
      continue
    }

    const reasons = result.violations
      .map((v) => {
        const constraint = v.sourceConstraintComponent.split(/[#/]/).pop() ?? 'constraint'
        return `${constraint}${v.message ? `: ${v.message}` : ''}`
      })
      .join('; ')

    const suggestions = vocabulary
      ? dataDrivenSuggestions(value, result.resolvedIris, vocabulary)
      : undefined

    gaps.push({
      term: value,
      reason: `"${value}" failed SHACL validation for ${slotKey} (${reasons})`,
      kind: 'unmapped',
      suggestions: suggestions && suggestions.length > 0 ? suggestions : undefined,
    })
  }
  return kept
}

/**
 * Build suggestions for a rejected value from the property's observed
 * instance values plus its sh:in enumeration (if any).
 *
 * The pool is a union of:
 *   - `OntologyVocabulary.instanceValues[propIri]` — values that actually
 *     appear in the data graph for this property,
 *   - `OntologyVocabulary.enumProperties[].allowedValues` — the SHACL
 *     enumeration, for properties that have one.
 *
 * Ranked by edit-distance similarity to the rejected value.
 * Generic — every property uses the same path.
 */
function dataDrivenSuggestions(
  rejectedValue: string,
  propertyIris: string[],
  vocabulary: OntologyVocabulary
): string[] {
  const pool = new Set<string>()
  for (const iri of propertyIris) {
    for (const v of vocabulary.instanceValues.get(iri) ?? []) pool.add(v)
    const enumProp = vocabulary.enumProperties.find((p) => p.iri === iri)
    for (const v of enumProp?.allowedValues ?? []) pool.add(v)
  }
  if (pool.size === 0) return []

  return getSuggestions(rejectedValue, [...pool])
}
