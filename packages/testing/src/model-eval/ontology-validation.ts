import {
  buildTermIndex,
  getInitializedStore,
  type TermCard,
  type TermIndex,
} from '@ontology-search/search'

import { canonicalizeReferenceList } from './scoring.js'
import type { EvaluationSearchSlots, GoldCase, ReferenceSlots } from './types.js'

export interface CorpusValidationResult {
  caseCount: number
  domainCount: number
  propertyCount: number
}

export async function validateGoldCorpus(cases: GoldCase[]): Promise<CorpusValidationResult> {
  const store = await getInitializedStore()
  const index = await buildTermIndex(store)
  const errors: string[] = []

  for (const gold of cases) {
    validateSlots(gold.expected.slots, index, gold, errors)
  }

  if (errors.length > 0) {
    throw new Error(`Gold corpus is not grounded in the loaded ontology:\n${errors.join('\n')}`)
  }

  return {
    caseCount: cases.length,
    domainCount: index.domainCatalog.length,
    propertyCount: index.cards.filter((card) => card.kind === 'property').length,
  }
}

export function findUnknownIdentifiers(
  slots: EvaluationSearchSlots | null,
  index: TermIndex
): string[] {
  if (!slots) return []
  const errors: string[] = []
  validateSlotIdentifiers(slots, index, 'submission', errors)
  return [...new Set(errors)].sort()
}

function validateSlots(
  slots: EvaluationSearchSlots,
  index: TermIndex,
  gold: GoldCase,
  errors: string[]
): void {
  const caseErrors: string[] = []
  validateSlotIdentifiers(slots, index, gold.id, caseErrors)
  if (gold.allowUnknownExpected && gold.expected.gaps.length > 0) {
    const allowedTerms = gold.expected.gaps.map((gap) => gap.term)
    errors.push(...caseErrors.filter((error) => !allowedTerms.some((term) => error.includes(term))))
  } else {
    errors.push(...caseErrors)
  }
}

function validateSlotIdentifiers(
  slots: EvaluationSearchSlots,
  index: TermIndex,
  context: string,
  errors: string[]
): void {
  const knownDomains = new Set(index.domainCatalog.map((domain) => domain.domain))
  for (const domain of slots.domains) {
    if (!knownDomains.has(domain)) errors.push(`${context}: unknown domain "${domain}"`)
  }
  validateFields(slots.filters, slots.ranges, slots.domains, index, context, errors)
  validateReferences(canonicalizeReferenceList(slots.references), index, context, errors)
}

function validateReferences(
  references: ReferenceSlots[],
  index: TermIndex,
  parent: string,
  errors: string[]
): void {
  const knownDomains = new Set(index.domainCatalog.map((domain) => domain.domain))
  for (const reference of references) {
    const context = `${parent} -> ${reference.domain}`
    if (!knownDomains.has(reference.domain)) errors.push(`${context}: unknown reference domain`)
    validateFields(
      reference.filters ?? {},
      reference.ranges ?? {},
      [reference.domain],
      index,
      context,
      errors
    )
    validateReferences(reference.references ?? [], index, context, errors)
  }
}

function validateFields(
  filters: Record<string, string | string[]>,
  ranges: Record<string, { min?: number; max?: number }>,
  domains: string[],
  index: TermIndex,
  context: string,
  errors: string[]
): void {
  for (const [property, value] of Object.entries(filters)) {
    const cards = matchingCards(property, domains, index)
    if (cards.length === 0) {
      errors.push(`${context}: unknown filter property "${property}"`)
      continue
    }
    validateAllowedValues(property, value, cards, context, errors)
  }
  for (const property of Object.keys(ranges)) {
    const cards = matchingCards(property, domains, index)
    if (cards.length === 0) {
      errors.push(`${context}: unknown range property "${property}"`)
      continue
    }
    if (!cards.some((card) => card.datatype && numericDatatype(card.datatype))) {
      errors.push(`${context}: range property "${property}" is not numeric`)
    }
  }
}

function matchingCards(property: string, domains: string[], index: TermIndex): TermCard[] {
  const domainSet = new Set(domains)
  return index.cards.filter(
    (card) =>
      card.kind === 'property' &&
      card.localName === property &&
      (domainSet.size === 0 || domainSet.has(card.domain))
  )
}

function validateAllowedValues(
  property: string,
  value: string | string[],
  cards: TermCard[],
  context: string,
  errors: string[]
): void {
  // A path may be unconstrained in one selected domain and enumerated in
  // another. In that case it is not a universal enum constraint.
  if (cards.some((card) => !card.allowedValues || card.allowedValues.length === 0)) return
  const allowed = new Set(cards.flatMap((card) => card.allowedValues ?? []))
  for (const item of Array.isArray(value) ? value : [value]) {
    if (!allowed.has(item)) {
      errors.push(`${context}: unknown enum/IRI "${property}=${item}"`)
    }
  }
}

function numericDatatype(datatype: string): boolean {
  return /#(?:integer|decimal|double|float|long|int|short|byte|nonNegativeInteger)$/.test(datatype)
}
