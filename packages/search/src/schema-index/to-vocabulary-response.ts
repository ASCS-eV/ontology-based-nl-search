/**
 * Pure projection `TermCard[]` → `VocabularyResponse` — the wire shape the
 * GraphQL editor's autocomplete consumes.
 *
 * The autocomplete and the LLM schema retrieval read the SAME term index;
 * this module is the only translation between the two, so the editor's
 * vocabulary can never drift from what the interpreter and compiler see.
 *
 * Enum (`sh:in`), numeric (integer/float datatype), and free-form literal
 * properties are projected. Object-reference leaves stay represented by the
 * GraphQL DSL's recursive `references` field.
 */
import type { VocabProperty, VocabularyResponse } from '@ontology-search/api-types'
import { RDF_PREFIXES } from '@ontology-search/core/rdf/prefixes'

import type { TermCard, TermIndex } from './term-index.js'

/** Project the term index into the autocomplete wire shape. */
export function toVocabularyResponse(index: TermIndex): VocabularyResponse {
  const properties: VocabProperty[] = []

  for (const card of index.cards) {
    if (card.kind !== 'property') continue
    const property = projectCard(card)
    if (property) properties.push(property)
  }

  return {
    domains: index.domainCatalog.map((entry) => entry.domain),
    properties,
  }
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

  const datatype = numericDatatype(card.datatype)
  if (datatype) {
    return { ...base, type: 'numeric', datatype }
  }

  if (card.leafKind === 'literal') {
    return { ...base, type: 'string' }
  }

  // Object references are represented by the recursive `references` field.
  return null
}

function numericDatatype(datatype: string | undefined): 'integer' | 'float' | null {
  if (datatype === `${RDF_PREFIXES.xsd}integer`) return 'integer'
  if (datatype === `${RDF_PREFIXES.xsd}float`) return 'float'
  return null
}
