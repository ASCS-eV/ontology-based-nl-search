/**
 * Slot validation service — SHACL-based defense-in-depth for /refine.
 *
 * Runs the same SHACL validator the LLM agent uses, then re-emits slots
 * with any violating values dropped. The compiler only sees ontology-valid
 * filters and ranges.
 *
 * Extracted from search-factory for readability — the validation logic
 * is wiring-level (not a reusable service), but substantial enough to
 * warrant its own module.
 */
import { validateRangesAgainstShacl, validateSlotsAgainstShacl } from '@ontology-search/llm'
import { ShaclValidator } from '@ontology-search/ontology/shacl-validator'
import type { SearchSlots } from '@ontology-search/search'
import {
  extractSchemaVocabulary,
  getInitializedStore,
  getInstanceValues,
} from '@ontology-search/search'

/**
 * Validate search slots against SHACL constraints.
 * Returns cleaned slots with invalid values removed.
 */
export async function validateSlots(slots: SearchSlots): Promise<SearchSlots> {
  const shacl = await ShaclValidator.fromWorkspace()
  const store = await getInitializedStore()
  // Schema-only vocabulary; observed instance values for gap suggestions are
  // fetched lazily — only when a violation needs them.
  const vocabulary = await extractSchemaVocabulary(store)

  const result = await validateSlotsAgainstShacl(slots.filters ?? {}, shacl, vocabulary, (iris) =>
    getInstanceValues(store, iris)
  )

  // Drop ranges with property names not in the schema
  const rangeResult = validateRangesAgainstShacl(slots.ranges ?? {}, shacl)

  return {
    ...slots,
    filters: result.filters,
    ranges: rangeResult.ranges,
  }
}
