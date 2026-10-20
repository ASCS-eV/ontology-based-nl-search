/**
 * Prompt composer — turns a `RetrievedSchema` into the per-request system
 * prompt: static core first (byte-stable, cache-friendly prefix), then the
 * query-relevant ontology fragments, then the always-present domain
 * catalog.
 *
 * Security note: the composer deliberately takes NO user-query parameter.
 * User text reaches the LLM only as the user message — retrieval has
 * already consumed the query for selection, and the fragments themselves
 * are server-derived from the schema graph ([SHACL]), never from user
 * text. Interpolating the query here would grant user text system-prompt
 * authority for zero benefit.
 */
import type { RetrievedSchema, ShaclFragment, TermCard } from '@ontology-search/search'
import { renderDistilledCards } from '@ontology-search/search'

/**
 * Compose the system prompt from the cached static core and the retrieved
 * schema context.
 */
export function composePrompt(core: string, retrieved: RetrievedSchema): string {
  return joinPromptParts(core, composeRetrievedSections(retrieved))
}

/** The single core+tail concatenation rule (kept here so it cannot drift). */
export function joinPromptParts(core: string, tail: string): string {
  return [core, tail].join('\n')
}

/**
 * The query-dependent tail alone — the retrieved fragments + domain
 * catalog, WITHOUT the static core. The Copilot adapter needs this split:
 * its pooled sessions bake the static core as the session system message
 * (stable → prompt-cacheable), and the tail rides in the request message
 * (the SDK cannot replace a session's system message per turn).
 */
export function composeRetrievedSections(retrieved: RetrievedSchema): string {
  const preamble: string[] = []

  preamble.push('## Ontology Reference — Retrieved Schema Fragments\n')
  preamble.push(
    'The following SHACL fragments cover the parts of the ontology relevant to the current query.'
  )
  preamble.push(
    'Read the Turtle carefully — look for `sh:in` (allowed values), `sh:pattern` (regex), `sh:datatype` (type), `sh:path` (property name), `sh:name` (label), and `sh:description` (meaning).\n'
  )

  // Properties whose raw SHACL made it into the (budget-bounded) fragment
  // payload; everything else selected renders as a distilled line, so
  // coverage survives the budget.
  //
  // Keyed by (domain, iri), not by iri alone: one property IRI can be
  // reachable from several domains, and a fragment only renders it under
  // the one domain it was retrieved for. Treating it as covered everywhere
  // would drop it from every *other* routed domain's distilled list while
  // the roster still counted it as shown — so the property would appear in
  // no block of its own domain and in no remainder marker, and the roster
  // would read as exhaustive while omitting it.
  const covered = new Set(
    retrieved.fragments.flatMap((f) => f.propertyIris.map((iri) => coverageKey(f.domain, iri)))
  )
  const fragmentsByDomain = groupFragments(retrieved)
  const uncoveredByDomain = groupCards(
    retrieved,
    (card) => !covered.has(coverageKey(card.domain, card.iri))
  )
  const rostersByDomain = rosters(retrieved)

  const domains = new Set([
    ...retrieved.domains,
    ...fragmentsByDomain.keys(),
    ...uncoveredByDomain.keys(),
  ])
  const blocks: { lines: string[]; roster: string[] }[] = []
  for (const domain of domains) {
    const fragments = fragmentsByDomain.get(domain) ?? []
    const uncovered = uncoveredByDomain.get(domain) ?? []
    const roster = rostersByDomain.get(domain) ?? []
    if (fragments.length === 0 && uncovered.length === 0 && roster.length === 0) continue

    const lines: string[] = [`### ${formatDomainHeader(domain)} domain\n`]
    if (fragments.length > 0) {
      lines.push('```turtle')
      lines.push(fragments.map((f) => f.turtle.trim()).join('\n\n'))
      lines.push('```\n')
    }
    if (uncovered.length > 0) {
      if (fragments.length > 0) lines.push('Further properties of this domain (condensed):\n')
      lines.push('```')
      lines.push(renderDistilledCards(uncovered))
      lines.push('```\n')
    }
    blocks.push({ lines, roster })
  }

  // The catalog is ALWAYS present: it lets the model distinguish "not
  // retrieved for this query" from "absent from the ontology", so gap
  // reporting stays honest under retrieval.
  const catalog: string[] = ['## Domain Catalog — every searchable domain\n']
  catalog.push(
    'The fragments above are a query-specific selection. The complete set of searchable domains is listed here; if a user concept matches nothing above and nothing here, report it as an ontology gap instead of inventing a property.\n'
  )
  for (const entry of retrieved.catalog) {
    const classLabel = entry.classLabels[0] ?? entry.domain
    catalog.push(`- ${entry.domain} (${classLabel}) — e.g. ${entry.sampleTerms.join(', ')}`)
  }
  catalog.push('')

  const payloadChars =
    charsOf(preamble) +
    charsOf(catalog) +
    blocks.reduce((sum, block) => sum + charsOf(block.lines), 0)
  const rosterLines = allocateRosters(
    blocks.map((block) => block.roster),
    payloadChars * MAX_ROSTER_SHARE
  )

  const sections = [...preamble]
  blocks.forEach((block, index) => {
    sections.push(...block.lines)
    const line = rosterLines.lines[index]
    if (line) sections.push(line)
  })
  if (rosterLines.summary) sections.push(rosterLines.summary)
  sections.push(...catalog)

  return sections.join('\n')
}

