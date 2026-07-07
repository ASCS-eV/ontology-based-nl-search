/**
 * Prompt composer — turns a `RetrievedSchema` into the per-request system
 * prompt: static core first (byte-stable, cache-friendly prefix), then the
 * query-relevant ontology fragments, then the always-present domain
 * catalog (epic #120, task 06).
 *
 * Security note (adversarial review): the composer deliberately takes NO
 * user-query parameter. User text reaches the LLM only as the user
 * message, exactly as in `full` mode — retrieval has already consumed the
 * query for selection, and the fragments themselves are server-derived
 * from the schema graph ([SHACL]), never from user text. Interpolating the
 * query here would grant user text system-prompt authority for zero
 * benefit.
 */
import type { RetrievedSchema, ShaclFragment, TermCard } from '@ontology-search/search'
import { renderDistilledCards } from '@ontology-search/search'

import { formatDomainHeader } from '../prompt-builder.js'

/**
 * Compose the system prompt from the cached static core and the retrieved
 * schema context. Section markers (`### <Domain> domain`, fenced
 * ` ```turtle `) intentionally match `full` mode so prompt-shape
 * assertions and LLM familiarity transfer between modes.
 */
export function composePrompt(core: string, retrieved: RetrievedSchema): string {
  const sections: string[] = [core]

  sections.push('## Ontology Reference — Retrieved Schema Fragments\n')
  sections.push(
    'The following SHACL fragments cover the parts of the ontology relevant to the current query.'
  )
  sections.push(
    'Read the Turtle carefully — look for `sh:in` (allowed values), `sh:pattern` (regex), `sh:datatype` (type), `sh:path` (property name), `sh:name` (label), and `sh:description` (meaning).\n'
  )

  if (retrieved.fragments.length > 0) {
    for (const [domain, fragments] of groupFragments(retrieved)) {
      sections.push(`### ${formatDomainHeader(domain)} domain\n`)
      sections.push('```turtle')
      sections.push(fragments.map((f) => f.turtle.trim()).join('\n\n'))
      sections.push('```\n')
    }
  } else if (retrieved.cards.length > 0) {
    // Distilled mode: one dense line per term instead of raw Turtle.
    for (const [domain, cards] of groupCards(retrieved)) {
      sections.push(`### ${formatDomainHeader(domain)} domain\n`)
      sections.push('```')
      sections.push(renderDistilledCards(cards))
      sections.push('```\n')
    }
  }

  // The catalog is ALWAYS present: it lets the model distinguish "not
  // retrieved for this query" from "absent from the ontology", so gap
  // reporting stays honest under retrieval (epic constraint 3).
  sections.push('## Domain Catalog — every searchable domain\n')
  sections.push(
    'The fragments above are a query-specific selection. The complete set of searchable domains is listed here; if a user concept matches nothing above and nothing here, report it as an ontology gap instead of inventing a property.\n'
  )
  for (const entry of retrieved.catalog) {
    const classLabel = entry.classLabels[0] ?? entry.domain
    sections.push(`- ${entry.domain} (${classLabel}) — e.g. ${entry.sampleTerms.join(', ')}`)
  }
  sections.push('')

  return sections.join('\n')
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

/** Cards grouped by domain, routed domains first, then discovery order. */
function groupCards(retrieved: RetrievedSchema): Map<string, TermCard[]> {
  const groups = new Map<string, TermCard[]>()
  for (const domain of retrieved.domains) groups.set(domain, [])
  for (const card of retrieved.cards) {
    const list = groups.get(card.domain) ?? []
    list.push(card)
    groups.set(card.domain, list)
  }
  for (const [domain, cards] of groups) if (cards.length === 0) groups.delete(domain)
  return groups
}
