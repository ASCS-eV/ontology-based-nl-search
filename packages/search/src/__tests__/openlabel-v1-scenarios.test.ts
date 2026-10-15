/**
 * Situation-driven search tests over the OpenLABEL V1-0-0 sample data.
 *
 * The queries are inspired by the functional-situation families of motorway
 * automated lane keeping (lane keeping, following, braking and cut-out
 * reveals, cut-in and merging, stationary and crossing targets, environment
 * disturbances, ODD boundaries, emergency behaviour). Each one is compiled by
 * the REAL compiler against the REAL store and compared with:
 *
 *   - hand-pinned expectations for the headline queries, and
 *   - an independent oracle that reads the committed JSON-LD files directly
 *     (plain JavaScript — no compiler, store or SPARQL involved).
 *
 * The sample data validates against the OpenLABEL V1-0-0 shapes
 * (`openlabel-sample-conformance.test.ts`), so a mismatch here is a compiler
 * defect, not a data defect.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { SearchSlots } from '@ontology-search/slots/slots'
import type { SparqlStore } from '@ontology-search/sparql/types'
import { beforeAll, describe, expect, it } from 'vitest'

import { compileSlotsWithTrace, resolveKnownDomains } from '../compiler.js'
import { getInitializedStore } from '../init.js'

const OL = 'https://openlabel.asam.net/V1-0-0/ontologies/'
const TAG_PREFIX = 'did:web:openlabel.example:Tag:'

// ── independent oracle ──────────────────────────────────────────────────────

type Node = Record<string, unknown>
type Asset = Node & { '@id': string; '@type': string | string[] }
const dataFile = (name: string): Asset[] =>
  JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', name), 'utf8'))['@graph']

/** ASAM OWL: MotorwayManaged and MotorwayUnmanaged are narrower than RoadTypeMotorway. */
const NARROWER: Record<string, string[]> = {
  RoadTypeMotorway: ['RoadTypeMotorway', 'MotorwayManaged', 'MotorwayUnmanaged'],
}

type Attributes = Map<string, unknown[]>

function collect(nodes: Node[]): Attributes {
  const attributes: Attributes = new Map()
  for (const node of nodes) {
    for (const [key, raw] of Object.entries(node)) {
      if (!key.startsWith('openlabel:')) continue
      const values = (Array.isArray(raw) ? raw : [raw]).map((v) =>
        v && typeof v === 'object' && '@id' in v
          ? String((v as Node)['@id']).slice('openlabel:'.length)
          : v
      )
      const name = key.slice('openlabel:'.length)
      attributes.set(name, [...(attributes.get(name) ?? []), ...values])
    }
  }
  return attributes
}

/** The OpenLABEL content nodes of an asset (`<domain>:hasDomainSpecification` → `hasContent`). */
function contentNodes(asset: Asset): Node[] {
  const specKey = Object.keys(asset).find((k) => k.endsWith(':hasDomainSpecification'))!
  const spec = asset[specKey] as Node
  const raw = spec[Object.keys(spec).find((k) => k.endsWith(':hasContent'))!]
  return (Array.isArray(raw) ? raw : [raw]).filter((n: Node) =>
    JSON.stringify(n['@type']).includes('openlabel:')
  )
}

type Filters = Record<string, string>

function satisfies(attributes: Attributes, filters: Filters): boolean {
  return Object.entries(filters).every(([name, want]) => {
    const have = attributes.get(name) ?? []
    if (want === 'true' || want === 'false') return have.includes(want === 'true')
    const wanted = want.slice(OL.length)
    return have.some((h) => (NARROWER[wanted] ?? [wanted]).includes(String(h)))
  })
}

interface Matches {
  tags: string[]
  hdmap: string[]
  scenario: string[]
}

/** Which tags / HD maps / scenarios carry every filter, computed from the raw JSON-LD. */
function oracle(filters: Filters): Matches {
  const tags = dataFile('sample-openlabel.jsonld')
    .filter((tag) =>
      satisfies(
        collect(
          ['openlabel:Odd', 'openlabel:Behaviour', 'openlabel:RoadUser']
            .map((k) => tag[k] as Node)
            .filter(Boolean)
        ),
        filters
      )
    )
    .map((tag) => tag['@id'])
  // Every data file the store loads; HD maps also appear in the scenario file.
  const byAsset = (type: string) =>
    ['sample-hdmap.jsonld', 'sample-scenarios.jsonld']
      .flatMap(dataFile)
      .filter((a) => a['@type'] === type && satisfies(collect(contentNodes(a)), filters))
      .map((a) => a['@id'])
  return {
    tags,
    hdmap: byAsset('hdmap:HdMap'),
    scenario: byAsset('scenario:Scenario'),
  }
}

// ── engine under test ───────────────────────────────────────────────────────

let store: SparqlStore

