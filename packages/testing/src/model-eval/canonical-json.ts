/**
 * Order-independent JSON canonicalization.
 *
 * Scoring compares expected and actual slots by string equality, and digests
 * identify a run by content. Both break if key order leaks into the output:
 * `{min,max}` and `{max,min}` describe the same range but serialize
 * differently. Sorting keys recursively removes that whole failure class, so
 * canonicalization upstream only has to normalize *semantics* (sorting value
 * arrays, dropping absent bounds) rather than also policing key order.
 */

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortValue(item)])
    )
  }
  return value
}

/** Serialize with every object key sorted, at every depth. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}
