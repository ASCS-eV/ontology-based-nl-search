/**
 * Static prompt core — the query-independent instruction sections of the
 * system prompt (preamble, static sections, rules, examples).
 *
 * The core is byte-stable across calls and leads every composed prompt: a
 * stable prefix is what makes provider-side prompt caching effective (only
 * the small retrieved tail varies per query).
 */
import { EXAMPLES, PREAMBLE, RULES, STATIC_SECTIONS } from './templates.js'

let cachedCore: string | null = null

/** The concatenated query-independent prompt sections. Cached; byte-stable. */
export function buildStaticCore(): string {
  cachedCore ??= [PREAMBLE, STATIC_SECTIONS, RULES, EXAMPLES].join('\n')
  return cachedCore
}
