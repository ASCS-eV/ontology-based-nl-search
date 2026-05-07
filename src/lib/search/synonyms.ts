/**
 * Deterministic synonym/normalization layer.
 * Maps common user expressions to exact ontology values,
 * reducing LLM burden and enabling cheap models to work reliably.
 */

export interface NormalizedTerm {
  original: string
  property: string
  value: string
  confidence: 'high'
}

/** Country name → ISO 2-letter code */
const COUNTRY_MAP: Record<string, string> = {
  germany: 'DE',
  german: 'DE',
  deutschland: 'DE',
  austria: 'AT',
  austrian: 'AT',
  österreich: 'AT',
  switzerland: 'CH',
  swiss: 'CH',
  schweiz: 'CH',
  france: 'FR',
  french: 'FR',
  japan: 'JP',
  japanese: 'JP',
  china: 'CN',
  chinese: 'CN',
  'united states': 'US',
  usa: 'US',
  american: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  british: 'GB',
  netherlands: 'NL',
  dutch: 'NL',
  italy: 'IT',
  italian: 'IT',
  spain: 'ES',
  spanish: 'ES',
  sweden: 'SE',
  swedish: 'SE',
  'south korea': 'KR',
  korea: 'KR',
  korean: 'KR',
  singapore: 'SG',
  finland: 'FI',
  finnish: 'FI',
  australia: 'AU',
  australian: 'AU',
}

/** Road type synonyms → ontology value */
const ROAD_TYPE_MAP: Record<string, string> = {
  highway: 'motorway',
  autobahn: 'motorway',
  freeway: 'motorway',
  expressway: 'motorway',
  interstate: 'motorway',
  motorway: 'motorway',
  urban: 'town',
  city: 'town',
  town: 'town',
  suburban: 'town',
  rural: 'rural',
  'country road': 'rural',
  countryside: 'rural',
  roundabout: 'roundabout',
  'traffic circle': 'roundabout',
  intersection: 'intersection',
  crossing: 'intersection',
  junction: 'intersection',
}

/** Format synonyms → ontology value */
const FORMAT_MAP: Record<string, string> = {
  opendrive: 'ASAM OpenDRIVE',
  'open drive': 'ASAM OpenDRIVE',
  xodr: 'ASAM OpenDRIVE',
  'asam opendrive': 'ASAM OpenDRIVE',
  lanelet: 'Lanelet2',
  lanelet2: 'Lanelet2',
  'nds.live': 'NDS.Live',
  nds: 'NDS.Live',
  'nds live': 'NDS.Live',
  road2sim: 'road2sim',
  'shape file': 'Shape',
  shapefile: 'Shape',
  shape: 'Shape',
}

/** Data source synonyms → ontology value */
const DATA_SOURCE_MAP: Record<string, string> = {
  lidar: 'lidar',
  laser: 'lidar',
  camera: 'camera',
  satellite: 'satellite',
  gps: 'satellite',
  aerial: 'aerial',
  drone: 'aerial',
  survey: 'survey',
  scanner: 'scanner',
  'mobile mapping': 'mobile mapping',
}

/** Lane type synonyms → ontology value */
const LANE_TYPE_MAP: Record<string, string> = {
  driving: 'driving',
  shoulder: 'shoulder',
  parking: 'parking',
  walking: 'walking',
  pedestrian: 'walking',
  sidewalk: 'walking',
  biking: 'biking',
  bicycle: 'biking',
  cycling: 'biking',
  bus: 'bus',
  emergency: 'emergency',
  median: 'median',
}

/**
 * Extract known terms from a query and normalize them to ontology values.
 * Returns the extracted terms and the remaining (unmatched) query text.
 */