/**
 * Coverage identity of a property: a property is rendered for a *domain*,
 * so the same IRI reached from two domains is two separate obligations.
 */
function coverageKey(domain: string, iri: string): string {
  return `${domain}\u0000${iri}`
}

/** Length of a section list once joined, newlines included. */
function charsOf(lines: string[]): number {
  let total = 0
  for (const line of lines) total += line.length + 1
  return total
}

/**
 * The share of the retrieved payload the property rosters may occupy.
 *
 * The roster annotates the payload; it must not outweigh it. Expressing the
 * cap as a *share* rather than an absolute character count is what makes it
 * ontology-independent: every other part of the tail is already bounded
 * (fragments by the retrieval character budget, distilled cards by the card
 * budget, the catalog by the domain count), so bounding the roster
 * relatively bounds the whole tail without anyone having to guess a number
 * that a larger ontology would invalidate.
 *
 * The cap is falsifiable rather than tuned: a roster that needs more than a
 * quarter of the payload to suppress false gaps is evidence the *card*
 * budget is too small for that ontology, and should be raised instead.
 *
 * The cap binds the whole roster, markers included — see
 * {@link allocateRosters}, which degrades to a single aggregate line rather
 * than emitting a per-domain marker it cannot afford.
 */
const MAX_ROSTER_SHARE = 0.25

const ROSTER_PREFIX = 'Also defined in this domain, not retrieved for this query: '

/**
 * Spend a roster budget across domains by equal shares, smallest roster
 * first, with each domain's unspent share rolling forward to the next.
 *
 * Smallest-first is what makes the split fair rather than first-come: a
 * domain that fits inside its share releases the remainder, so a few huge
 * domains can never starve the rest, and no domain is truncated while
 * another prints in full within the same budget.
 *
 * A domain whose share cannot hold even `prefix + "…+N more"` is not given
 * an over-budget line: its omission rolls into one aggregate summary
 * instead. That keeps the honesty signal O(1) rather than O(routed
 * domains), so the roster stays inside its share no matter how high
 * `RETRIEVAL_MAX_DOMAINS` is configured.
 */
function allocateRosters(
  rosters: string[][],
  budget: number
): { lines: (string | null)[]; summary: string | null } {
  const lines: (string | null)[] = rosters.map(() => null)
  const order = rosters
    .map((names, index) => ({ index, names }))
    .filter((entry) => entry.names.length > 0)
    .sort((a, b) => a.names.length - b.names.length || a.index - b.index)

  let remaining = Math.max(0, Math.floor(budget))
  let left = order.length
  const unreported: string[][] = []
  for (const { index, names } of order) {
    const line = fitRoster(names, Math.floor(remaining / left))
    left--
    if (!line) {
      unreported.push(names)
      continue
    }
    lines[index] = line
    remaining -= line.length + 1
  }
  return { lines, summary: summarizeUnreported(unreported) }
}

/**
 * One line standing in for every roster the budget could not afford.
 *
 * Fixed cost regardless of how many domains it covers, so it cannot be the
 * thing that overruns the budget — and it still tells the model those
 * domains hold properties it was not shown, which is the whole point of
 * the roster.
 */
function summarizeUnreported(rosters: string[][]): string | null {
  if (rosters.length === 0) return null
  let total = 0
  for (const names of rosters) total += names.length
  return `Further properties exist in ${rosters.length} more routed domain(s) (${total} in total) but were not retrieved for this query.\n`
}

/**
 * Render one roster within `budget`, dropping trailing names if it does not
 * fit. Truncation is never silent: the remainder marker is reserved before
 * any name is admitted, so a line is only ever emitted when its marker is
 * paid for. A budget too small for even the marker yields no line, and the
 * caller accounts for the domain in an aggregate instead.
 */
