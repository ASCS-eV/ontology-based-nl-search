/**
 * Generic schema-lookup tools — small, ontology-blind lookups the model
 * may call before `submit_slots` when the retrieved context doesn't cover
 * a user term. One SDK-agnostic definition (name, description, Zod args,
 * handler); the adapters wrap it for their SDK.
 *
 * The security model is untouched: every argument is structured and
 * validated against the term index, every query the tools run is either a
 * schema-index lookup or SPARQL emitted by the deterministic compiler —
 * the model never supplies query text, patterns, or IRIs it hasn't read
 * from the index. `submit_slots` remains the only submission path.
 *
 * `probe_data` and the observed half of `list_values` query instance data
 * LIVE and bounded at request time — the supported way to check for data
 * gaps (never pre-analysis).
 */
import {
  buildTermIndex,
  compileCountQuery,
  compileSlots,
  extractShaclFragments,
  getInstanceValues,
  rankCards,
  type TermCard,
} from '@ontology-search/search'
import { z } from 'zod'

import { getAgentContext } from './agent-context.js'

/** Registered lookup-tool names — the policy exposes these to both adapters. */
export const SCHEMA_TOOL_NAMES = [
  'find_terms',
  'describe_shape',
  'list_values',
  'probe_data',
] as const

const FIND_TERMS_LIMIT = 8
const LABELS_LIMIT = 3
const VALUES_LIMIT = 25
const FRAGMENT_CHARS_LIMIT = 4_000

export const findTermsArgs = z.object({
  text: z.string().min(1).describe('Free-text concept to look up (a user term, not an IRI)'),
})

export const describeShapeArgs = z.object({
  iri: z.string().min(1).describe('Exact property or class IRI from a previous find_terms result'),
})

export const listValuesArgs = z.object({
  propertyIri: z.string().min(1).describe('Exact property IRI from a previous find_terms result'),
})

export const probeDataArgs = z.object({
  domain: z.string().min(1).describe('Domain name from the catalog or a find_terms result'),
  filters: z
    .record(z.string(), z.string())
    .optional()
    .describe('Optional exact-value filters keyed by property local name'),
})

/** One SDK-agnostic lookup tool. Handlers return JSON-serializable results. */
export interface SchemaToolDefinition {
  name: (typeof SCHEMA_TOOL_NAMES)[number]
  description: string
  argsSchema: z.ZodType
  handler: (args: unknown) => Promise<Record<string, unknown>>
}

/**
 * The four lookup tools. Handlers parse their own args (both SDKs already
 * validate, this is defence in depth), resolve everything through the
 * cached term index, and answer compactly — results ride in the model's
 * context window.
 */
export const SCHEMA_TOOL_DEFINITIONS: SchemaToolDefinition[] = [
  {
    name: 'find_terms',
    description:
      'Look up ontology terms matching a free-text concept. Returns the best-matching ' +
      'properties/classes with their domain, labels, datatype, allowed values, and ' +
      'reference edges. Use when a user term matches nothing in the provided context.',
    argsSchema: findTermsArgs,
    handler: async (args) => {
      const { text } = findTermsArgs.parse(args)
      const { store } = await getAgentContext()
      const index = await buildTermIndex(store)
      const matches = rankCards(text, index.cards)
        .slice(0, FIND_TERMS_LIMIT)
        .map(({ card, score }) => compactCard(card, score))
      return { matches }
    },
  },
  {
    name: 'describe_shape',
    description:
      'Return the minimal SHACL fragment (constraints, datatypes, enumerations) for one ' +
      'property or class IRI previously returned by find_terms.',
    argsSchema: describeShapeArgs,
    handler: async (args) => {
      const { iri } = describeShapeArgs.parse(args)
      const { store } = await getAgentContext()
      const index = await buildTermIndex(store)
      const card = index.cards.find((c) => c.iri === iri)
      if (!card) {
        return { error: 'Unknown IRI — call find_terms first and use an IRI it returned.' }
      }
      const fragments = await extractShaclFragments(
        store,
        card.kind === 'property' ? { propertyIris: [iri] } : { targetClasses: [iri] }
      )
      const turtle = fragments.map((f) => f.turtle.trim()).join('\n\n')
      const truncated = turtle.length > FRAGMENT_CHARS_LIMIT
      return {
        domain: card.domain,
        turtle: truncated ? `${turtle.slice(0, FRAGMENT_CHARS_LIMIT)}\n# …truncated` : turtle,
        ...(truncated ? { truncated } : {}),
      }
    },
  },
  {
    name: 'list_values',
    description:
      'List the declared (sh:in) and the live observed values of a property. Observed ' +
      'values come from the actual data — an allowed value with no observations is a ' +
      'data gap worth reporting.',
    argsSchema: listValuesArgs,
    handler: async (args) => {
      const { propertyIri } = listValuesArgs.parse(args)
      const { store } = await getAgentContext()
      const index = await buildTermIndex(store)
      const card = index.cards.find((c) => c.kind === 'property' && c.iri === propertyIri)
      if (!card) {
        return { error: 'Unknown property IRI — call find_terms first.' }
      }
      const observed = (await getInstanceValues(store, [propertyIri])).get(propertyIri) ?? []
      return {
        allowedValues: card.allowedValues ?? [],
        observedValues: observed.slice(0, VALUES_LIMIT),
        ...(observed.length > VALUES_LIMIT ? { observedTruncated: true } : {}),
      }
    },
  },
  {
    name: 'probe_data',
    description:
      'Count live instances of a domain, optionally filtered by exact property values. ' +
      'Use to distinguish "the ontology cannot express this" from "no data matches" ' +
      'before submitting. Bounded and read-only.',
    argsSchema: probeDataArgs,
    handler: async (args) => {
      const { domain, filters } = probeDataArgs.parse(args)
      const { store } = await getAgentContext()
      const index = await buildTermIndex(store)
      const domainCards = index.byDomain.get(domain)
      if (!domainCards) {
        return { error: 'Unknown domain — use a name from the catalog or find_terms.' }
      }

      if (!filters || Object.keys(filters).length === 0) {
        const sparql = await compileCountQuery(domain)
        const result = await store.query(sparql)
        return { domain, count: Number(result.results.bindings[0]?.['count']?.value ?? 0) }
      }

      const known = new Set(
        domainCards.filter((c) => c.kind === 'property').map((c) => c.localName)
      )
      const unknown = Object.keys(filters).filter((name) => !known.has(name))
      if (unknown.length > 0) {
        return { error: `Unknown properties for ${domain}: ${unknown.join(', ')}` }
      }

      // The probe SPARQL is emitted by the deterministic compiler from
      // validated slots — identical trust path to a real search.
      const sparql = await compileSlots({ domains: [domain], filters, ranges: {} })
      const result = await store.query(sparql)
      const assets = new Set(result.results.bindings.map((b) => b['asset']?.value).filter(Boolean))
      return { domain, matches: assets.size, capped: true }
    },
  },
]

function compactCard(card: TermCard, score: number): Record<string, unknown> {
  return {
    iri: card.iri,
    localName: card.localName,
    kind: card.kind,
    domain: card.domain,
    labels: card.labels.slice(0, LABELS_LIMIT),
    score: Number(score.toFixed(2)),
    ...(card.datatype ? { datatype: card.datatype } : {}),
    ...(card.allowedValues
      ? {
          allowedValues: card.allowedValues.slice(0, VALUES_LIMIT),
          ...(card.allowedValues.length > VALUES_LIMIT ? { allowedValuesTruncated: true } : {}),
        }
      : {}),
    ...(card.referencesDomain ? { referencesDomain: card.referencesDomain } : {}),
  }
}
