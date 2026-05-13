/**
 * Comprehensive search test harness — 1000+ AV engineer queries with domain assertions.
 *
 * Usage:
 *   node scripts/test-1000-queries.mjs
 *   node scripts/test-1000-queries.mjs --limit 50
 *   node scripts/test-1000-queries.mjs --category hdmap-road
 *   node scripts/test-1000-queries.mjs --verbose
 */

const API = 'http://localhost:3003'
const REQUEST_TIMEOUT_MS = 180_000
const CONCURRENCY = 1
const ASSET_DOMAINS = ['hdmap', 'scenario', 'ositrace', 'environment-model', 'surface-model']
const KNOWN_PREFIXES = new Set([...ASSET_DOMAINS, 'manifest', 'georeference', 'rdfs', 'xsd', 'gx'])

const expectDomain = (domain) => ({ domain })
const expectOneOf = (...domainOneOf) => ({ domainOneOf })

const wrap = (bases, templates) =>
  bases.flatMap((base) => templates.map((template) => template(base))).map((q) => q.trim())

const makeCategory = (category, expect, bases, templates) =>
  wrap(bases, templates).map((q) => ({ c: category, q, expect: { ...expect } }))

const dedupeQueries = (queries) => {
  const seen = new Set()
  return queries.filter((query) => {
    const key = `${query.c}|${query.q.trim().toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const phraseTemplates = [
  (base) => `${base}`,
  (base) => `show me ${base}`,
  (base) => `find ${base}`,
  (base) => `I need ${base} for AV validation`,
  (base) => `looking for ${base}`,
]

const assetTemplates = [
  (base) => `${base}`,
  (base) => `show me ${base}`,
  (base) => `find ${base}`,
  (base) => `I need ${base}`,
]

const conversationalTemplates = [
  (base) => `I need ${base}`,
  (base) => `Show me ${base}`,
  (base) => `Can you find ${base}?`,
  (base) => `I'm looking for ${base}`,
]

const hdmapRoadBases = [
  'motorway HD maps',
  'highway HD maps',
  'Autobahn maps',
  'freeway HD maps',
  'rural road maps',
  'country road HD maps',
  'town street maps',
  'urban intersection maps',
  'pedestrian zone maps',
  'bicycle path HD maps',
  'maps with roundabouts',
  'residential street maps',
  'maps showing parking areas',
  'maps with on-ramps',
  'maps with off-ramps',
  'multi-lane highway maps',
  'single carriageway maps',
  'construction zone maps',
  'school zone HD maps',
  'industrial area maps',
  'maps with bus lanes',
  'maps with walking lanes',
  'maps with shoulder lanes',
  'maps with emergency lanes',
]

const hdmapFormatBases = [
  'OpenDRIVE maps',
  'ASAM OpenDRIVE HD maps',
  'Lanelet2 HD maps',
  'NDS.Live maps',
  'HERE HD Live Map assets',
  'Road5 format maps',
  'Shape file maps',
  'xodr map datasets',
]

const hdmapGeoBases = [
  'HD maps from Germany',
  'maps from Munich',
  'maps from Berlin',
  'US highway maps',
  'maps from California',
  'Japanese road maps',
  'maps from Tokyo',
  'French HD maps',
  'maps from Paris',
  'London road maps',
  'Chinese HD maps',
  'maps from Seoul',
  'Amsterdam HD maps',
  'Swiss road maps',
  'maps from Zurich',
  'Australian maps from Melbourne',
  'Singapore road data',
  'Nordic maps from Stockholm',
]

const hdmapCombinedBases = [
  'German motorway maps in ASAM OpenDRIVE format',
  'urban maps with bus lanes in Tokyo',
  'rural road maps from France with lidar data',
  'Munich highway maps longer than 10 km',
  'maps with parking areas in California',
  'left-hand traffic maps from London',
  'German rural maps with traffic lights',
  'Berlin town maps with crosswalk detail',
  'Japanese motorway_entry maps in Lanelet2',
  'Swiss urban maps with elevation range',
  'Singapore town maps with camera data',
  'Austrian rural road maps with survey data',
  'Dutch maps with biking lanes and parking',
  'Seoul town maps with many traffic signs',
  'Italian motorway maps in Road5 format',
  'US urban maps with emergency lanes',
  'Frankfurt maps with lane-level detail',
  'Stockholm maps with roundabouts and bus lanes',
]

const hdmapQualityBases = [
  'maps with many intersections',
  'maps with many traffic lights',
  'high precision HD maps',
  'maps longer than 50 kilometers',
  'large scale road maps',
  'maps with high speed limits',
  'maps with lots of traffic signs',
  'maps with wide elevation range',
  'lane-level detail HD maps',
  'crosswalk and curb detail maps',
]

const hdmapSourceBases = [
  'lidar-based maps',
  'camera-derived HD maps',
  'scanner-based road maps',
  'aerial survey maps',
  'satellite-derived HD maps',
  'procedurally generated maps',
  'survey-based maps',
  'mobile mapping system road maps',
]

const scenarioCategoryBases = [
  'cut-in scenarios',
  'lane change scenarios',
  'intersection crossing scenarios',
  'following scenarios',
  'overtaking scenarios',
  'pedestrian crossing scenarios',
  'emergency braking scenarios',
  'free driving scenarios',
  'turning scenarios',
  'parking scenarios',
  'merging scenarios',
]

const scenarioCategoryTemplates = [
  (base) => `${base}`,
  (base) => `show me ${base}`,
  (base) => `find ${base} for validation`,
  (base) => `I need ${base} for ADAS testing`,
  (base) => `ASAM OpenSCENARIO ${base}`,
  (base) => `functional ${base}`,
  (base) => `concrete ${base}`,
  (base) => `${base} for regression testing`,
]

const scenarioWeatherBases = [
  'rain scenarios',
  'foggy driving scenarios',
  'snow scenarios',
  'night driving scenarios',
  'clear weather scenarios',
  'windy weather scenarios',
  'mixed weather scenarios',
  'adverse weather scenarios',
  'reduced visibility scenarios',
  'icy road condition scenarios',
]

const scenarioWeatherTemplates = [
  (base) => `${base}`,
  (base) => `show me ${base}`,
  (base) => `find ${base} for validation`,
  (base) => `I need ${base} for AV testing`,
  (base) => `scenario assets with ${base.replace(/ scenarios$/, '')}`,
  (base) => `ASAM OpenSCENARIO data for ${base.replace(/ scenarios$/, '')}`,
  (base) => `logical ${base}`,
]

const scenarioEntityBases = [
  'pedestrians',
  'car following',
  'trucks',
  'bicycles',
  'buses',
  'motorbikes',
  'vans',
  'multi-vehicle interactions',
  'vulnerable road users',
  'mixed traffic actors',
]

const scenarioEntityTemplates = [
  (base) => `scenarios with ${base}`,
  (base) => `show me ${base} scenarios`,
  (base) => `find test scenarios involving ${base}`,
  (base) => `I need ${base} scenario assets`,
  (base) => `OpenSCENARIO cases with ${base}`,
  (base) => `${base} interaction scenarios`,
]

const scenarioCombinedBases = [
  'rainy pedestrian crossing scenarios in Munich',
  'nighttime highway merging scenarios',
  'foggy intersection scenarios in Tokyo',
  'concrete cut-in scenarios from Germany',
  'ASAM OpenSCENARIO lane change scenarios',
  'snow emergency braking scenarios in Stuttgart',
  'windy overtaking scenarios on French rural roads',
  'clear weather parking scenarios in Amsterdam',
  'night bus interaction scenarios in London',
  'pedestrian crossing scenarios in Berlin rain',
  'free driving scenarios in Seoul with mixed traffic',
  'turning scenarios in Paris at night',
]

const osiTraceBases = [
  'OSI traces',
  'ground truth traces',
  'sensor view data',
  'sensor data recordings',
  'motorway OSI traces',
  'urban OSI traces',
  'ASAM OSI GroundTruth traces',
  'object list traces',
  'detection list OSI data',
  'motorway sensor recordings',
  'OSI trace data from Germany',
  'highway OSI recordings',
  'zstd compressed OSI traces',
  'ASAM OSI SensorView data from Japan',
  'town road object list traces',
  'uncompressed detection list traces',
]

const environmentModelBases = [
  '3D environment models',
  'FBX environment models',
  'glTF scene models',
  'Unreal Datasmith environments',
  'OpenSceneGraph models',
  'high detail environment models',
  'low detail 3D models',
  'environment models for sensor simulation',
  'lidar simulation environments',
  'camera simulation 3D models',
  'digital twin models',
  '3D urban environments',
  'terrain and traffic sign environment models',
  'road corridor environment models',
]

const surfaceModelBases = [
  'road surface models',
  'ASAM OpenCRG data',
  'DLM surface models',
  'road surface profiles',
  'friction maps',
  'road roughness data',
  'surface elevation models',
  'tire-road contact data',
  'pavement models',
  'roughness profile datasets',
  'elevation model road surfaces',
  'surface friction maps for AV testing',
  'OpenCRG road profile assets',
  'road surface simulation data',
]

const ambiguousBases = [
  { q: 'simulation assets in Germany', expect: expectOneOf(...ASSET_DOMAINS) },
  { q: 'all driving data for Munich', expect: expectOneOf(...ASSET_DOMAINS) },
  { q: 'motorway simulation data', expect: expectOneOf('hdmap', 'ositrace', 'scenario') },
  { q: 'Autobahn data', expect: expectOneOf('hdmap', 'ositrace') },
  { q: 'all assets from Japan', expect: expectOneOf(...ASSET_DOMAINS) },
  { q: 'German driving data', expect: expectOneOf('hdmap', 'scenario', 'ositrace') },
  { q: 'everything about highways', expect: expectOneOf('hdmap', 'scenario', 'ositrace') },
  {
    q: 'road simulation resources',
    expect: expectOneOf('hdmap', 'scenario', 'ositrace', 'environment-model', 'surface-model'),
  },
  {
    q: 'urban driving assets',
    expect: expectOneOf('hdmap', 'scenario', 'ositrace', 'environment-model'),
  },
  { q: 'sensor simulation data', expect: expectOneOf('environment-model', 'ositrace', 'scenario') },
  { q: 'test assets for Berlin', expect: expectOneOf(...ASSET_DOMAINS) },
  { q: 'map or trace data for California', expect: expectOneOf('hdmap', 'ositrace') },
  {
    q: 'open format driving assets',
    expect: expectOneOf('hdmap', 'scenario', 'ositrace', 'surface-model'),
  },
  {
    q: 'simulation resources for rainy roads',
    expect: expectOneOf('scenario', 'environment-model', 'surface-model'),
  },
  {
    q: 'AV validation assets for intersections',
    expect: expectOneOf('hdmap', 'scenario', 'ositrace', 'environment-model'),
  },
  { q: 'road geometry data', expect: expectOneOf('hdmap', 'surface-model', 'environment-model') },
  { q: 'highway recordings', expect: expectOneOf('ositrace', 'scenario', 'hdmap') },
  { q: 'Japan simulation catalog', expect: expectOneOf(...ASSET_DOMAINS) },
  { q: 'vehicle dynamics road data', expect: expectOneOf('surface-model', 'hdmap', 'scenario') },
  { q: 'road network and traces', expect: expectOneOf('hdmap', 'ositrace') },
  {
    q: 'city simulation resources',
    expect: expectOneOf('hdmap', 'scenario', 'environment-model', 'ositrace'),
  },
]

const naturalLanguageBases = [
  { q: 'HD maps for German motorways', expect: expectDomain('hdmap') },
  { q: 'rain scenarios', expect: expectDomain('scenario') },
  { q: 'OSI traces from Berlin', expect: expectDomain('ositrace') },
  { q: 'maps with lots of intersections', expect: expectDomain('hdmap') },
  { q: 'environment models in glTF', expect: expectDomain('environment-model') },
  { q: 'surface models', expect: expectDomain('surface-model') },
  { q: 'scenarios in Munich', expect: expectDomain('scenario') },
  { q: 'OpenDRIVE maps from Germany', expect: expectDomain('hdmap') },
  { q: 'pedestrian crossing scenarios', expect: expectDomain('scenario') },
  { q: 'motorway sensor recordings', expect: expectDomain('ositrace') },
  { q: 'FBX environment models', expect: expectDomain('environment-model') },
  { q: 'OpenCRG road profiles', expect: expectDomain('surface-model') },
  { q: 'lane change scenarios at night', expect: expectDomain('scenario') },
  { q: 'maps built from lidar', expect: expectDomain('hdmap') },
  { q: 'surface friction maps', expect: expectDomain('surface-model') },
  {
    q: 'urban environment models for camera simulation',
    expect: expectDomain('environment-model'),
  },
  { q: 'cut-in scenarios from Germany', expect: expectDomain('scenario') },
  { q: 'HD maps for Tokyo', expect: expectDomain('hdmap') },
  { q: 'OSI object list traces', expect: expectDomain('ositrace') },
  { q: 'parking scenarios', expect: expectDomain('scenario') },
  { q: 'high detail environment models', expect: expectDomain('environment-model') },
  { q: 'OpenSCENARIO scenarios', expect: expectDomain('scenario') },
  { q: 'German road surface models', expect: expectDomain('surface-model') },
  { q: 'sensor view traces from Japan', expect: expectDomain('ositrace') },
]

const edgeShortQueries = [
  { c: 'edge-short', q: 'maps', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'scenarios', expect: expectDomain('scenario') },
  { c: 'edge-short', q: 'traces', expect: expectDomain('ositrace') },
  { c: 'edge-short', q: 'Germany', expect: expectOneOf(...ASSET_DOMAINS) },
  { c: 'edge-short', q: 'motorway', expect: expectOneOf('hdmap', 'ositrace', 'scenario') },
  { c: 'edge-short', q: 'rain', expect: expectDomain('scenario') },
  { c: 'edge-short', q: 'night', expect: expectDomain('scenario') },
  { c: 'edge-short', q: 'OpenDRIVE', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'Berlin', expect: expectOneOf(...ASSET_DOMAINS) },
  { c: 'edge-short', q: 'FBX', expect: expectDomain('environment-model') },
  { c: 'edge-short', q: 'OpenCRG', expect: expectDomain('surface-model') },
  { c: 'edge-short', q: 'all', expect: expectOneOf(...ASSET_DOMAINS) },
  { c: 'edge-short', q: 'everything', expect: expectOneOf(...ASSET_DOMAINS) },
  { c: 'edge-short', q: 'glTF', expect: expectDomain('environment-model') },
  { c: 'edge-short', q: 'SensorView', expect: expectDomain('ositrace') },
  { c: 'edge-short', q: 'Lanelet2', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'Munich', expect: expectOneOf(...ASSET_DOMAINS) },
  { c: 'edge-short', q: 'parking', expect: expectDomain('scenario') },
  { c: 'edge-short', q: 'friction', expect: expectDomain('surface-model') },
  { c: 'edge-short', q: 'lidar', expect: expectOneOf('hdmap', 'environment-model', 'ositrace') },
  { c: 'edge-short', q: 'cut-in', expect: expectDomain('scenario') },
  { c: 'edge-short', q: 'motorway_entry', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'object list', expect: expectDomain('ositrace') },
  { c: 'edge-short', q: 'detection list', expect: expectDomain('ositrace') },
  { c: 'edge-short', q: 'roughness', expect: expectDomain('surface-model') },
  { c: 'edge-short', q: 'DLM', expect: expectDomain('surface-model') },
  { c: 'edge-short', q: 'NDS.Live', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'HERE map', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'Tokyo', expect: expectOneOf(...ASSET_DOMAINS) },
  { c: 'edge-short', q: 'Seoul', expect: expectOneOf(...ASSET_DOMAINS) },
  { c: 'edge-short', q: 'pedestrian', expect: expectDomain('scenario') },
  { c: 'edge-short', q: 'bus lane', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'road profile', expect: expectDomain('surface-model') },
  { c: 'edge-short', q: 'digital twin', expect: expectDomain('environment-model') },
  { c: 'edge-short', q: 'ground truth', expect: expectDomain('ositrace') },
  { c: 'edge-short', q: 'OpenSCENARIO', expect: expectDomain('scenario') },
  { c: 'edge-short', q: 'OpenSceneGraph', expect: expectDomain('environment-model') },
  { c: 'edge-short', q: 'xodr', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'sensor simulation', expect: expectDomain('environment-model') },
  { c: 'edge-short', q: 'ASAM OSI', expect: expectDomain('ositrace') },
  { c: 'edge-short', q: 'town', expect: expectOneOf('hdmap', 'ositrace') },
  { c: 'edge-short', q: 'rural', expect: expectOneOf('hdmap', 'ositrace') },
  { c: 'edge-short', q: 'motorway map', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'map data', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'scenario data', expect: expectDomain('scenario') },
  { c: 'edge-short', q: 'trace data', expect: expectDomain('ositrace') },
  { c: 'edge-short', q: 'urban model', expect: expectDomain('environment-model') },
  { c: 'edge-short', q: 'road surface', expect: expectDomain('surface-model') },
  { c: 'edge-short', q: 'German maps', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'Japanese scenarios', expect: expectDomain('scenario') },
  { c: 'edge-short', q: 'UK left-hand maps', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'zstd traces', expect: expectDomain('ositrace') },
  { c: 'edge-short', q: 'camera simulation', expect: expectDomain('environment-model') },
  { c: 'edge-short', q: 'elevation model', expect: expectDomain('surface-model') },
  { c: 'edge-short', q: 'mobile mapping', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'bus scenarios', expect: expectDomain('scenario') },
  { c: 'edge-short', q: 'Amsterdam maps', expect: expectDomain('hdmap') },
  { c: 'edge-short', q: 'Zurich models', expect: expectDomain('environment-model') },
  { c: 'edge-short', q: 'Milan surface data', expect: expectDomain('surface-model') },
  { c: 'edge-short', q: 'Shanghai traces', expect: expectDomain('ositrace') },
]

const expertBases = [
  { q: 'ASAM OpenDRIVE 1.6 HD maps with lane-level detail', expect: expectDomain('hdmap') },
  {
    q: 'concrete ASAM OpenSCENARIO scenarios with VRU interactions',
    expect: expectDomain('scenario'),
  },
  { q: 'OSI GroundTruth traces with zstd compression', expect: expectDomain('ositrace') },
  { q: 'high resolution ASAM OpenCRG road profiles', expect: expectDomain('surface-model') },
  { q: 'glTF environment models for lidar simulation', expect: expectDomain('environment-model') },
  {
    q: 'OpenSCENARIO DSL lane change scenarios in Concrete abstraction',
    expect: expectDomain('scenario'),
  },
  {
    q: 'OpenDRIVE motorway maps with crosswalk and pole detail',
    expect: expectDomain('hdmap'),
  },
  {
    q: 'ASAM OSI SensorView detection lists from Germany',
    expect: expectDomain('ositrace'),
  },
  {
    q: 'Unreal Datasmith environment models for camera simulation',
    expect: expectDomain('environment-model'),
  },
  { q: 'DLM friction maps for tire-road contact studies', expect: expectDomain('surface-model') },
  { q: 'left-hand traffic HD maps for London in Lanelet2', expect: expectDomain('hdmap') },
  {
    q: 'functional pedestrian-crossing scenarios in rain at night',
    expect: expectDomain('scenario'),
  },
  {
    q: 'object list OSI traces on rural roads with lz4 compression',
    expect: expectDomain('ositrace'),
  },
  {
    q: 'FBX environment models with traffic signs and vegetation',
    expect: expectDomain('environment-model'),
  },
  {
    q: 'OpenCRG roughness profiles for proving ground correlation',
    expect: expectDomain('surface-model'),
  },
  { q: 'survey-grade HD maps with lidar and scanner data', expect: expectDomain('hdmap') },
]

const buildQueries = () => {
  const queries = [
    ...makeCategory('hdmap-road', expectDomain('hdmap'), hdmapRoadBases, phraseTemplates),
    ...makeCategory('hdmap-format', expectDomain('hdmap'), hdmapFormatBases, [
      (base) => `${base}`,
      (base) => `HD maps in ${base.replace(/ maps$| datasets$| assets$/, '')} format`,
      (base) => `show me ${base}`,
      (base) => `find road maps stored as ${base.replace(/ maps$| datasets$| assets$/, '')}`,
      (base) => `I need ${base} for simulation`,
      (base) => `${base} for autonomous driving validation`,
    ]),
    ...makeCategory('hdmap-geographic', expectDomain('hdmap'), hdmapGeoBases, [
      (base) => `${base}`,
      (base) => `show me ${base}`,
      (base) => `find ${base} for ADAS testing`,
      (base) => `I need ${base} for validation`,
      (base) => `looking for ${base}`,
    ]),
    ...makeCategory('hdmap-combined', expectDomain('hdmap'), hdmapCombinedBases, phraseTemplates),
    ...makeCategory('hdmap-quality', expectDomain('hdmap'), hdmapQualityBases, phraseTemplates),
    ...makeCategory('hdmap-source', expectDomain('hdmap'), hdmapSourceBases, [
      (base) => `${base}`,
      (base) => `show me ${base}`,
      (base) => `find ${base} for validation`,
      (base) => `I need ${base}`,
    ]),
    ...makeCategory(
      'scenario-category',
      expectDomain('scenario'),
      scenarioCategoryBases,
      scenarioCategoryTemplates
    ),
    ...makeCategory(
      'scenario-weather',
      expectDomain('scenario'),
      scenarioWeatherBases,
      scenarioWeatherTemplates
    ),
    ...makeCategory(
      'scenario-entity',
      expectDomain('scenario'),
      scenarioEntityBases,
      scenarioEntityTemplates
    ),
    ...makeCategory('scenario-combined', expectDomain('scenario'), scenarioCombinedBases, [
      (base) => `${base}`,
      (base) => `show me ${base}`,
      (base) => `find ${base}`,
      (base) => `I need ${base} for validation`,
      (base) => `looking for ${base}`,
      (base) => `catalog ${base}`,
    ]),
    ...makeCategory('ositrace', expectDomain('ositrace'), osiTraceBases, [
      (base) => `${base}`,
      (base) => `show me ${base}`,
      (base) => `find ${base}`,
      (base) => `I need ${base} for sensor validation`,
      (base) => `looking for ${base}`,
      (base) => `catalog ${base}`,
    ]),
    ...makeCategory('environment-model', expectDomain('environment-model'), environmentModelBases, [
      (base) => `${base}`,
      (base) => `show me ${base}`,
      (base) => `find ${base}`,
      (base) => `I need ${base} for simulation`,
      (base) => `looking for ${base}`,
    ]),
    ...makeCategory('surface-model', expectDomain('surface-model'), surfaceModelBases, [
      (base) => `${base}`,
      (base) => `show me ${base}`,
      (base) => `find ${base}`,
      (base) => `I need ${base}`,
    ]),
    ...ambiguousBases.flatMap(({ q, expect }) =>
      assetTemplates.map((template) => ({ c: 'ambiguous', q: template(q), expect: { ...expect } }))
    ),
    ...naturalLanguageBases.flatMap(({ q, expect }) =>
      conversationalTemplates.map((template) => ({
        c: 'nl-variations',
        q: template(q),
        expect: { ...expect },
      }))
    ),
    ...edgeShortQueries.map((query) => ({ ...query, expect: { ...query.expect } })),
    ...expertBases.flatMap(({ q, expect }) =>
      [q, `show me ${q}`, `I need ${q}`].map((text) => ({
        c: 'expert-technical',
        q: text,
        expect: { ...expect },
      }))
    ),
  ]

  const deduped = dedupeQueries(queries)
  if (deduped.length < 1000) {
    throw new Error(`Expected at least 1000 queries, found ${deduped.length}`)
  }
  return deduped
}

const QUERIES = buildQueries()

const parseArgs = (argv) => {
  const options = { limit: Infinity, category: null, verbose: false, help: false }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--limit' && argv[i + 1]) {
      options.limit = Number.parseInt(argv[i + 1], 10)
      i += 1
    } else if (arg === '--category' && argv[i + 1]) {
      options.category = argv[i + 1]
      i += 1
    } else if (arg === '--verbose') {
      options.verbose = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!Number.isFinite(options.limit) && options.limit !== Infinity) {
    throw new Error('Invalid --limit value')
  }

  return options
}

const printHelp = () => {
  console.log('Usage:')
  console.log('  node scripts/test-1000-queries.mjs [--limit N] [--category NAME] [--verbose]')
  console.log('')
  console.log('Categories:')
  console.log(`  ${[...new Set(QUERIES.map((query) => query.c))].join(', ')}`)
}

const formatRatio = (numerator, denominator) => {
  const pct = denominator ? ((numerator / denominator) * 100).toFixed(1) : '0.0'
  return `${numerator}/${denominator} (${pct}%)`
}

const toFileUrl = (filePath) => `file:///${encodeURI(filePath.replace(/\\/g, '/'))}`

const parseEventValue = (raw) => {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

const parseSSE = (text) => {
  const events = {}
  const blocks = text.split(/\r?\n\r?\n/)

  for (const block of blocks) {
    if (!block.trim()) continue

    let eventName = null
    const dataLines = []

    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event: ')) {
        eventName = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        dataLines.push(line.slice(6))
      }
    }

    if (!eventName) continue

    const parsed = parseEventValue(dataLines.join('\n'))
    if (Object.hasOwn(events, eventName)) {
      const current = events[eventName]
      events[eventName] = Array.isArray(current) ? [...current, parsed] : [current, parsed]
    } else {
      events[eventName] = parsed
    }
  }

  return {
    interpretation: events.interpretation ?? null,
    gaps: events.gaps ?? [],
    sparql: events.sparql ?? '',
    results: events.results ?? null,
    meta: events.meta ?? null,
    error: events.error ?? null,
    raw: events,
  }
}

const ensureObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const ensureArray = (value) => (Array.isArray(value) ? value : [])

const extractPrefixes = (sparql) => {
  const matches = sparql.matchAll(/(^|\s)([A-Za-z][A-Za-z0-9-]*):(?=[A-Za-z_])/gm)
  const prefixes = new Set()

  for (const match of matches) {
    const prefix = match[2]
    if (KNOWN_PREFIXES.has(prefix)) prefixes.add(prefix)
  }

  return [...prefixes]
}

const validateDomain = (sparql, expect) => {
  const prefixes = extractPrefixes(sparql)
  const detectedDomains = prefixes.filter((prefix) => ASSET_DOMAINS.includes(prefix))

  if (expect.domain) {
    return {
      ok: detectedDomains.includes(expect.domain),
      detectedDomains,
      expected: [expect.domain],
    }
  }

  const expected = ensureArray(expect.domainOneOf)
  return {
    ok: expected.some((domain) => detectedDomains.includes(domain)),
    detectedDomains,
    expected,
  }
}

const runQuery = async (query, index) => {
  const startedAt = Date.now()

  try {
    const response = await fetch(`${API}/search/stream`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: query.q }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      return {
        ...query,
        index,
        status: 'HTTP_ERROR',
        httpCode: response.status,
        ms: Date.now() - startedAt,
        matchCount: 0,
        gapCount: 0,
        domainOk: false,
        detectedDomains: [],
        expectedDomains: query.expect.domain ? [query.expect.domain] : query.expect.domainOneOf,
      }
    }

    const parsed = parseSSE(await response.text())
    const interpretation = ensureObject(parsed.interpretation)
    const gaps = ensureArray(parsed.gaps)
    const resultsPayload = ensureObject(parsed.results)
    const meta = ensureObject(parsed.meta)
    const results = ensureArray(resultsPayload.results)
    const streamError = ensureObject(parsed.error)
    const eventError = typeof streamError.message === 'string' ? streamError.message : null
    const executionError = typeof resultsPayload.error === 'string' ? resultsPayload.error : null
    const sparql = typeof parsed.sparql === 'string' ? parsed.sparql : ''
    const domain = validateDomain(sparql, query.expect)
    const matchCount = Number.isFinite(meta.matchCount) ? meta.matchCount : results.length
    const ms = Date.now() - startedAt

    if (eventError || executionError) {
      return {
        ...query,
        index,
        status: 'ERROR',
        error: eventError ?? executionError,
        ms,
        interpretation,
        sparql,
        results,
        meta,
        matchCount,
        gapCount: gaps.length,
        domainOk: domain.ok,
        detectedDomains: domain.detectedDomains,
        expectedDomains: domain.expected,
      }
    }

    return {
      ...query,
      index,
      status: 'OK',
      ms,
      interpretation,
      sparql,
      results,
      meta,
      matchCount,
      gapCount: gaps.length,
      mappedCount: ensureArray(interpretation.mappedTerms).length,
      domainOk: domain.ok,
      detectedDomains: domain.detectedDomains,
      expectedDomains: domain.expected,
    }
  } catch (error) {
    return {
      ...query,
      index,
      status: 'NETWORK_ERROR',
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - startedAt,
      matchCount: 0,
      gapCount: 0,
      domainOk: false,
      detectedDomains: [],
      expectedDomains: query.expect.domain ? [query.expect.domain] : query.expect.domainOneOf,
    }
  }
}

