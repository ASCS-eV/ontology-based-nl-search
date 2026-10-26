/**
 * Regressions for a schema idiom the pipeline previously mishandled in three
 * places at once: SHARING. A property shape is identified by the shape that
 * declares it and its `sh:path` ([SHACL] §2.3), never by the local name of
 * that path, and a `sh:targetClass` may be declared by more than one shapes
 * graph. So one class can belong to several domains, and one predicate can be
 * the leaf of many unrelated chains — the normal shape of an ontology that
 * bundles modules into an umbrella module, or that wraps every value in a
 * value object (`code`, `value`, `unit`).
 *
 * Each test below asserts one consequence of that sharing being respected.
 * All three failed before, and all three failed SILENTLY: no error, just a
 * query that matched nothing or a term the LLM could not tell apart.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL] §2.3 property shapes, §2.1.3.2 sh:targetClass
 */
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import { describe, expect, it } from 'vitest'

import { buildDomainPatterns } from '../compiler-domain-patterns.js'
import type { CompilerVocab } from '../compiler-vocab.js'
import { emitPaths } from '../property-paths.js'
import type { PropertyPath } from '../property-paths-types.js'
import { cardIdentity } from '../schema-index/retrieval.js'
import type { TermCard } from '../schema-index/term-index.js'
import { propertyDescription } from '../schema-index/term-index.js'

const NS = 'http://example.org/scenario/v1/'
const SHARED = 'http://example.org/shared/v1/'

// ─── 1. Two domains that declare the SAME asset class ────────────────────────

describe('emitPaths — an asset class declared by several domains', () => {
  // Asset --environment--> Environment --precipitation--> CodedPrecipitation --code--> literal
  const forwardEdges = new Map([
    [`${NS}Scenario`, [{ predicate: `${NS}environment`, child: `${NS}Environment` }]],
    [`${NS}Environment`, [{ predicate: `${NS}precipitation`, child: `${NS}CodedPrecipitation` }]],
  ])
  const leaves = [
    { owningClass: `${NS}CodedPrecipitation`, propertyIri: `${SHARED}code`, leafKind: 'literal' },
  ] as const
  const ancestorsOf = (cls: string) => new Set([cls])

  it('attributes the paths to every declaring domain, not to one', () => {
    // An umbrella module re-declaring another module's shapes is the common
    // cause: `adontology` and `scenario` then both target the same class.
    const paths = emitPaths(
      [
        { domainName: 'umbrella', assetClass: `${NS}Scenario` },
        { domainName: 'scenario', assetClass: `${NS}Scenario` },
      ],
      [...leaves],
      forwardEdges,
      ancestorsOf
    )

    // Deriving the domain from the asset class IRI's namespace instead would
    // give BOTH rows the same single domain, leaving the other advertised as
    // searchable while resolving nothing.
    expect(paths.map((p) => p.domain).sort()).toEqual(['scenario', 'umbrella'])
    for (const path of paths) {
      expect(path.steps.map((s) => s.predicate)).toEqual([
        `${NS}environment`,
        `${NS}precipitation`,
        `${SHARED}code`,
      ])
    }
  })

  it('still attributes a class only one domain declares to that domain', () => {
    const paths = emitPaths(
      [{ domainName: 'scenario', assetClass: `${NS}Scenario` }],
      [...leaves],
      forwardEdges,
      ancestorsOf
    )
    expect(paths).toHaveLength(1)
    expect(paths[0]?.domain).toBe('scenario')
  })
})

// ─── 2. A leaf name that carries a shape group in ANOTHER domain ─────────────

