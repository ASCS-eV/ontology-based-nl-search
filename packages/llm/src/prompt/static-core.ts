/**
 * Static prompt core — the query-independent template sections shared by
 * BOTH prompt modes (epic #120, task 06).
 *
 * `full` mode (`buildSystemPrompt`) and `retrieval` mode (`composePrompt`)
 * import the same template constants, so the two paths cannot drift; this
 * module only fixes their query-independent concatenation order — which
 * deliberately mirrors full mode (PREAMBLE → static sections → rules →
 * examples) so downstream marker assertions transfer.
 *
 * The core is byte-stable across calls: it leads every composed prompt, so
 * a stable prefix is what makes provider-side prompt caching effective for
 * the retrieval mode (only the small retrieved tail varies per query).
 */
import { EXAMPLES, PREAMBLE, RULES, STATIC_SECTIONS } from '../prompt-builder-templates.js'

let cachedCore: string | null = null

/** The concatenated query-independent prompt sections. Cached; byte-stable. */
export function buildStaticCore(): string {
  cachedCore ??= [PREAMBLE, STATIC_SECTIONS, RULES, EXAMPLES].join('\n')
  return cachedCore
}