const percentile = (values, p) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
  return sorted[index]
}

const pad = (value, width) => String(value).padStart(width)
const padEnd = (value, width) => String(value).padEnd(width)

const printTable = (results, categories) => {
  console.log('══════════════════════════════════════════════════════════════════════════════')
  console.log(
    `${padEnd('Category', 20)} ${pad('Total', 6)} ${pad('OK', 5)} ${pad('Domain✓', 8)} ${pad('Results', 8)} ${pad('Zero', 6)} ${pad('Errors', 7)} ${pad('AvgMs', 7)}`
  )
  console.log('──────────────────────────────────────────────────────────────────────────────')

  const totals = {
    total: 0,
    ok: 0,
    domainOk: 0,
    withResults: 0,
    zero: 0,
    errors: 0,
    totalMs: 0,
  }

  for (const category of categories) {
    const items = results.filter((result) => result.c === category)
    const ok = items.filter((result) => result.status === 'OK')
    const withResults = ok.filter((result) => result.matchCount > 0)
    const zero = ok.filter((result) => result.matchCount === 0)
    const errors = items.filter((result) => result.status !== 'OK')
    const domainOk = ok.filter((result) => result.domainOk)
    const avgMs = ok.length
      ? Math.round(ok.reduce((sum, result) => sum + result.ms, 0) / ok.length)
      : 0

    totals.total += items.length
    totals.ok += ok.length
    totals.domainOk += domainOk.length
    totals.withResults += withResults.length
    totals.zero += zero.length
    totals.errors += errors.length
    totals.totalMs += ok.reduce((sum, result) => sum + result.ms, 0)

    console.log(
      `${padEnd(category, 20)} ${pad(items.length, 6)} ${pad(ok.length, 5)} ${pad(domainOk.length, 8)} ${pad(withResults.length, 8)} ${pad(zero.length, 6)} ${pad(errors.length, 7)} ${pad(avgMs, 7)}`
    )
  }

  console.log('──────────────────────────────────────────────────────────────────────────────')
  const avgMs = totals.ok ? Math.round(totals.totalMs / totals.ok) : 0
  console.log(
    `${padEnd('TOTAL', 20)} ${pad(totals.total, 6)} ${pad(totals.ok, 5)} ${pad(totals.domainOk, 8)} ${pad(totals.withResults, 8)} ${pad(totals.zero, 6)} ${pad(totals.errors, 7)} ${pad(avgMs, 7)}`
  )
  console.log('══════════════════════════════════════════════════════════════════════════════')
}