describe('buildDomainPatterns — a property with a path but no shape group', () => {
  const path: PropertyPath = {
    domain: 'scenario',
    propertyName: 'code',
    propertyIri: `${SHARED}code`,
    assetClass: `${NS}Scenario`,
    owningClass: `${NS}CodedPrecipitation`,
    leafKind: 'literal',
    steps: [
      { predicate: `${NS}environment`, intermediate: `${NS}Environment` },
      { predicate: `${NS}precipitation`, intermediate: `${NS}CodedPrecipitation` },
      { predicate: `${SHARED}code` },
    ],
  }

  /**
   * `code` is a shape-group property name SOMEWHERE (another domain groups
   * it), but `scenario` declares no shape groups, so its classification is
   * null. That combination used to divert the entry to the prefix-convention
   * fallback, which walks nothing.
   */
  const vocab = {
    properties: new Map(),
    shapeGroups: new Map([['code:other', 'Content']]),
    shapeGroupPropertyNames: new Set(['code']),
    range2DProperties: new Map(),
    paths: new Map([['scenario:precipitation__code', path]]),
  } as unknown as CompilerVocab

  function compile(): string[] {
    const patterns: string[] = []
    buildDomainPatterns(
      'scenario',
      { prefix: 'scenario', namespace: NS } as never,
      { precipitation__code: 'moderate_rain' },
      {},
      patterns,
      [],
      [],
      new Set(),
      vocab,
      { domains: new Map() } as unknown as DomainRegistry,
      '?asset',
      '?spec'
    )
    return patterns
  }

  it('walks every intermediate hop of the discovered chain', () => {
    const patterns = compile()
    expect(patterns.some((p) => p.includes(`<${NS}environment>`))).toBe(true)
    expect(patterns.some((p) => p.includes(`<${NS}precipitation>`))).toBe(true)
    expect(patterns.some((p) => p.includes(`<${SHARED}code>`))).toBe(true)
  })

  it('never hangs the leaf predicate straight off the asset', () => {
    // The old fallback emitted `?asset scenario:code ?x`: structurally valid
    // SPARQL, zero rows, no diagnostic.
    for (const pattern of compile()) {
      if (pattern.includes(`<${SHARED}code>`)) expect(pattern.startsWith('?asset ')).toBe(false)
    }
  })
})

// ─── 3. A qualified key whose leaf description describes the wrapper ─────────

