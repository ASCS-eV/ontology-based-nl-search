/**
 * String similarity algorithms for fuzzy concept matching.
 *
 * Exports Jaro-Winkler distance — preferred over Levenshtein for
 * short strings because it gives higher scores to strings matching
 * from the beginning, which aligns with how users typically
 * abbreviate or misspell concept names.
 *
 * Reference: Winkler, W. E. (1990). "String Comparator Metrics and
 * Enhanced Decision Rules in the Fellegi-Sunter Model of Record Linkage."
 */

/**
 * Jaro-Winkler string similarity distance.
 * Returns a value between 0 (no similarity) and 1 (exact match).
 */
export function jaroWinklerDistance(s1: string, s2: string): number {
  if (s1 === s2) return 1.0
  if (s1.length === 0 || s2.length === 0) return 0.0

  const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1)

  const s1Matches = new Array<boolean>(s1.length).fill(false)
  const s2Matches = new Array<boolean>(s2.length).fill(false)

  let matches = 0
  let transpositions = 0

  // Find matching characters
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, s2.length)

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0.0

  // Count transpositions
  let k = 0
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3

  // Winkler modification: boost for common prefix (up to 4 chars)
  let prefix = 0
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }

  return jaro + prefix * 0.1 * (1 - jaro)
}
