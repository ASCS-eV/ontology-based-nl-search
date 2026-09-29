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
 * The search service also keeps out a term that is the whole query.
 *
 * `limitation` gaps are not recorded: they report a current engine limit on
 * a concept the ontology has, not a missing concept. `unmapped` gaps include
 * property names the model proposed that the ontology does not declare; those
 * are a signal of what was looked for, so they stay.
 *
 * Bounded, and not a cache: past `capacity` distinct terms, a new term
 * replaces the least reported one (the least recently seen among equals), so
 * a stream of one-off terms cannot push out the terms that recur. A single
 * search records at most {@link MAX_GAP_TERMS_PER_SEARCH} terms, so no one
 * search can flush the log.
 *
 * STANDARDS — the snapshot is the `GET /gaps` body:
 *   [RFC8259] JSON — docs/specs/references/rfc8259-json.md
 *   [JSON-SCHEMA-VAL] JSON Schema Validation — docs/specs/references/json-schema-validation.md
 *             (§7.3.1 `date`: `firstSeen` / `lastSeen` are RFC 3339 `full-date`s)
 */
import type { GapKind, GapLogEntry, GapLogResponse, OntologyGap } from '@ontology-search/api-types'

/** Distinct terms kept by default. */
export const DEFAULT_GAP_LOG_CAPACITY = 1000

/** Longest term, in Unicode code points after normalization, the log records. */
export const MAX_GAP_TERM_CHARS = 80

/** Most distinct terms one search can add to the log. */
export const MAX_GAP_TERMS_PER_SEARCH = 10

/** Length of an RFC 3339 `full-date` (`YYYY-MM-DD`) prefix of an ISO timestamp. */
const FULL_DATE_LENGTH = 'YYYY-MM-DD'.length

/** The kind a gap without an explicit `kind` has (see `OntologyGap.kind`). */
const DEFAULT_GAP_KIND: GapKind = 'unmapped'

/** Gap kinds that describe the ontology, as opposed to the engine. */
const RECORDED_KINDS: ReadonlySet<GapKind> = new Set<GapKind>(['unmapped', 'recognized'])

/** Invisible format characters (zero-width space, joiners, BOM, …). */
const FORMAT_CHARACTERS = /\p{Cf}/gu

/** What the log knows about the search a set of gaps came from. */
export interface GapContext {
  /** The SHACL domain names the search was scoped to, referenced ones included. */
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
  /** Order of first insertion: the last tie-break when choosing what to drop. */
  sequence: number
}

/**
 * The form a term is counted under: Unicode NFKC (so full-width and other
 * compatibility forms fold to their plain form), invisible format characters
 * removed, trimmed, inner whitespace collapsed to one space, lower-cased.
 * Returns `undefined` for a term the log does not record: empty, or longer
 * than {@link MAX_GAP_TERM_CHARS} code points.
 */
export function normalizeGapTerm(term: string): string | undefined {
  const normalized = term
    .normalize('NFKC')
    .replace(FORMAT_CHARACTERS, '')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLowerCase()
  const codePoints = [...normalized].length
  if (codePoints === 0 || codePoints > MAX_GAP_TERM_CHARS) return undefined
  return normalized
}

/** Locale-independent string order, so the snapshot is the same on every host. */
function byCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Which of two tallies to drop first: lower count, then seen longer ago, then older. */
function dropsBefore(a: Tally, b: Tally): boolean {
  if (a.count !== b.count) return a.count < b.count
  if (a.lastSeen !== b.lastSeen) return a.lastSeen < b.lastSeen
  return a.sequence < b.sequence
}

export class GapLog {
  private readonly tallies = new Map<string, Tally>()
  private readonly maxTerms: number
  private readonly now: () => Date
  private inserted = 0

  constructor(options: GapLogOptions = {}) {
    const capacity = options.capacity ?? DEFAULT_GAP_LOG_CAPACITY
    if (capacity <= 0) throw new Error(`GapLog capacity must be positive; got ${capacity}`)
    this.maxTerms = capacity
    this.now = options.now ?? (() => new Date())
  }

  /** Most distinct terms the log keeps. */
  get capacity(): number {
    return this.maxTerms
  }

  /**
   * Count the gaps one search reported. A term the search reported more than
   * once counts once, under each distinct recorded kind it was given; only the
   * first {@link MAX_GAP_TERMS_PER_SEARCH} distinct terms count.
   */
  record(gaps: readonly OntologyGap[], context: GapContext): void {
    const kindsByTerm = new Map<string, Set<GapKind>>()
    for (const gap of gaps) {
      const kind = gap.kind ?? DEFAULT_GAP_KIND
      if (!RECORDED_KINDS.has(kind)) continue
      const term = normalizeGapTerm(gap.term)
      if (term === undefined) continue
      const kinds = kindsByTerm.get(term)
      if (kinds) kinds.add(kind)
      else if (kindsByTerm.size < MAX_GAP_TERMS_PER_SEARCH) kindsByTerm.set(term, new Set([kind]))
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
    if (this.tallies.size >= this.maxTerms) this.dropLeastReported()
    const tally: Tally = {
      term,
      count: 0,
      kinds: new Map(),
      domains: new Set(),
      firstSeen: today,
      lastSeen: today,
      sequence: this.inserted++,
    }
    this.tallies.set(term, tally)
    return tally
  }

  /**
   * Remove the tally {@link dropsBefore} ranks first. A linear scan: it runs
   * only when a new term arrives at a full log, over at most `capacity` entries.
   */
  private dropLeastReported(): void {
    let victim: Tally | undefined
    for (const tally of this.tallies.values()) {
      if (!victim || dropsBefore(tally, victim)) victim = tally
    }
    if (victim) this.tallies.delete(victim.term)
  }
}