describe('propertyDescription — chains through one shared leaf predicate', () => {
  const chain = (hop: string): Pick<PropertyPath, 'propertyName' | 'steps'> => ({
    propertyName: 'code',
    steps: [
      { predicate: `${NS}environment`, intermediate: `${NS}Environment` },
      { predicate: `${NS}${hop}`, intermediate: `${NS}Coded` },
      { predicate: `${SHARED}code` },
    ],
  })
  const annotations = new Map([
    [`${SHARED}code`, { description: 'The categorical token of a coded value object.' }],
    [`${NS}precipitation`, { description: 'Precipitation type and intensity.' }],
    [`${NS}fog`, { description: 'Fog condition affecting visibility.' }],
  ])

  it('describes each qualified key by the hop it is named after', () => {
    // Before: every `*__code` key carried the leaf's wrapper boilerplate, so
    // dozens of distinct properties read identically to the LLM.
    const rain = propertyDescription('precipitation__code', chain('precipitation'), annotations)
    const fog = propertyDescription('fog__code', chain('fog'), annotations)
    expect(rain).toBe('Precipitation type and intensity.')
    expect(fog).toBe('Fog condition affecting visibility.')
    expect(rain).not.toBe(fog)
  })

  it('falls back to the leaf when no hop of the chain is described', () => {
    const undescribed = propertyDescription('other__code', chain('other'), annotations, 'from leaf')
    expect(undescribed).toBe('from leaf')
  })

  it('describes a key qualified by several hops by the hop that tells its chain apart', () => {
    // Two chains share their last two hops (`road_type → code`), so their
    // keys are qualified one hop further out (ADR 0009: the shortest suffix
    // no other chain shares). The shared hop's description reads the same
    // for both; only the outermost qualifying hop's can tell them apart.
    const deep = (container: string): Pick<PropertyPath, 'propertyName' | 'steps'> => ({
      propertyName: 'code',
      steps: [
        { predicate: `${NS}traffic_scenario`, intermediate: `${NS}TrafficScenario` },
        { predicate: `${NS}${container}`, intermediate: `${NS}Area` },
        { predicate: `${NS}road_type`, intermediate: `${NS}Coded` },
        { predicate: `${SHARED}code` },
      ],
    })
    const deepAnnotations = new Map([
      ...annotations,
      [`${NS}road_type`, { description: 'Type of the road.' }],
      [`${NS}road_network`, { description: 'The road network the scenario runs on.' }],
      [`${NS}urban_area`, { description: 'The urban area the scenario is set in.' }],
    ])
    const network = propertyDescription(
      'road_network__road_type__code',
      deep('road_network'),
      deepAnnotations
    )
    const urban = propertyDescription(
      'urban_area__road_type__code',
      deep('urban_area'),
      deepAnnotations
    )
    expect(network).toBe('The road network the scenario runs on.')
    expect(urban).toBe('The urban area the scenario is set in.')
  })

  it('falls inward to a described hop the key names when the outermost is not described', () => {
    const deep: Pick<PropertyPath, 'propertyName' | 'steps'> = {
      propertyName: 'code',
      steps: [
        { predicate: `${NS}traffic_scenario`, intermediate: `${NS}TrafficScenario` },
        { predicate: `${NS}undescribed`, intermediate: `${NS}Area` },
        { predicate: `${NS}road_type`, intermediate: `${NS}Coded` },
        { predicate: `${SHARED}code` },
      ],
    }
    const deepAnnotations = new Map([
      ...annotations,
      [`${NS}road_type`, { description: 'Type of the road.' }],
      [`${NS}traffic_scenario`, { description: 'NOT named by the key.' }],
    ])
    expect(propertyDescription('undescribed__road_type__code', deep, deepAnnotations)).toBe(
      'Type of the road.'
    )
  })

  it('keeps the leaf description for an unqualified key — the key IS the leaf', () => {
    const leafKey = propertyDescription('code', chain('precipitation'), annotations, 'from leaf')
    expect(leafKey).toBe('from leaf')
  })
})

// ─── 4. Many cards, one leaf IRI: selection must keep them all ───────────────

describe('cardIdentity — cards for different chains through one predicate', () => {
  const card = (localName: string, iri: string, domain = 'scenario'): TermCard => ({
    kind: 'property',
    iri,
    localName,
    domain,
    labels: [localName],
  })

  it('keeps one card per chain, not one per predicate', () => {
    // Every coded enum of the domain ends in the same `shared:code`
    // predicate. De-duplicating selection on the IRI let exactly ONE of them
    // reach the LLM; every other coded property was reported as a gap.
    const ids = [
      card('precipitation__code', `${SHARED}code`),
      card('fog__code', `${SHARED}code`),
      card('time_of_day__code', `${SHARED}code`),
    ].map(cardIdentity)
    expect(new Set(ids).size).toBe(3)
  })

  it('still collapses the very same card seen twice', () => {
    // Ranked matches and the per-domain padding pass both offer a card;
    // identity must stay stable so the budget is not spent on duplicates.
    const one = card('precipitation__code', `${SHARED}code`)
    expect(cardIdentity(one)).toBe(cardIdentity({ ...one }))
  })

  it('keeps two distinct predicates that share a local name apart', () => {
    const a = card('code', `${SHARED}code`)
    const b = card('code', `${NS}code`)
    expect(cardIdentity(a)).not.toBe(cardIdentity(b))
  })

  it('keeps the same chain in two domains apart', () => {
    const a = card('precipitation__code', `${SHARED}code`, 'scenario')
    const b = card('precipitation__code', `${SHARED}code`, 'driver')
    expect(cardIdentity(a)).not.toBe(cardIdentity(b))
  })
})

// ─── 5. Sibling chains in one shape group reach DIFFERENT nodes ──────────────

