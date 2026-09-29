/**
 * Ontology gap log — what searches could not map, counted per term for the
 * people who maintain the ontology.
 *
 * Every natural-language search reports the parts of the query it could not
 * turn into a filter (`OntologyGap`). The search UI shows them to the person
 * who asked; this log keeps a running count per term, so the ontology's
 * maintainers can see which missing concepts come up most, and in which
 * domains, when they decide what to model next.
 *
 * Data minimization is part of the contract, not a setting. An entry holds the
 * normalized term, how searches classified it, the domains they were scoped to
 * and the first and last day it was seen. It never holds the query, a user, a
 * session or a request id, and it keeps dates at day precision. A term longer
 * than {@link MAX_GAP_TERM_CHARS} is not recorded: a gap is a word or a short
 * phrase, and anything longer is more likely a pasted sentence than a concept.
 *
 * Bounded by the LRU primitive (CONTRIBUTING #19): past `capacity` distinct
 * terms, the least recently reported term is dropped.
 *
 * STANDARDS — the snapshot is the `GET /gaps` body:
 *   [RFC8259] JSON — docs/specs/references/rfc8259-json.md
 *   [JSON-SCHEMA-VAL] JSON Schema Validation — docs/specs/references/json-schema-validation.md
 *             (§7.3.1 `date`: `firstSeen` / `lastSeen` are RFC 3339 `full-date`s)
 */
import type { GapKind, GapLogEntry, GapLogResponse, OntologyGap } from '@ontology-search/api-types'
import { LruCache } from '@ontology-search/core/cache/lru'

/** Distinct terms kept by default. */
export const DEFAULT_GAP_LOG_CAPACITY = 1000

/** Longest term, in characters after normalization, the log records. */
export const MAX_GAP_TERM_CHARS = 80

/** Length of an RFC 3339 `full-date` (`YYYY-MM-DD`) prefix of an ISO timestamp. */
const FULL_DATE_LENGTH = 'YYYY-MM-DD'.length

/** The kind a gap without an explicit `kind` has (see `OntologyGap.kind`). */
const DEFAULT_GAP_KIND: GapKind = 'unmapped'

/** What the log knows about the search a set of gaps came from. */
export interface GapContext {
  /** The SHACL domain names the search was scoped to. */
  domains: readonly string[]
}

export interface GapLogOptions {
  /** Distinct terms to keep. Default {@link DEFAULT_GAP_LOG_CAPACITY}. */
  capacity?: number
  /** Clock, injectable for tests. */
  now?: () => Date
}

interface Tally {
  term: string
  count: number
  kinds: Map<GapKind, number>
  /** Bounded by the domains the loaded ontology declares. */
  domains: Set<string>
  firstSeen: string
  lastSeen: string
}

/**
 * The form a term is counted under: Unicode NFC, trimmed, inner whitespace
 * collapsed to one space, lower-cased. Returns `undefined` for a term the log
 * does not record: empty, or longer than {@link MAX_GAP_TERM_CHARS}.
 */
export function normalizeGapTerm(term: string): string | undefined {
  const normalized = term.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase()
  if (normalized.length === 0 || normalized.length > MAX_GAP_TERM_CHARS) return undefined
  return normalized
}

/** Locale-independent string order, so the snapshot is the same on every host. */
function byCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export class GapLog {
  private readonly tallies: LruCache<string, Tally>
  private readonly now: () => Date

  constructor(options: GapLogOptions = {}) {
    this.tallies = new LruCache({ maxSize: options.capacity ?? DEFAULT_GAP_LOG_CAPACITY })
    this.now = options.now ?? (() => new Date())
  }

  /** Most distinct terms the log keeps. */
  get capacity(): number {
    return this.tallies.capacity
  }

  /**
   * Count the gaps one search reported. A term the search reported more than
   * once counts once, under each distinct kind it was given.
   */
  record(gaps: readonly OntologyGap[], context: GapContext): void {
    const kindsByTerm = new Map<string, Set<GapKind>>()
    for (const gap of gaps) {
      const term = normalizeGapTerm(gap.term)
      if (term === undefined) continue
      const kinds = kindsByTerm.get(term) ?? new Set<GapKind>()
      kinds.add(gap.kind ?? DEFAULT_GAP_KIND)
      kindsByTerm.set(term, kinds)
    }
    if (kindsByTerm.size === 0) return

    const today = this.now().toISOString().slice(0, FULL_DATE_LENGTH)
    for (const [term, kinds] of kindsByTerm) {
      const tally = this.tallies.get(term) ?? this.newTally(term, today)
      tally.count += 1
      tally.lastSeen = today
      for (const kind of kinds) tally.kinds.set(kind, (tally.kinds.get(kind) ?? 0) + 1)
      for (const domain of context.domains) tally.domains.add(domain)
    }
  }

  /** Every entry, most reported first, then most recently reported, then by term. */
  snapshot(): GapLogResponse {
    const entries: GapLogEntry[] = [...this.tallies.values()].map((tally) => ({
      term: tally.term,
      count: tally.count,
      kinds: Object.fromEntries(tally.kinds),
      domains: [...tally.domains].sort(),
      firstSeen: tally.firstSeen,
      lastSeen: tally.lastSeen,
    }))
    entries.sort(
      (a, b) =>
        b.count - a.count || byCodeUnits(b.lastSeen, a.lastSeen) || byCodeUnits(a.term, b.term)
    )
    return { capacity: this.capacity, entries }
  }

  private newTally(term: string, today: string): Tally {
    const tally: Tally = {
      term,
      count: 0,
      kinds: new Map(),
      domains: new Set(),
      firstSeen: today,
      lastSeen: today,
    }
    this.tallies.set(term, tally)
    return tally
  }
}
