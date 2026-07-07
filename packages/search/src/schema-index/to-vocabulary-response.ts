/**
 * Pure projection `TermCard[]` → `VocabularyResponse` — the wire shape the
 * GraphQL editor's autocomplete consumes.
 *
 * The autocomplete and the LLM schema retrieval read the SAME term index;
 * this module is the only translation between the two, so the editor's
 * vocabulary can never drift from what the interpreter and compiler see.
 *
 * The wire contract stays exactly what the web client expects: only
 * enum (`sh:in`) and numeric (integer/float datatype) properties are
 * projected, `name` is the SHACL local name, and `datatype` is narrowed
 * to the client's `'integer' | 'float'` union.
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
    domains: [...new Set(properties.map((p) => p.domain))],
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

  // Object references and free-form literals have no autocomplete
  // representation in the wire contract.
  return null
}

function numericDatatype(datatype: string | undefined): 'integer' | 'float' | null {
  if (datatype === `${RDF_PREFIXES.xsd}integer`) return 'integer'
  if (datatype === `${RDF_PREFIXES.xsd}float`) return 'float'
  return null
}