describe('buildDomainPatterns — a shape group reached by several predicates', () => {
  const coded = (hop: string, container = 'environment_conditions'): PropertyPath => ({
    domain: 'scenario',
    propertyName: 'code',
    propertyIri: `${SHARED}code`,
    assetClass: `${NS}Scenario`,
    owningClass: `${NS}Coded`,
    leafKind: 'literal',
    steps: [
      { predicate: `${NS}${container}`, intermediate: `${NS}${container}Node` },
      { predicate: `${NS}${hop}`, intermediate: `${NS}Coded` },
      { predicate: `${SHARED}code` },
    ],
  })

  /** A four-hop chain: "deep", and rooted at a DIFFERENT top-level container. */
  const deepCoded: PropertyPath = {
    domain: 'scenario',
    propertyName: 'code',
    propertyIri: `${SHARED}code`,
    assetClass: `${NS}Scenario`,
    owningClass: `${NS}Coded`,
    leafKind: 'literal',
    steps: [
      { predicate: `${NS}traffic_scenario`, intermediate: `${NS}TrafficScenario` },
      { predicate: `${NS}road_network`, intermediate: `${NS}RoadNetwork` },
      { predicate: `${NS}road_type`, intermediate: `${NS}Coded` },
      { predicate: `${SHARED}code` },
    ],
  }

  // `CodedValue` is a shape group here — but it is a CLASS of value object,
  // not a singleton: one asset reaches many of its instances.
  const vocab = {
    properties: new Map(),
    shapeGroups: new Map([['code:scenario', 'CodedValue']]),
    shapeGroupPropertyNames: new Set(['code']),
    range2DProperties: new Map(),
    paths: new Map<string, PropertyPath>([
      ['scenario:fog__code', coded('fog')],
      ['scenario:time_of_day__code', coded('time_of_day')],
      ['scenario:road_type__code', deepCoded],
    ]),
  } as unknown as CompilerVocab

  function compile(filters: Record<string, string>): string[] {
    const patterns: string[] = []
    buildDomainPatterns(
      'scenario',
      { prefix: 'scenario', namespace: NS } as never,
      filters,
      {},
      patterns,
      [],
      [],
      new Set(),
      vocab,
      { domains: new Map() } as unknown as DomainRegistry,
      '?asset',
      '?spec'
    )
    return patterns
  }

  /**
   * The object of the triple whose predicate is `localName`. The shape-group
   * emitter prefix-compresses a predicate in the domain's namespace while the
   * deep emitter writes the full IRI, so match either form.
   */
  const triplesVia = (patterns: string[], localName: string): string[] =>
    patterns.filter((p) =>
      new RegExp(`(^|\\s)(scenario:${localName}|<${NS}${localName}>)\\s`).test(p)
    )
  const objectOf = (patterns: string[], localName: string): string | undefined =>
    triplesVia(patterns, localName)[0]?.trim().split(/\s+/)[2]

  it('binds sibling chains of one group to separate nodes', () => {
    // Before: both leaves hung off ONE group variable, so the query demanded
    // a single node be `night` AND `dense` at once — never satisfiable.
    const patterns = compile({ fog__code: 'dense', time_of_day__code: 'night' })
    const fogNode = objectOf(patterns, 'fog')
    const todNode = objectOf(patterns, 'time_of_day')
    expect(fogNode).toBeDefined()
    expect(todNode).toBeDefined()
    expect(fogNode).not.toBe(todNode)
  })

  it('emits the group hop of every sibling chain, not just the first', () => {
    // Before: the bucket's group predicate was step 1 of whichever entry
    // sorted first, and the other chain's hop was dropped outright.
    const patterns = compile({ fog__code: 'dense', time_of_day__code: 'night' })
    expect(triplesVia(patterns, 'fog')).toHaveLength(1)
    expect(triplesVia(patterns, 'time_of_day')).toHaveLength(1)
  })

  it('gives each distinct first hop its own asset-rooted variable', () => {
    // A domain need not funnel everything through one specification node.
    // Before: the deep chain continued from a node bound by the OTHER
    // container's predicate, which can never match.
    const patterns = compile({ fog__code: 'dense', road_type__code: 'highway' })
    const envNode = objectOf(patterns, 'environment_conditions')
    const trafficNode = objectOf(patterns, 'traffic_scenario')
    expect(envNode).toBeDefined()
    expect(trafficNode).toBeDefined()
    expect(envNode).not.toBe(trafficNode)
    // The deep chain must continue from the container it is rooted at.
    expect(patterns).toContain(`${trafficNode} <${NS}road_network> ?_d0_1 .`)
  })

  it('still emits a single spec hop when every chain shares its first', () => {
    const patterns = compile({ fog__code: 'dense', time_of_day__code: 'night' })
    expect(triplesVia(patterns, 'environment_conditions')).toHaveLength(1)
  })
})