const printDomainMismatches = (results) => {
  const mismatches = results.filter((result) => result.status === 'OK' && !result.domainOk)
  console.log(`\nDomain mismatches (${mismatches.length}):`)
  if (!mismatches.length) {
    console.log('  none')
    return mismatches.length
  }

  for (const mismatch of mismatches) {
    console.log(
      `  [${mismatch.c}] "${mismatch.q}" → expected ${mismatch.expectedDomains.join(' | ')} | detected ${mismatch.detectedDomains.join(', ') || 'none'} | matches=${mismatch.matchCount}`
    )
  }

  return mismatches.length
}

const printErrors = (results) => {
  const errors = results.filter((result) => result.status !== 'OK')
  console.log(`\nErrors (${errors.length}):`)
  if (!errors.length) {
    console.log('  none')
    return errors.length
  }

  for (const result of errors) {
    console.log(
      `  [${result.c}] "${result.q}" → ${result.status}: ${result.error ?? result.httpCode}`
    )
  }

  return errors.length
}

const printSummary = (results, categories) => {
  const ok = results.filter((result) => result.status === 'OK')
  const domainOk = ok.filter((result) => result.domainOk)
  const zero = ok.filter((result) => result.matchCount === 0)
  const withResults = ok.filter((result) => result.matchCount > 0)
  const latencies = ok.map((result) => result.ms)
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
    : 0
  const avgGapCount = ok.length
    ? (ok.reduce((sum, result) => sum + result.gapCount, 0) / ok.length).toFixed(2)
    : '0.00'

  console.log('\nSummary statistics:')
  console.log(`  Categories:      ${categories.length}`)
  console.log(`  Queries:         ${results.length}`)
  console.log(`  Successful:      ${ok.length}/${results.length}`)
  console.log(`  Domain accuracy: ${formatRatio(domainOk.length, ok.length)}`)
  console.log(`  With results:    ${withResults.length}/${ok.length}`)
  console.log(`  Zero results:    ${zero.length}/${ok.length}`)
  console.log(`  Avg latency:     ${avgLatency}ms`)
  console.log(`  P95 latency:     ${percentile(latencies, 0.95)}ms`)
  console.log(`  Avg gaps:        ${avgGapCount}`)
}

