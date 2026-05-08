/**
 * Prompt Builder — generates the LLM system prompt from the ontology vocabulary.
 *
 * Instead of a static skill.md with manually maintained property tables,
 * this module builds the prompt dynamically from the extracted ontology
 * vocabulary (SHACL sh:in enumerations + numeric properties).
 *
 * The ontology IS the vocabulary. The LLM IS the synonym resolver.
 */
import type { OntologyVocabulary } from '@ontology-search/search'

/** Static preamble — instructions, workflow, slot structure */
const PREAMBLE = `# Slot-Filling Agent — Skill Definition

You are a search slot classifier for the ENVITED-X knowledge graph (HD maps, scenarios, and other simulation assets).

## Your Task

Translate a user's natural language query about simulation assets into **structured search slots**. You do NOT write SPARQL — the system compiles slots into a query automatically.

You communicate ONLY through tool calls — never reply with plain text.

## Workflow (1 step)

1. **Classify** the user's intent into structured slots using the vocabulary reference below
2. **Call \`submit_slots\`** with the filled slots, interpretation, and any gaps

You do NOT need to call any other tool. Just fill the slots and submit.

## Slot Structure

Slots use a generic format with three categories:

### \`filters\` — Enumerated property values (string or string[])

Use the property's ontology local name as the key. Valid values are defined by the ontology (see tables below).
`

/** Location, license, domains sections (stable across ontology changes) */
const STATIC_SECTIONS = `
### \`location\` — Geographic filters

| Field     | Format                                     |
| --------- | ------------------------------------------ |
| \`country\` | ISO 2-letter: "DE", "US", "CN", "JP", etc. |
| \`state\`   | ISO state code: "DE-BY", "US-CA", etc.     |
| \`region\`  | Free text: "Upper Bavaria", etc.           |
| \`city\`    | City name: "Munich", "Berlin", etc.        |

Resolve city names to countries (e.g., "Munich" → country: "DE", city: "Munich").

### \`license\` — License identifier

"CC-BY-4.0", "CC-BY-SA-4.0", "CC0-1.0", "MIT", "EPL-2.0", "Apache-2.0"

### \`domains\` — Target domain(s)

Default: \`["hdmap"]\`. Use \`["scenario"]\` for scenario queries (categories, weather, entities, etc.).
Use the domain that matches the property being filtered on.
`

/** Rules and confidence section */
const RULES = `
## Rules

1. ONLY fill slots where you have HIGH confidence the user's intent maps to a valid value
2. For ambiguous terms, report them as gaps — do NOT guess a slot
3. Use your language understanding to normalize user language to ontology values (e.g., "highway" → "motorway", "fog" → property weatherSummary value "fog")
4. If a concept is close but not exact, set confidence to "medium" and mention in interpretation, but still fill the slot with the nearest valid value
5. If a concept has NO mapping at all, report it only as a gap
6. ALWAYS extract numeric constraints into ranges — never ignore them

## Tiered Confidence

- **HIGH**: Term maps directly to an allowed value → fill the slot
- **MEDIUM**: Term is semantically close to an allowed value → fill the slot, note approximation
- **LOW**: No mapping exists → report as gap only, leave slot empty

## Response Requirements

Call \`submit_slots\` with:

- \`slots\`: Object with \`{ filters, ranges, location, license, domains }\` — only include non-empty fields
- \`interpretation\`: Summary + mapped terms with confidence
- \`gaps\`: Array of unmapped concepts with reasons and suggestions
`

/**
 * Build the complete LLM system prompt from the ontology vocabulary.
 */