async function search(slots: SearchSlots): Promise<{ matches: Matches; sparql: string }> {
  const { sparql } = await compileSlotsWithTrace(slots)
  const { results } = await store.query(sparql)
  const ids = [
    ...new Set(results.bindings.map((b) => b['asset']?.value).filter(Boolean)),
  ] as string[]
  return {
    sparql,
    matches: {
      tags: ids.filter((id) => id.startsWith(TAG_PREFIX)),
      hdmap: ids.filter((id) => id.includes(':HdMap:')),
      scenario: ids.filter((id) => id.includes(':Scenario:')),
    },
  }
}

const slug = (id: string) => id.slice(TAG_PREFIX.length)
const slugs = (ids: string[]) => ids.map(slug).sort()
const ol = (name: string) => `${OL}${name}`

beforeAll(async () => {
  store = await getInitializedStore()
}, 180_000)

// ── situation queries ───────────────────────────────────────────────────────

/** name → [filters, tags expected from the standalone documents (hand-pinned)] */
const SITUATIONS: Record<string, [Filters, string[]]> = {
  'lane keeping on a straight managed motorway': [
    { DrivableAreaType: ol('MotorwayManaged'), HorizontalStraights: 'true', MotionDrive: 'true' },
    [
      'cut-in-car-steady-speed',
      'following-passenger-car',
      'lane-keeping-straight-motorway',
      'lead-vehicle-moderate-braking',
      'strong-crosswind-on-straight',
    ],
  ],
  'lane keeping through a curve': [
    { DrivableAreaType: ol('RoadTypeMotorway'), HorizontalCurves: 'true' },
    ['lane-keeping-motorway-curve'],
  ],
  'following a powered two-wheeler': [
    { RoadUserVehicle: ol('VehicleMotorcycle'), MotionDrive: 'true' },
    ['following-two-wheeler'],
  ],
  'cut-out reveals a stationary road user': [
    { MotionCutOut: 'true', MotionStop: 'true' },
    [
      'cut-out-reveals-blocked-lane',
      'cut-out-reveals-stationary-car',
      'cut-out-reveals-stationary-two-wheeler',
    ],
  ],
  'two-wheeler cuts in': [
    { MotionCutIn: 'true', RoadUserVehicle: ol('VehicleMotorcycle') },
    ['cut-in-two-wheeler'],
  ],
  'harsh cut-in while decelerating': [
    { MotionCutIn: 'true', MotionDecelerate: 'true' },
    ['cut-in-while-braking', 'harsh-cut-in-short-gap'],
  ],
  'vehicle merges from an entry lane': [
    { DrivableAreaType: ol('RoadTypeSlip'), MotionLaneChangeLeft: 'true' },
    ['merge-from-entry-lane'],
  ],
  'pedestrian crosses the carriageway': [
    { MotionCross: 'true', RoadUserHuman: ol('HumanPedestrian') },
    ['pedestrian-crossing-the-carriageway', 'urban-pedestrian-crossing'],
  ],
  'lane markings unavailable (flag set to false)': [
    { LaneSpecificationMarking: 'false' },
    ['faded-lane-markings'],
  ],
  'icy low-friction surface on a motorway': [
    {
      DrivableAreaSurfaceCondition: ol('SurfaceConditionIcy'),
      DrivableAreaType: ol('RoadTypeMotorway'),
    },
    ['icy-low-friction-surface'],
  ],
  'strong crosswind on a straight': [
    { WeatherWind: 'true', HorizontalStraights: 'true' },
    ['strong-crosswind-on-straight'],
  ],
  'approach to a tunnel': [
    { ScenerySpecialStructure: ol('SpecialStructureTunnel') },
    ['approach-motorway-end-tunnel'],
  ],
  roadworks: [
    { SceneryTemporaryStructure: ol('TemporaryStructureRoadWorks') },
    ['cut-out-reveals-blocked-lane', 'unplanned-roadworks-detour'],
  ],
  'emergency braking ends at standstill with hazard warning': [
    { BehaviourCommunication: ol('CommunicationSignalHazard'), MotionStop: 'true' },
    ['emergency-braking-to-standstill'],
  ],
  'emergency vehicle approaches from behind': [
    {
      RoadUserVehicle: ol('VehicleEmergency'),
      BehaviourCommunication: ol('CommunicationSignalEmergency'),
    },
    ['emergency-vehicle-from-behind'],
  ],
}

describe('standalone OpenLABEL tags — one situation family per query', () => {
  for (const [name, [filters, expected]] of Object.entries(SITUATIONS)) {
    it(`${name}`, async () => {
      const { matches } = await search({ domains: ['openlabel'], filters, ranges: {} })
      expect(slugs(matches.tags)).toEqual(expected)
      // hand-pinned expectation and independent oracle agree
      expect(slugs(oracle(filters).tags)).toEqual(expected)
    })
  }

  it('the motorway query does not return the non-motorway contrast situations', async () => {
    const { matches } = await search({
      domains: ['openlabel'],
      filters: { DrivableAreaType: ol('RoadTypeMotorway') },
      ranges: {},
    })
    expect(slugs(matches.tags)).toHaveLength(38)
    for (const contrast of [
      'urban-roundabout-approach',
      'rural-bend-wet-road',
      'school-zone-cyclist',
    ]) {
      expect(slugs(matches.tags)).not.toContain(contrast)
    }
  })
})

