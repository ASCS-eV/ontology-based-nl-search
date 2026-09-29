/**
 * The process's ontology gap log (composition root).
 *
 * Single-tenant by design (CONTRIBUTING #18): one API process serves one
 * ontology, so one log counts the gaps of every search it answers. The search
 * service writes to it through the `recordGaps` dependency wired in
 * `search-factory.ts`; `GET /gaps` (`routes/gaps.ts`) reads it. Both happen
 * only while `FEATURE_GAP_LOG` is on, checked at the moment of each.
 * `resetGapLog` exists for tests.
 */
import { getConfig } from '@ontology-search/core/config'
import type { SearchDependencies } from '@ontology-search/search'
import { GapLog } from '@ontology-search/search'

let instance: GapLog | null = null

/** The process-wide gap log, created on first use. */
export function getGapLog(): GapLog {
  instance ??= new GapLog()
  return instance
}

/** Drop the process-wide gap log (for testing only). */
export function resetGapLog(): void {
  instance = null
}

/**
 * The search service's `recordGaps` dependency. It reads `FEATURE_GAP_LOG` on
 * every call, the same moment `GET /gaps` reads it, so recording and serving
 * cannot disagree: while the flag is off, no term reaches the log.
 */
export const recordGapsWhenEnabled: NonNullable<SearchDependencies['recordGaps']> = (
  gaps,
  context
) => {
  if (getConfig().FEATURE_GAP_LOG) getGapLog().record(gaps, context)
}
