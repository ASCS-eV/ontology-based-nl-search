/**
 * Prompt-composer tests: byte-stable static core, composed request
 * prompts, and the no-user-text-in-system-prompt guarantee.
 */
import type { RetrievedSchema } from '@ontology-search/search'
import {
  buildTermIndex,
  getInitializedStore,
  retrieveRelevantSchema,
} from '@ontology-search/search'
import { beforeAll, describe, expect, it } from 'vitest'

import { buildRequestPrompt } from '../agent/agent-context.js'
import { composePrompt, composeRetrievedSections, formatDomainHeader } from '../prompt/compose.js'
import { buildStaticCore } from '../prompt/static-core.js'
import { EXAMPLES, PREAMBLE, RULES, STATIC_SECTIONS } from '../prompt/templates.js'

const emptyRetrieved: RetrievedSchema = {
  domains: [],
  cards: [],
  fragments: [],
  confidence: 0,
  catalog: [
    {
      domain: 'alpha',
      classLabels: ['Alpha Asset'],
      sampleTerms: ['speedLimit', 'country'],
      propertyNames: ['speedLimit', 'country'],
    },
    {
      domain: 'beta',
      classLabels: ['Beta Asset'],
      sampleTerms: ['sensorType'],
      propertyNames: ['sensorType'],
    },
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

  /**
   * Regression: card selection is bounded, so a domain with more properties
   * than the budget shows only its top-ranked ones. Without naming the rest
   * the model cannot tell "absent from the ontology" from "crowded out of
   * this selection", and reports existing properties as ontology gaps. The
   * remainder rides as names only, so the fix is bounded by a few tokens per
   * property rather than by raising the card budget.
   */
  it('names a routed domain\u2019s remaining properties when the budget leaves them out', () => {
    const retrieved: RetrievedSchema = {
      ...emptyRetrieved,
      domains: ['alpha'],
      catalog: [
        {
          domain: 'alpha',
          classLabels: ['Alpha Asset'],
          sampleTerms: ['speedLimit'],
          propertyNames: ['speedLimit', 'country', 'surfaceType'],
        },
      ],
      cards: [
        {
          kind: 'property',
          iri: 'urn:x:speedLimit',
          localName: 'speedLimit',
          domain: 'alpha',
          labels: ['speed limit'],
        },
      ],
    }
    const prompt = composePrompt(buildStaticCore(), retrieved)

    expect(prompt).toContain('Also defined in this domain, not retrieved for this query:')
    expect(prompt).toContain('country, surfaceType')
    // The selected property is already shown in full; it is not repeated.
    expect(prompt).not.toMatch(/not retrieved for this query: [^\n]*speedLimit/)
  })

  it('omits the remainder line when the selection already covers the domain', () => {
    const retrieved: RetrievedSchema = {
      ...emptyRetrieved,
      domains: ['alpha'],
      catalog: [
        {
          domain: 'alpha',
          classLabels: ['Alpha Asset'],
          sampleTerms: ['speedLimit'],
          propertyNames: ['speedLimit'],
        },
      ],
      cards: [
        {
          kind: 'property',
          iri: 'urn:x:speedLimit',
          localName: 'speedLimit',
          domain: 'alpha',
          labels: ['speed limit'],
        },
      ],
    }
    expect(composePrompt(buildStaticCore(), retrieved)).not.toContain('Also defined in this domain')
  })

  it('does not name remaining properties of domains the query did not route to', () => {
    const retrieved: RetrievedSchema = {
      ...emptyRetrieved,
      domains: ['alpha'],
      catalog: [
        {
          domain: 'alpha',
          classLabels: ['Alpha Asset'],
          sampleTerms: [],
          propertyNames: ['speedLimit'],
        },
        {
          domain: 'beta',
          classLabels: ['Beta Asset'],
          sampleTerms: [],
          propertyNames: ['sensorType', 'manufacturer'],
        },
      ],
      cards: [
        {
          kind: 'property',
          iri: 'urn:x:speedLimit',
          localName: 'speedLimit',
          domain: 'alpha',
          labels: ['speed limit'],
        },
      ],
    }
    expect(composePrompt(buildStaticCore(), retrieved)).not.toContain('manufacturer')
  })

  /**
   * Regression: the roster is the only part of the tail that grows with the
   * ontology rather than with the budget, so an ontology an order of
   * magnitude larger could make the cheap annotation dwarf the payload it
   * annotates — and it is appended *after* retrieval has already spent its
   * character budget, so nothing upstream constrains it.
   *
   * The bound is relative, which is what makes it ontology-independent:
   * growing every domain tenfold must not grow the roster's share of the
   * tail at all. Truncation stays honest via the remainder marker.
   */
  it('bounds the roster to a share of the payload, for an ontology of any size', () => {
    const turtle = `<urn:x:AlphaShape> a sh:NodeShape ;\n  sh:description "${'x'.repeat(4000)}" .`
    const sized = (properties: number): RetrievedSchema => ({
      ...emptyRetrieved,
      domains: ['alpha', 'beta'],
      fragments: [{ shapeIri: 'urn:x:AlphaShape', domain: 'alpha', turtle, propertyIris: [] }],
      catalog: ['alpha', 'beta'].map((domain) => ({
        domain,
        classLabels: [`${domain} Asset`],
        sampleTerms: [],
        propertyNames: Array.from({ length: properties }, (_, i) => `${domain}Property${i}`),
      })),
    })

    const small = composeRetrievedSections(sized(20))
    const large = composeRetrievedSections(sized(20_000))

    // A small domain is still named in full, with no remainder to mark.
    expect(small).toContain('alphaProperty19')
    expect(small.match(REMAINDER_MARKER_ANYWHERE)).toBeNull()
    // A thousandfold ontology costs barely more prompt — unbounded, the
    // same rosters would add roughly half a million characters.
    expect(large.length).toBeLessThan(small.length * 2)
    // ...and the truncation says so, per domain, rather than going silent.
    expect(large.match(REMAINDER_MARKER_ANYWHERE)).toHaveLength(2)
    expect(large).toContain('alphaProperty0')
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
    // Every part of the tail is bounded by a budget rather than by the
    // ontology: raw fragments by the retrieval character budget (45k),
    // distilled cards by the card budget, rosters by their share of the
    // payload, the catalog by the domain count. BOUNDEDNESS is what is
    // pinned here; the thresholds carry headroom above this query's size.
    // (The fixed overhead above the fragment budget is not itself budgeted
    // — on the pinned OMB ontology the widest observed tail is ~60k, so
    // these numbers hold for this query, not for every query.)
    expect(tail.length).toBeLessThan(55_000)
    expect(prompt.length).toBeLessThan(75_000)
    expect(retrieved.confidence).toBeGreaterThan(0)
    expect(retrieved.domains).toContain(card!.domain)
  })

  /**
   * The property that makes the bounded card budget safe: however few of a
   * routed domain's properties fit as cards, every one of them is
   * *accounted for* in the prompt — named outright, or counted by the
   * roster's explicit remainder marker. Nothing is ever dropped silently,
   * so "unaccounted for in the prompt" means "absent from the ontology",
   * which is exactly what honest gap reporting requires — and it holds
   * without letting either payload grow unbounded with the ontology.
   */
  it('accounts for every property of every routed domain, however small the card budget', async () => {
    const store = await getInitializedStore()
    const retrieved = await retrieveRelevantSchema(store, 'scenarios with a cut-in manoeuvre', {
      maxCards: 5,
    })
    const tail = composeRetrievedSections(retrieved)
    expect(retrieved.domains.length).toBeGreaterThan(0)

    for (const domain of retrieved.domains) {
      const names = retrieved.catalog.find((entry) => entry.domain === domain)?.propertyNames ?? []
      expect(names.length, domain).toBeGreaterThan(0)
      const carded = new Set(
        retrieved.cards
          .filter((c) => c.domain === domain && c.kind === 'property')
          .map((c) => c.localName)
      )
      // The budget really does hide most of a domain this size...
      expect(carded.size, domain).toBeLessThan(names.length)

      // ...and the prompt accounts for all of them anyway. Counting the
      // rendered line rather than substring-searching the tail is what
      // makes this exact: a name may only be claimed once, and the
      // remainder marker must cover precisely what is not listed.
      const rosterLine = blockFor(tail, domain)
        .split('\n')
        .find((line) => line.startsWith(ROSTER_PREFIX))
      expect(rosterLine, domain).toBeDefined()
      const listed = rosterLine!
        .slice(ROSTER_PREFIX.length)
        .replace(REMAINDER_MARKER, '')
        .split(', ')
        .filter((name) => name.length > 0)
      const remainder = REMAINDER_MARKER.exec(rosterLine!)
      expect(listed.length, domain).toBeGreaterThan(0)
      expect(listed.length + Number(remainder?.[1] ?? 0), domain).toBe(
        new Set(names.filter((name) => !carded.has(name))).size
      )
    }
  }, 120_000)
})

const ROSTER_PREFIX = 'Also defined in this domain, not retrieved for this query: '
const REMAINDER_MARKER = /…\+(\d+) more$/
const REMAINDER_MARKER_ANYWHERE = /…\+\d+ more/g

/** The composed section belonging to one domain, headers excluded. */
function blockFor(tail: string, domain: string): string {
  const start = tail.indexOf(`### ${formatDomainHeader(domain)} domain`)
  expect(start, domain).toBeGreaterThanOrEqual(0)
  const rest = tail.slice(start)
  const end = Math.min(
    ...[rest.indexOf('\n### ', 1), rest.indexOf('\n## ', 1)]
      .filter((i) => i > 0)
      .concat(rest.length)
  )
  return rest.slice(0, end)
}