const verifyApi = async () => {
  const health = await fetch(`${API}/health`, { signal: AbortSignal.timeout(10_000) })
  if (!health.ok) {
    throw new Error(`Health check failed with ${health.status}`)
  }
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  await verifyApi()

  let queries = QUERIES
  if (options.category) {
    queries = queries.filter((query) => query.c === options.category)
    if (!queries.length) {
      throw new Error(
        `Unknown category "${options.category}". Available categories: ${[
          ...new Set(QUERIES.map((query) => query.c)),
        ].join(', ')}`
      )
    }
  }

  if (options.limit < queries.length) {
    queries = queries.slice(0, options.limit)
  }

  const categories = [...new Set(queries.map((query) => query.c))]
  console.log(
    `Running ${queries.length} queries across ${categories.length} categories (catalog size: ${QUERIES.length})...\n`
  )

  const results = []
  for (let offset = 0; offset < queries.length; offset += CONCURRENCY) {
    const batch = queries.slice(offset, offset + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map((query, batchIndex) => runQuery(query, offset + batchIndex + 1))
    )

    results.push(...batchResults)

    if (options.verbose) {
      for (const result of batchResults) {
        const domainMark = result.status === 'OK' ? (result.domainOk ? '✓' : '✗') : '-'
        console.log(
          `[${result.index}/${queries.length}] [${result.c}] ${result.status} domain=${domainMark} matches=${result.matchCount} gaps=${result.gapCount} ms=${result.ms} :: ${result.q}`
        )
      }
    } else {
      const completed = Math.min(offset + CONCURRENCY, queries.length)
      const ok = results.filter((result) => result.status === 'OK').length
      const errors = results.length - ok
      process.stdout.write(`\r  [${completed}/${queries.length}] OK: ${ok} | Errors: ${errors}`)
    }
  }

  if (!options.verbose) {
    console.log('\n')
  } else {
    console.log('')
  }

  printTable(results, categories)
  const mismatchCount = printDomainMismatches(results)
  const errorCount = printErrors(results)
  printSummary(results, categories)

  if (mismatchCount > 0 || errorCount > 0) {
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === toFileUrl(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