export function extractKnownTerms(query: string): {
  terms: NormalizedTerm[]
  remainder: string
} {
  const terms: NormalizedTerm[] = []
  let remainder = query.toLowerCase()

  // Try longer phrases first (multi-word entries)
  const allMaps: { map: Record<string, string>; property: string }[] = [
    { map: COUNTRY_MAP, property: 'country' },
    { map: ROAD_TYPE_MAP, property: 'roadType' },
    { map: FORMAT_MAP, property: 'formatType' },
    { map: DATA_SOURCE_MAP, property: 'dataSource' },
    { map: LANE_TYPE_MAP, property: 'laneType' },
  ]

  for (const { map, property } of allMaps) {
    // Sort keys by length descending (match longer phrases first)
    const keys = Object.keys(map).sort((a, b) => b.length - a.length)

    for (const key of keys) {
      const regex = new RegExp(`\\b${escapeRegex(key)}\\b`, 'i')
      if (regex.test(remainder)) {
        terms.push({
          original: key,
          property,
          value: map[key] ?? key,
          confidence: 'high',
        })
        remainder = remainder.replace(regex, ' ').trim()
      }
    }
  }

  // Clean up remainder
  remainder = remainder.replace(/\s+/g, ' ').trim()

  return { terms, remainder }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Get all allowed values for a given property.
 * Useful for LLM tools to validate user terms.
 */
export function getAllowedValues(property: string): string[] {
  switch (property) {
    case 'country':
      return [...new Set(Object.values(COUNTRY_MAP))]
    case 'roadType':
      return [...new Set(Object.values(ROAD_TYPE_MAP))]
    case 'formatType':
      return [...new Set(Object.values(FORMAT_MAP))]
    case 'dataSource':
      return [...new Set(Object.values(DATA_SOURCE_MAP))]
    case 'laneType':
      return [...new Set(Object.values(LANE_TYPE_MAP))]
    default:
      return []
  }
}

export interface DetectedGap {
  term: string
  reason: string
  suggestions: string[]
}

/**
 * Near-miss concepts: terms that are semantically related to ontology values
 * but not direct synonyms. These get reported as gaps with suggestions.
 */
const NEAR_MISS_MAP: Record<string, { suggestion: string; property: string; reason: string }> = {
  exit: {
    suggestion: 'intersection',
    property: 'roadType',
    reason:
      'Highway exits are not a distinct concept in the HD map ontology; intersections are the closest representation',
  },
  ramp: {
    suggestion: 'intersection',
    property: 'roadType',
    reason: 'On/off ramps are not modeled separately; intersections capture road connectivity',
  },
  'on-ramp': {
    suggestion: 'intersection',
    property: 'roadType',
    reason: 'On-ramps are not modeled separately; intersections capture road connectivity',
  },
  'off-ramp': {
    suggestion: 'intersection',
    property: 'roadType',
    reason: 'Off-ramps are not modeled separately; intersections capture road connectivity',
  },
  bridge: {
    suggestion: 'motorway',
    property: 'roadType',
    reason:
      'Bridges are not a distinct road type in the ontology; they appear within motorway or primary road datasets',
  },
  tunnel: {
    suggestion: 'motorway',
    property: 'roadType',
    reason:
      'Tunnels are not a distinct road type in the ontology; they appear within motorway or primary road datasets',
  },
  'traffic light': {
    suggestion: 'intersection',
    property: 'roadType',
    reason: 'Traffic lights are attributes of intersections, not a separate road type',
  },
  'speed limit': {
    suggestion: 'motorway',
    property: 'roadType',
    reason: 'Speed limits are attributes across road types, not a road type themselves',
  },
  pedestrian: {
    suggestion: 'walking',
    property: 'laneType',
    reason: 'Pedestrian infrastructure maps to walking lane type',
  },
  crosswalk: {
    suggestion: 'intersection',
    property: 'roadType',
    reason: 'Crosswalks are associated with intersections in the ontology',
  },
  'bike lane': {
    suggestion: 'biking',
    property: 'laneType',
    reason: 'Bike lanes map to biking lane type',
  },
  weather: {
    suggestion: '',
    property: '',
    reason: 'Weather conditions are not part of the HD map ontology',
  },
  slope: {
    suggestion: '',
    property: '',
    reason: 'Elevation/slope data is not a searchable attribute in the current ontology',
  },
}

/** Stopwords to ignore when detecting gaps */
const STOPWORDS = new Set([
  'i',
  'a',
  'an',
  'the',
  'want',
  'need',
  'looking',
  'for',
  'with',
  'and',
  'or',
  'that',
  'has',
  'have',
  'having',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'can',
  'of',
  'in',
  'on',
  'at',
  'to',
  'from',
  'by',
  'about',
  'like',
  'find',
  'search',
  'show',
  'me',
  'some',
  'any',
  'all',
  'get',
  'give',
  'please',
  'map',
  'maps',
  'data',
  'dataset',
  'datasets',
  'hd',
  'simulation',
  'asset',
  'assets',
])

/**
 * Detect ontology gaps from unmatched remainder text.
 * Identifies meaningful words not covered by the synonym layer
 * and suggests the nearest ontology concept where possible.
 */
export function detectGaps(remainder: string): DetectedGap[] {
  if (!remainder.trim()) return []

  const gaps: DetectedGap[] = []

  // Check multi-word near-misses first
  const multiWordKeys = Object.keys(NEAR_MISS_MAP)
    .filter((k) => k.includes(' ') || k.includes('-'))
    .sort((a, b) => b.length - a.length)

  let processedRemainder = remainder.toLowerCase()

  for (const key of multiWordKeys) {
    const regex = new RegExp(`\\b${escapeRegex(key)}\\b`, 'i')
    if (regex.test(processedRemainder)) {
      const miss = NEAR_MISS_MAP[key]
      if (miss) {
        gaps.push({
          term: key,
          reason: miss.reason,
          suggestions: miss.suggestion ? [miss.suggestion] : [],
        })
      }
      processedRemainder = processedRemainder.replace(regex, ' ').trim()
    }
  }

  // Check remaining single words
  const remainingWords = processedRemainder.split(/\s+/).filter((w) => w.length > 0)

  for (const word of remainingWords) {
    if (STOPWORDS.has(word) || word.length <= 2) continue

    const miss = NEAR_MISS_MAP[word]
    if (miss) {
      gaps.push({
        term: word,
        reason: miss.reason,
        suggestions: miss.suggestion ? [miss.suggestion] : [],
      })
    }
  }

  return gaps
}
