/**
 * Prompt-composer tests (issue #126): byte-stable static core, composed
 * retrieval prompts, and the no-user-text-in-system-prompt guarantee.
 */
import type { RetrievedSchema } from '@ontology-search/search'
import { buildTermIndex, getInitializedStore } from '@ontology-search/search'
import { beforeAll, describe, expect, it } from 'vitest'

import { buildRequestPrompt } from '../agent/agent-context.js'
import { composePrompt } from '../prompt/compose.js'
import { buildStaticCore } from '../prompt/static-core.js'
import { buildSystemPrompt } from '../prompt-builder.js'
import { EXAMPLES, PREAMBLE, RULES, STATIC_SECTIONS } from '../prompt-builder-templates.js'

const emptyRetrieved: RetrievedSchema = {
  domains: [],
  cards: [],
  fragments: [],
  confidence: 0,
  catalog: [
    { domain: 'alpha', classLabels: ['Alpha Asset'], sampleTerms: ['speedLimit', 'country'] },
    { domain: 'beta', classLabels: ['Beta Asset'], sampleTerms: ['sensorType'] },
  ],
}

describe('buildStaticCore', () => {
  it('is byte-stable and matches the full-mode template order', () => {
    const core = buildStaticCore()
    expect(buildStaticCore()).toBe(core)
    expect(core).toBe([PREAMBLE, STATIC_SECTIONS, RULES, EXAMPLES].join('\n'))
  })

  it('mirrors full mode: both modes share one template source, same order', () => {
    const full = buildSystemPrompt([{ domain: 'alpha', content: '@prefix ex: <urn:x> .' }])
    // Full mode interleaves the SHACL dump between PREAMBLE and the static
    // sections; the relative order of the shared templates is identical.
    const order = [PREAMBLE, STATIC_SECTIONS, RULES, EXAMPLES].map((s) => full.indexOf(s))
    expect(order[0]).toBe(0)
    expect([...order]).toEqual([...order].sort((a, b) => a - b))
  })

  it('keeps the load-bearing agent markers', () => {
    expect(buildStaticCore()).toContain('submit_slots')
  })
})

describe('composePrompt', () => {
  it('starts with the exact static core — a stable, cacheable prefix', () => {
    const core = buildStaticCore()
    expect(composePrompt(core, emptyRetrieved).startsWith(core)).toBe(true)
  })

  it('renders fragments per domain with full-mode section markers', () => {
    const retrieved: RetrievedSchema = {
      ...emptyRetrieved,
      domains: ['alpha'],
      fragments: [
        {
          shapeIri: 'urn:x:AlphaShape',
          domain: 'alpha',
          turtle:
            '@prefix sh: <http://www.w3.org/ns/shacl#> .\n<urn:x:AlphaShape> a sh:NodeShape .',
        },
      ],
    }
    const prompt = composePrompt(buildStaticCore(), retrieved)

    expect(prompt).toContain('### Alpha domain')
    expect(prompt).toContain('```turtle')
    expect(prompt).toContain('<urn:x:AlphaShape> a sh:NodeShape .')
  })

  it('falls back to distilled cards when fragments are omitted', () => {
    const retrieved: RetrievedSchema = {
      ...emptyRetrieved,
      domains: ['alpha'],
      cards: [
        {
          kind: 'property',
          iri: 'urn:x:speedLimit',
          localName: 'speedLimit',
          domain: 'alpha',
          labels: ['speed limit'],
          datatype: 'http://www.w3.org/2001/XMLSchema#integer',
          allowedValues: ['30', '50'],
        },
      ],
    }
    const prompt = composePrompt(buildStaticCore(), retrieved)

    expect(prompt).toContain('### Alpha domain')
    expect(prompt).toContain('speedLimit : integer [30|50]')
    expect(prompt).not.toContain('```turtle')
  })

  it('always attaches the domain catalog for honest gap reporting', () => {
    const prompt = composePrompt(buildStaticCore(), emptyRetrieved)
    expect(prompt).toContain('## Domain Catalog')
    expect(prompt).toContain('- alpha (Alpha Asset) — e.g. speedLimit, country')
    expect(prompt).toContain('- beta (Beta Asset) — e.g. sensorType')
    expect(prompt).toContain('ontology gap')
  })
})

describe('buildRequestPrompt (integration)', () => {
  beforeAll(async () => {
    await getInitializedStore()
  }, 120_000)

  it('never interpolates the user query into the system prompt', async () => {
    const marker = 'XYZZY_MARKER_9314 unheard-of concept'
    const { prompt } = await buildRequestPrompt(marker)
    expect(prompt).not.toContain('XYZZY_MARKER_9314')
  })

  it('produces an order-of-magnitude smaller prompt than full mode for a single-domain query', async () => {
    const store = await getInitializedStore()
    const index = await buildTermIndex(store)
    const card = index.cards.find((c) => c.kind === 'property' && c.allowedValues)
    expect(card).toBeDefined()

    const { prompt, retrieved } = await buildRequestPrompt(
      `${card!.labels[0]} ${card!.allowedValues![0]}`
    )

    const core = buildStaticCore()
    expect(prompt.startsWith(core)).toBe(true)
    // Measured on the real 22-domain ontology: tail ≈ 20.7k chars (40 default
    // property fragments + full catalog), total ≈ 40k vs ~325k in full mode —
    // an 8× reduction. Thresholds carry headroom over the measurement so an
    // ontology edit doesn't flake the suite; the order-of-magnitude claim is
    // what's pinned.
    const tail = prompt.length - core.length
    expect(tail).toBeLessThan(30_000)
    expect(prompt.length).toBeLessThan(50_000)
    expect(retrieved.confidence).toBeGreaterThan(0)
    expect(retrieved.domains).toContain(card!.domain)
  })
})