// ─── 6. A first hop belongs to the entries that continue from it ─────────────

describe('buildDomainPatterns — first hops of entries walked from the asset', () => {
  const coded = (container: string, hop: string): PropertyPath => ({
    domain: 'scenario',
    propertyName: 'code',
    propertyIri: `${SHARED}code`,
    assetClass: `${NS}Scenario`,
    owningClass: `${NS}Coded`,
    leafKind: 'literal',
    steps: [
      { predicate: `${NS}${container}`, intermediate: `${NS}${container}Node` },
      { predicate: `${NS}${hop}`, intermediate: `${NS}Coded` },
      { predicate: `${SHARED}code` },
    ],
  })
  const deepCoded: PropertyPath = {
    ...coded('traffic_scenario', 'road_type'),
    steps: [
      { predicate: `${NS}traffic_scenario`, intermediate: `${NS}TrafficScenario` },
      { predicate: `${NS}road_network`, intermediate: `${NS}RoadNetwork` },
      { predicate: `${NS}road_type`, intermediate: `${NS}Coded` },
      { predicate: `${SHARED}code` },
    ],
  }

  // `code` is a shape-group name in ANOTHER domain only: `scenario` has no
  // group, so its shallow `code` entry walks its own chain from the asset
  // while its deep entry needs a specification variable.
  const vocab = {
    properties: new Map(),
    shapeGroups: new Map([['code:other', 'Content']]),
    shapeGroupPropertyNames: new Set(['code']),
    range2DProperties: new Map(),
    paths: new Map<string, PropertyPath>([
      ['scenario:fog__code', coded('environment_conditions', 'fog')],
      ['scenario:road_type__code', deepCoded],
    ]),
  } as unknown as CompilerVocab

  function compile(filters: Record<string, string>): string[] {
    const patterns: string[] = []
    buildDomainPatterns(
      'scenario',
      { prefix: 'scenario', namespace: NS } as never,
      filters,
      {},
      patterns,
      [],
      [],
      new Set(),
      vocab,
      { domains: new Map() } as unknown as DomainRegistry,
      '?asset',
      '?spec'
    )
    return patterns
  }
  const triplesVia = (patterns: string[], localName: string): string[] =>
    patterns.filter((p) =>
      new RegExp(`(^|\\s)(scenario:${localName}|<${NS}${localName}>)\\s`).test(p)
    )

  it('emits the first hop of an entry walked from the asset exactly once', () => {
    // The asset-walked entry binds its own first hop; a specification
    // variable for the same hop would be a second, unused binding of it —
    // and the compiled SELECT is not DISTINCT, so a multi-valued hop would
    // multiply every row by its value count.
    const patterns = compile({ fog__code: 'dense', road_type__code: 'highway' })
    expect(triplesVia(patterns, 'environment_conditions')).toHaveLength(1)
    expect(triplesVia(patterns, 'traffic_scenario')).toHaveLength(1)
  })

  it('binds the specification variable to the hop a deep entry continues from', () => {
    const patterns = compile({ fog__code: 'dense', road_type__code: 'highway' })
    expect(patterns).toContain(`?asset scenario:traffic_scenario ?spec .`)
    expect(patterns).toContain(`?spec <${NS}road_network> ?_d0_1 .`)
  })
})