function fitRoster(names: string[], budget: number): string | null {
  if (names.length === 0) return null
  const whole = `${ROSTER_PREFIX}${names.join(', ')}\n`
  if (whole.length <= budget) return whole

  // `rest` is always below `names.length`, so the full count's rendering is
  // an upper bound on the marker and reserving it can never overrun.
  const marker = (rest: number) => `…+${rest} more`
  const shown: string[] = []
  let used = ROSTER_PREFIX.length + marker(names.length).length + 1
  if (used > budget) return null
  for (const name of names) {
    const next = used + name.length + 2
    if (next > budget) break
    used = next
    shown.push(name)
  }
  return `${ROSTER_PREFIX}${[...shown, marker(names.length - shown.length)].join(', ')}\n`
}

/** Fragments grouped by domain, routed domains first, then discovery order. */
function groupFragments(retrieved: RetrievedSchema): Map<string, ShaclFragment[]> {
  const groups = new Map<string, ShaclFragment[]>()
  for (const domain of retrieved.domains) groups.set(domain, [])
  for (const fragment of retrieved.fragments) {
    const list = groups.get(fragment.domain) ?? []
    list.push(fragment)
    groups.set(fragment.domain, list)
  }
  for (const [domain, fragments] of groups) if (fragments.length === 0) groups.delete(domain)
  return groups
}

/** Property cards grouped by domain, routed domains first, then discovery order. */
function groupCards(
  retrieved: RetrievedSchema,
  keep: (card: TermCard) => boolean
): Map<string, TermCard[]> {
  const groups = new Map<string, TermCard[]>()
  for (const domain of retrieved.domains) groups.set(domain, [])
  for (const card of retrieved.cards) {
    if (card.kind !== 'property' || !keep(card)) continue
    const list = groups.get(card.domain) ?? []
    list.push(card)
    groups.set(card.domain, list)
  }
  for (const [domain, cards] of groups) if (cards.length === 0) groups.delete(domain)
  return groups
}

/**
 * Per-routed-domain list of property names the card budget left out.
 *
 * Selection is bounded, so a domain with more properties than the budget
 * shows only its top-ranked ones. Without this the model cannot tell
 * "absent from the ontology" from "crowded out of this query's selection",
 * and reports existing properties as ontology gaps — the same honesty
 * problem the always-attached catalog solves between domains, solved here
 * within one.
 *
 * Deliberately names only, and deliberately only for the domains actually
 * routed: it is complete where completeness changes an answer, and costs a
 * few tokens per property rather than a card's worth. The list itself still
 * grows with the ontology, so the composer spends it against
 * {@link MAX_ROSTER_SHARE} and truncates with an explicit remainder marker
 * — that marker carries the same "there is more here" signal as the names
 * do, so the honesty guarantee survives the bound. Raising the card budget
 * instead would scale the expensive payload with the ontology; this scales
 * the cheap one, and caps it.
 *
 * `shown` may exclude a name only because that name is rendered in *this*
 * domain's block; see the coverage key in {@link composeRetrievedSections},
 * which is what makes that true for a property reachable from more than one
 * domain.
 */
function rosters(retrieved: RetrievedSchema): Map<string, string[]> {
  const catalogByDomain = new Map(retrieved.catalog.map((entry) => [entry.domain, entry]))
  const shown = new Map<string, Set<string>>()
  for (const card of retrieved.cards) {
    if (card.kind !== 'property') continue
    const names = shown.get(card.domain) ?? new Set<string>()
    names.add(card.localName)
    shown.set(card.domain, names)
  }

  const result = new Map<string, string[]>()
  for (const domain of retrieved.domains) {
    const names = catalogByDomain.get(domain)?.propertyNames ?? []
    const rendered = shown.get(domain) ?? new Set<string>()
    const remaining = [...new Set(names)].filter((name) => !rendered.has(name))
    if (remaining.length > 0) result.set(domain, remaining)
  }
  return result
}

/**
 * Format a domain id (kebab-case, e.g. `environment-model`) into a
 * human-readable section header (`Environment Model`).
 *
 * Mechanical transformation only — deliberately NOT a hand-maintained
 * domain-to-label map, and not SHACL `rdfs:label` either (the ontologies we
 * ship use `"Ontology definition for X"@en`, which is not a display
 * string). Kebab→Title conversion gives sensible results for any
 * well-named domain and stays ontology-agnostic.
 */
export function formatDomainHeader(domain: string): string {
  return domain
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
