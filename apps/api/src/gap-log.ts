/**
 * The process's ontology gap log (composition root).
 *
 * Single-tenant by design (CONTRIBUTING #18): one API process serves one
 * ontology, so one log counts the gaps of every search it answers. The search
 * service writes to it through the `recordGaps` dependency wired in
 * `search-factory.ts`; `GET /gaps` (`routes/gaps.ts`) reads it. Both happen
 * only while `FEATURE_GAP_LOG` is on. `resetGapLog` exists for tests.
 */
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
 * The search service's `recordGaps` dependency: feeds the process-wide log
 * while the feature is on, and is absent while it is off, so a disabled log
 * never sees a term.
 */
export function gapLogRecorder(enabled: boolean): SearchDependencies['recordGaps'] {
  if (!enabled) return undefined
  return (gaps, context) => getGapLog().record(gaps, context)
}