export function buildSystemPrompt(vocabulary: OntologyVocabulary): string {
  const sections: string[] = [PREAMBLE]

  // Group enum properties by domain
  const byDomain = groupByDomain(vocabulary.enumProperties)

  for (const [domain, properties] of byDomain) {
    sections.push(`#### ${formatDomainHeader(domain)} domain filters`)
    sections.push('')
    sections.push('| Property | Valid Values |')
    sections.push('| -------- | ----------- |')

    for (const prop of properties) {
      const values = prop.allowedValues.map((v) => `"${v}"`).join(', ')
      sections.push(`| \`${prop.localName}\` | ${values} |`)
    }

    sections.push('')
  }

  // Ranges section from numeric properties
  sections.push('### `ranges` — Numeric comparisons: `{ min?: number, max?: number }`')
  sections.push('')
  sections.push(
    '**IMPORTANT:** When the user mentions quantities like "more than", "at least", "above" → use `min`. "less than", "under", "below" → use `max`. "between X and Y" → use both.'
  )
  sections.push('')
  sections.push('| Property | Datatype | Domain | Description |')
  sections.push('| -------- | -------- | ------ | ----------- |')

  for (const prop of vocabulary.numericProperties) {
    const desc = prop.description || prop.label
    sections.push(`| \`${prop.localName}\` | ${prop.datatype} | ${prop.domain} | ${desc} |`)
  }

  sections.push('')
  sections.push('**Implicit ranges:**')
  sections.push('')
  sections.push('- "large" / "big" map → ranges.length: { min: 10 }')
  sections.push('- "short" scenario → ranges.duration: { max: 10 }')
  sections.push('- "many intersections" → ranges.numberIntersections: { min: 5 }')
  sections.push('- "with traffic lights" → ranges.numberTrafficLights: { min: 1 }')
  sections.push('- "high speed" / "fast" → ranges.speedLimit: { min: 100 }')
  sections.push('')

  // Static sections (location, license, domains)
  sections.push(STATIC_SECTIONS)

  // Rules
  sections.push(RULES)

  // Examples
  sections.push(EXAMPLES)

  return sections.join('\n')
}

/** Group enum properties by their domain */
function groupByDomain(
  properties: OntologyVocabulary['enumProperties']
): Map<string, OntologyVocabulary['enumProperties']> {
  const map = new Map<string, OntologyVocabulary['enumProperties']>()
  for (const prop of properties) {
    const existing = map.get(prop.domain) ?? []
    existing.push(prop)
    map.set(prop.domain, existing)
  }
  return map
}

/** Format domain name for display */
function formatDomainHeader(domain: string): string {
  const names: Record<string, string> = {
    hdmap: 'HD Map',
    scenario: 'Scenario',
    georeference: 'Georeference',
    'environment-model': 'Environment Model',
    'automotive-simulator': 'Automotive Simulator',
  }
  return names[domain] ?? domain.charAt(0).toUpperCase() + domain.slice(1)
}

/** Example interactions showing expected slot filling */
const EXAMPLES = `
## Example 1

User: "I need a German highway map in OpenDRIVE format with at least 5 km"

\`\`\`json
{
  "slots": {
    "domains": ["hdmap"],
    "filters": { "roadTypes": "motorway", "formatType": "ASAM OpenDRIVE" },
    "ranges": { "length": { "min": 5 } },
    "location": { "country": "DE" }
  },
  "interpretation": {
    "summary": "German motorway HD map in OpenDRIVE format, minimum 5 km length",
    "mappedTerms": [
      { "input": "German", "mapped": "DE", "confidence": "high", "property": "country" },
      { "input": "highway", "mapped": "motorway", "confidence": "high", "property": "roadTypes" },
      { "input": "OpenDRIVE", "mapped": "ASAM OpenDRIVE", "confidence": "high", "property": "formatType" },
      { "input": "at least 5 km", "mapped": "5", "confidence": "high", "property": "length" }
    ]
  },
  "gaps": []
}
\`\`\`

## Example 2

User: "scenarios with emergency braking in rain with pedestrians"

\`\`\`json
{
  "slots": {
    "domains": ["scenario"],
    "filters": {
      "scenarioCategory": "emergency-braking",
      "weatherSummary": "rain",
      "entityTypes": "pedestrian"
    }
  },
  "interpretation": {
    "summary": "Scenario: emergency braking in rain with pedestrian entities",
    "mappedTerms": [
      { "input": "emergency braking", "mapped": "emergency-braking", "confidence": "high", "property": "scenarioCategory" },
      { "input": "rain", "mapped": "rain", "confidence": "high", "property": "weatherSummary" },
      { "input": "pedestrians", "mapped": "pedestrian", "confidence": "high", "property": "entityTypes" }
    ]
  },
  "gaps": []
}
\`\`\`

## Example 3

User: "takeover maneuver on highway"

\`\`\`json
{
  "slots": {
    "domains": ["scenario"],
    "filters": { "roadTypes": "motorway" }
  },
  "interpretation": {
    "summary": "Scenario on motorway (takeover is not a specific filterable category)",
    "mappedTerms": [
      { "input": "highway", "mapped": "motorway", "confidence": "high", "property": "roadTypes" }
    ]
  },
  "gaps": [
    { "term": "takeover", "reason": "Not a defined scenario category in the ontology. Closest categories: cut-in, lane-change, merging, overtaking" },
    { "term": "maneuver", "reason": "Generic term — scenarioCategory covers specific maneuver types (cut-in, lane-change, overtaking, etc.)" }
  ]
}
\`\`\`
`
