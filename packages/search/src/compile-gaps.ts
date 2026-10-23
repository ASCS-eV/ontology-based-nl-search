/**
 * The gaps a compile reports about itself: references it could not join,
 * explicit ones and the domains a parent → child JOIN could not reach. One
 * wording for the natural-language search and the refine path, so a user
 * reads the same limitation whichever entry point ran the query.
 */
import type { OntologyGap } from '@ontology-search/api-types'

/** One `limitation` gap per domain the compile could not join to `domains`. */
export function droppedReferenceGaps(
  droppedReferences: readonly string[] | undefined,
  domains: readonly string[]
): OntologyGap[] {
  return (droppedReferences ?? []).map((domain) => ({
    term: domain,
    reason: `${domain} could not be joined to ${domains.join(', ') || 'the primary domain'} — cross-reference skipped`,
    kind: 'limitation' as const,
  }))
}
