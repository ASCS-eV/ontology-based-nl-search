/**
 * Pure projection `TermCard[]` → `VocabularyResponse` — the wire shape the
 * GraphQL editor's autocomplete consumes.
 *
 * The autocomplete and the LLM schema retrieval read the SAME term index;
 * this module is the only translation between the two, so the editor's
 * vocabulary can never drift from what the interpreter and compiler see.
 *
 * Enum (`sh:in`), numeric (any [RDF11] §5.1 numeric XSD datatype), and free-form literal
 * properties are projected. Object-reference leaves stay represented by the
 * GraphQL DSL's recursive `references` field.
 *
 * One property per slot key (ADR 0009). A leaf name a domain reaches only
 * through qualified keys is a key too — for every one of its chains — so it
 * is projected as well, typed from those chains (see {@link bareNameProperty}).
 */
import type { VocabProperty, VocabularyResponse } from '@ontology-search/api-types'
import { numericKind } from '@ontology-search/core/rdf/numeric-datatypes'

import type { TermCard, TermIndex } from './term-index.js'

/** Project the term index into the autocomplete wire shape. */
export function toVocabularyResponse(index: TermIndex): VocabularyResponse {
  const properties: VocabProperty[] = []

  // Qualified keys per (domain, leaf name), for the bare names below.
  const qualified = new Map<string, VocabProperty[]>()
  const keys = new Set<string>()
  for (const card of index.cards) {
    if (card.kind !== 'property') continue
    keys.add(`${card.domain}:${card.localName}`)
    const property = projectCard(card)
    if (!property) continue
    properties.push(property)
    if (!card.leafName) continue
    const group = `${card.domain}:${card.leafName}`
    qualified.set(group, [...(qualified.get(group) ?? []), property])
  }
  for (const [group, chains] of qualified) {
    if (keys.has(group)) continue
    properties.push(bareNameProperty(group.slice(group.indexOf(':') + 1), chains))
  }

  return {
    domains: index.domainCatalog.map((entry) => entry.domain),
    properties,
  }
}

/**
 * The property of a bare leaf name over its qualified keys' chains, which it
 * matches any of: an enum over the union of their values when every chain is
 * enumerated, numeric when every chain is numeric (`float` unless all are
 * integers), otherwise a free-form literal.
 */
function bareNameProperty(name: string, chains: VocabProperty[]): VocabProperty {
  const base = {
    name,
    label: name,
    description: `Any of ${chains.map((c) => c.name).join(', ')}`,
    domain: chains[0]!.domain,
  }
  if (chains.every((c) => c.type === 'enum')) {
    const values = [...new Set(chains.flatMap((c) => c.allowedValues ?? []))].sort()
    return { ...base, type: 'enum', allowedValues: values }
  }
  if (chains.every((c) => c.type === 'numeric')) {
    const datatype = chains.every((c) => c.datatype === 'integer') ? 'integer' : 'float'
    return { ...base, type: 'numeric', datatype }
  }
  return { ...base, type: 'string' }
}

function projectCard(card: TermCard): VocabProperty | null {
  const base = {
    name: card.localName,
    label: card.labels[0] ?? card.localName,
    description: card.description ?? '',
    domain: card.domain,
  }

  if (card.allowedValues && card.allowedValues.length > 0) {
    return { ...base, type: 'enum', allowedValues: [...card.allowedValues] }
  }

  const datatype = numericKind(card.datatype)
  if (datatype) {
    return { ...base, type: 'numeric', datatype }
  }

  if (card.leafKind === 'literal') {
    return { ...base, type: 'string' }
  }

  // Object references are represented by the recursive `references` field.
  return null
}
