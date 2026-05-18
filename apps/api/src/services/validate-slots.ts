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
import { extractVocabulary, getInitializedStore } from '@ontology-search/search'

/**
 * Validate search slots against SHACL constraints.
 * Returns cleaned slots with invalid values removed.
 */
export async function validateSlots(slots: SearchSlots): Promise<SearchSlots> {
  const shacl = await ShaclValidator.fromWorkspace()
  const store = await getInitializedStore()
  const vocabulary = await extractVocabulary(store)

  const result = await validateSlotsAgainstShacl(
    slots.filters ?? {},
    slots.location,
    slots.license,
    shacl,
    vocabulary
  )

  // Drop ranges with property names not in the schema
  const rangeResult = validateRangesAgainstShacl(slots.ranges ?? {}, shacl)

  return {
    ...slots,
    filters: result.filters,
    ranges: rangeResult.ranges,
    location: result.location,
    license: result.license,
  }
}
