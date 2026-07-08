/**
 * Prompt-composer tests: byte-stable static core, composed request
 * prompts, and the no-user-text-in-system-prompt guarantee.
 */
import type { RetrievedSchema } from '@ontology-search/search'
import { buildTermIndex, getInitializedStore } from '@ontology-search/search'
import { beforeAll, describe, expect, it } from 'vitest'

import { buildRequestPrompt } from '../agent/agent-context.js'
import { composePrompt, composeRetrievedSections } from '../prompt/compose.js'
import { buildStaticCore } from '../prompt/static-core.js'
import { EXAMPLES, PREAMBLE, RULES, STATIC_SECTIONS } from '../prompt/templates.js'

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
  it('is byte-stable and concatenates the template sections in order', () => {
    const core = buildStaticCore()
    expect(buildStaticCore()).toBe(core)
    expect(core).toBe([PREAMBLE, STATIC_SECTIONS, RULES, EXAMPLES].join('\n'))
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

  it('equals core + tail, so session-baked cores and composed prompts cannot drift', () => {
    const core = buildStaticCore()
    const tail = composeRetrievedSections(emptyRetrieved)
    expect(composePrompt(core, emptyRetrieved)).toBe(`${core}\n${tail}`)
  })

  it('renders fragments per domain under fenced turtle section markers', () => {
    const retrieved: RetrievedSchema = {
      ...emptyRetrieved,
      domains: ['alpha'],
      fragments: [
        {
          shapeIri: 'urn:x:AlphaShape',
          domain: 'alpha',
          turtle:
            '@prefix sh: <http://www.w3.org/ns/shacl#> .\n<urn:x:AlphaShape> a sh:NodeShape .',
          propertyIris: [],
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

  it('renders uncovered selected properties as condensed lines beside the fragments', () => {
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
          allowedValues: ['30', '50'],
        },
        {
          kind: 'property',
          iri: 'urn:x:width',
          localName: 'width',
          domain: 'alpha',
          labels: ['width'],
        },
      ],
      fragments: [
        {
          shapeIri: 'urn:x:AlphaShape',
          domain: 'alpha',
          turtle: '<urn:x:AlphaShape> a sh:NodeShape .',
          propertyIris: ['urn:x:speedLimit'],
        },
      ],
    }
    const prompt = composePrompt(buildStaticCore(), retrieved)

    // Fragment-covered property: raw Turtle only.
    expect(prompt).toContain('<urn:x:AlphaShape> a sh:NodeShape .')
    // Budget-overflow property: condensed line under the same domain header.
    expect(prompt).toContain('Further properties of this domain (condensed):')
    expect(prompt).toContain('width')
    expect(prompt.match(/### Alpha domain/g)).toHaveLength(1)
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

  it('produces a bounded prompt whose tail is proportional to the query', async () => {
    const store = await getInitializedStore()
    const index = await buildTermIndex(store)
    const card = index.cards.find((c) => c.kind === 'property' && c.allowedValues)
    expect(card).toBeDefined()

    const { prompt, tail, retrieved } = await buildRequestPrompt(
      `${card!.labels[0]} ${card!.allowedValues![0]}`
    )

    const core = buildStaticCore()
    expect(prompt.startsWith(core)).toBe(true)
    // The context budget bounds the raw-fragment payload (default 45k
    // chars); overflow properties ride as condensed lines. With the pinned
    // OMB ontology the worst observed unbounded payload was ~57k — the
    // budget plus catalog/headers keeps every tail under ~52k regardless
    // of how upstream shapes grow. Thresholds carry headroom; BOUNDEDNESS
    // is what's pinned.
    expect(tail.length).toBeLessThan(55_000)
    expect(prompt.length).toBeLessThan(75_000)
    expect(retrieved.confidence).toBeGreaterThan(0)
    expect(retrieved.domains).toContain(card!.domain)
  })
})
