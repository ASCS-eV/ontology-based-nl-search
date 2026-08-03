import type { EvaluationSearchSlots, GoldCase, ReferenceSlots } from './types.js'

export interface SlotScore {
  exact: boolean
  truePositive: number
  falsePositive: number
  falseNegative: number
  referenceTopologyExact: boolean
}

export interface SampleScore {
  rawExact: boolean
  validatedExact: boolean
  fieldTruePositive: number
  fieldFalsePositive: number
  fieldFalseNegative: number
  gapTruePositive: number
  gapFalsePositive: number
  gapFalseNegative: number
  referenceTopologyExact: boolean
  lookupCount: number
  requiredLookupsSatisfied: boolean
  compilationValid: boolean
}

export function canonicalizeSlots(slots: EvaluationSearchSlots): EvaluationSearchSlots {
  const references = canonicalizeReferenceList(slots.references)
  return {
    domains: [...slots.domains].sort(),
    filters: canonicalizeFilters(slots.filters),
    ranges: Object.fromEntries(
      Object.entries(slots.ranges)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, range]) => [
          key,
          {
            ...(range.min === undefined ? {} : { min: range.min }),
            ...(range.max === undefined ? {} : { max: range.max }),
          },
        ])
    ),
    ...(references.length === 0 ? {} : { references }),
  }
}

function canonicalizeFilters(
  filters: Record<string, string | string[]>
): Record<string, string | string[]> {
  return Object.fromEntries(
    Object.entries(filters)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, Array.isArray(value) ? [...value].sort() : value])
  )
}

export function canonicalizeReferenceList(
  references: ReferenceSlots | ReferenceSlots[] | undefined
): ReferenceSlots[] {
  const list = references ? (Array.isArray(references) ? references : [references]) : []
  return list
    .map((reference) => ({
      domain: reference.domain,
      ...(reference.filters ? { filters: canonicalizeFilters(reference.filters) } : {}),
      ...(reference.ranges
        ? {
            ranges: Object.fromEntries(
              Object.entries(reference.ranges).sort(([left], [right]) => left.localeCompare(right))
            ),
          }
        : {}),
      ...(reference.references
        ? { references: canonicalizeReferenceList(reference.references) }
        : {}),
    }))
    .sort((left, right) => stableJson(left).localeCompare(stableJson(right)))
}

export function scoreSlots(
  expected: EvaluationSearchSlots,
  actual: EvaluationSearchSlots | null
): SlotScore {
  const expectedCanonical = canonicalizeSlots(expected)
  const actualCanonical = actual ? canonicalizeSlots(actual) : null
  const expectedFields = flattenSlots(expectedCanonical)
  const actualFields = actualCanonical ? flattenSlots(actualCanonical) : new Set<string>()
  const truePositive = intersectionSize(expectedFields, actualFields)
  const topologyExpected = topology(expectedCanonical.references)
  const topologyActual = topology(actualCanonical?.references)

  return {
    exact:
      actualCanonical !== null && stableJson(expectedCanonical) === stableJson(actualCanonical),
    truePositive,
    falsePositive: actualFields.size - truePositive,
    falseNegative: expectedFields.size - truePositive,
    referenceTopologyExact: stableJson(topologyExpected) === stableJson(topologyActual),
  }
}

export function scoreSample(input: {
  gold: GoldCase
  raw: EvaluationSearchSlots | null
  validated: EvaluationSearchSlots | null
  actualGapTerms: string[]
  lookupNames: string[]
  compilationValid: boolean
}): SampleScore {
  const raw = scoreSlots(input.gold.expected.slots, input.raw)
  const validated = scoreSlots(input.gold.expected.slots, input.validated)
  const expectedGaps = new Set(input.gold.expected.gaps.map((gap) => gap.term))
  const actualGaps = new Set(input.actualGapTerms)
  const gapTruePositive = intersectionSize(expectedGaps, actualGaps)
  const required = new Set(input.gold.toolPolicy.required)
  const allowed = new Set<string>([...input.gold.toolPolicy.allowed, ...required])
  const seen = new Set(input.lookupNames)
  const directSubmissionPermitted =
    input.gold.toolPolicy.directSubmissionAllowed || input.lookupNames.length > 0

  return {
    rawExact: raw.exact,
    validatedExact: validated.exact,
    fieldTruePositive: validated.truePositive,
    fieldFalsePositive: validated.falsePositive,
    fieldFalseNegative: validated.falseNegative,
    gapTruePositive,
    gapFalsePositive: actualGaps.size - gapTruePositive,
    gapFalseNegative: expectedGaps.size - gapTruePositive,
    referenceTopologyExact: validated.referenceTopologyExact,
    lookupCount: input.lookupNames.length,
    requiredLookupsSatisfied:
      directSubmissionPermitted &&
      [...required].every((name) => seen.has(name)) &&
      input.lookupNames.every((name) => allowed.has(name)),
    compilationValid: input.compilationValid,
  }
}

export function flattenSlots(slots: EvaluationSearchSlots): Set<string> {
  const fields = new Set<string>()
  for (const domain of slots.domains) fields.add(`domain=${domain}`)
  for (const [property, value] of Object.entries(slots.filters)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      fields.add(`filter:${property}=${item}`)
    }
  }
  for (const [property, range] of Object.entries(slots.ranges)) {
    if (range.min !== undefined) fields.add(`range:${property}.min=${range.min}`)
    if (range.max !== undefined) fields.add(`range:${property}.max=${range.max}`)
  }
  visitReferences(slots.references, 'reference', fields)
  return fields
}

function visitReferences(
  references: ReferenceSlots | ReferenceSlots[] | undefined,
  parent: string,
  fields: Set<string>
): void {
  for (const [index, reference] of canonicalizeReferenceList(references).entries()) {
    const path = `${parent}[${index}]:${reference.domain}`
    fields.add(path)
    for (const [property, value] of Object.entries(reference.filters ?? {})) {
      for (const item of Array.isArray(value) ? value : [value]) {
        fields.add(`${path}:filter:${property}=${item}`)
      }
    }
    for (const [property, range] of Object.entries(reference.ranges ?? {})) {
      if (range.min !== undefined) fields.add(`${path}:range:${property}.min=${range.min}`)
      if (range.max !== undefined) fields.add(`${path}:range:${property}.max=${range.max}`)
    }
    visitReferences(reference.references, path, fields)
  }
}

function topology(references: ReferenceSlots | ReferenceSlots[] | undefined): unknown[] {
  return canonicalizeReferenceList(references).map((reference) => ({
    domain: reference.domain,
    children: topology(reference.references),
  }))
}

function stableJson(value: unknown): string {
  return JSON.stringify(value)
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0
  for (const item of left) if (right.has(item)) count += 1
  return count
}