describe('"OpenLABEL only" — vocabulary scope over every asset domain that can answer', () => {
  for (const [name, [filters]] of Object.entries(SITUATIONS)) {
    it(`${name}`, async () => {
      const domains = await resolveKnownDomains(['openlabel'], ['openlabel'], Object.keys(filters))
      const { matches } = await search({ domains, filters, ranges: {} })
      const expected = oracle(filters)
      expect(slugs(matches.tags)).toEqual(slugs(expected.tags))
      expect(matches.hdmap.sort()).toEqual(expected.hdmap.sort())
      expect(matches.scenario.sort()).toEqual(expected.scenario.sort())
    })
  }

  it('excludes asset domains that cannot express every restriction of the vocabulary', async () => {
    // an HD map carries scenery attributes but never a behaviour flag
    const sceneryOnly = await resolveKnownDomains(
      ['openlabel'],
      ['openlabel'],
      ['DrivableAreaType']
    )
    const withBehaviour = await resolveKnownDomains(
      ['openlabel'],
      ['openlabel'],
      ['DrivableAreaType', 'MotionDrive']
    )
    expect(sceneryOnly).toContain('hdmap')
    expect(withBehaviour).not.toContain('hdmap')
    expect(withBehaviour).toContain('scenario')
    expect(withBehaviour).toContain('openlabel')
  })

  it('answers scenery from HD maps and behaviour from scenarios (category-pure embedding)', async () => {
    const scenery = await search({
      domains: ['hdmap', 'scenario'],
      filters: { DrivableAreaType: ol('MotorwayManaged'), HorizontalStraights: 'true' },
      ranges: {},
    })
    expect(scenery.matches.hdmap.length).toBeGreaterThan(0)
    expect(scenery.matches.scenario).toEqual([]) // scenarios carry no scenery of their own
    const behaviour = await search({
      domains: ['scenario'],
      filters: { MotionCutIn: 'true', RoadUserVehicle: ol('VehicleMotorcycle') },
      ranges: {},
    })
    expect(behaviour.matches.scenario.sort()).toEqual(
      oracle({ MotionCutIn: 'true', RoadUserVehicle: ol('VehicleMotorcycle') }).scenario.sort()
    )
    expect(behaviour.matches.scenario.length).toBeGreaterThan(0)
  })
})

describe('restrictions are never silently dropped', () => {
  it('a restriction a standalone document cannot express removes the arm', async () => {
    const { matches, sparql } = await search({
      domains: ['openlabel'],
      filters: { DrivableAreaType: ol('RoadTypeMotorway'), country: 'de' },
      ranges: {},
    })
    expect(matches.tags).toEqual([])
    // no arm can answer → an explicit empty result, not an empty group (one unbound row)
    expect(sparql).toContain('FILTER(false)')
    const { results } = await store.query(sparql)
    expect(results.bindings).toEqual([])
  })

  it('without the unsatisfiable restriction the same query finds the motorway tags', async () => {
    const { matches } = await search({
      domains: ['openlabel'],
      filters: { DrivableAreaType: ol('RoadTypeMotorway') },
      ranges: {},
    })
    expect(matches.tags.length).toBeGreaterThan(0)
  })
})

describe('numeric ranges on OpenLABEL value properties', () => {
  const tagsFor = async (ranges: SearchSlots['ranges']) =>
    slugs((await search({ domains: ['openlabel'], filters: {}, ranges })).matches.tags)

  it('decimal-only value properties (xsd:decimal)', async () => {
    expect(await tagsFor({ horizontalCurvesValue: { max: 500 } })).toEqual(['rural-bend-wet-road'])
    expect(await tagsFor({ weatherRainValue: { min: 10 } })).toEqual(['heavy-rain-low-visibility'])
  })

  it('integer-only value properties (xsd:integer)', async () => {
    expect(await tagsFor({ trafficVolumeValue: { min: 1000 } })).toEqual(['stop-and-go-congestion'])
  })

  it('a value property declared as scalar-OR-range (sh:or) matches its scalar values', async () => {
    // v1 declares speed, lane count, dimensions, accelerate, decelerate and
    // drive as `sh:or ( decimal|integer  schema:QuantitativeValue )`. The
    // member with `sh:datatype` makes the property a literal leaf
    // ([SHACL] §4.6.3), so the range compares the scalar values (110, 100).
    // The tags recording a `schema:QuantitativeValue` range node (90–120,
    // 60–120) are not matched: see the todo below.
    expect(await tagsFor({ subjectVehicleSpeedValue: { min: 100 } })).toEqual([
      'lane-keeping-straight-motorway',
      'speed-limit-change',
    ])
  })

  it.todo('ranges on sh:or value properties also match schema:QuantitativeValue range nodes')
})
