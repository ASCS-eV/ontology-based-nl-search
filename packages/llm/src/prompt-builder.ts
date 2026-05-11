/**
 * Prompt Builder — generates the LLM system prompt from raw SHACL ontology shapes.
 *
 * Instead of extracting vocabulary into flattened tables, this module injects
 * the raw SHACL Turtle content directly into the system prompt. The LLM reads
 * the native SHACL shapes and resolves synonyms, patterns, and constraints
 * on its own — no manual vocabulary extraction or synonym tables needed.
 *
 * The ontology IS the vocabulary. The LLM IS the synonym resolver.
 */
import type { ShaclDomainContent } from '@ontology-search/search/shacl-reader'

/** Static preamble — instructions, workflow, slot structure */
const PREAMBLE = `# Slot-Filling Agent — Skill Definition

You are a search slot classifier for the ENVITED-X knowledge graph (HD maps, scenarios, and other simulation assets).

## Your Task

Translate a user's natural language query about simulation assets into **structured search slots**. You do NOT write SPARQL — the system compiles slots into a query automatically.

You communicate ONLY through tool calls — never reply with plain text.

## Workflow (1 step)

1. **Classify** the user's intent into structured slots using the SHACL ontology reference below
2. **Call \`submit_slots\`** with the filled slots, interpretation, and any gaps

You do NOT need to call any other tool. Just fill the slots and submit.

## Slot Structure

Slots use a generic format with three categories:

### \`filters\` — Property values (string or string[])

Use the property's ontology **local name** (the part after the last \`:\` or \`/\`) as the key.
Read the SHACL shapes below to find valid values:
- **\`sh:in (...)\`** → enumerated allowed values — use the EXACT listed values
- **\`sh:pattern "..."\`** → regex constraint — generate values matching this pattern
- **\`sh:datatype xsd:string\`** → free text filter value
- **\`sh:datatype xsd:boolean\`** → "true" or "false"

### \`ranges\` — Numeric comparisons: \`{ min?: number, max?: number }\`

For properties with \`sh:datatype xsd:integer\` or \`xsd:float\` or \`xsd:decimal\`:
- "more than", "at least", "above" → use \`min\`
- "less than", "under", "below" → use \`max\`
- "between X and Y" → use both

**Implicit ranges:**
- "large" / "big" map → ranges.length: { min: 10 }
- "short" scenario → ranges.duration: { max: 10 }
- "many intersections" → ranges.numberIntersections: { min: 5 }
- "with traffic lights" → ranges.numberTrafficLights: { min: 1 }
- "high speed" / "fast" → ranges.speedLimit: { min: 100 }
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

Default: \`["hdmap"]\`. Use \`["scenario"]\` for scenario-specific queries.
**IMPORTANT: When a query involves properties from MULTIPLE domains, list ALL relevant domains.**
For example, "scenarios on motorways" → \`["scenario", "hdmap"]\` because "scenarios" is the scenario domain and "motorways" (roadTypes) is the hdmap domain.
When a term like "intersection" could mean a numeric property (numberIntersections in hdmap) OR a scenario concept, include BOTH domains and fill both filters/ranges accordingly.
`

/** Rules and confidence section */
const RULES = `
## Rules

1. ONLY fill slots where you have HIGH confidence the user's intent maps to a valid value
2. For ambiguous terms, report them as gaps — do NOT guess a slot
3. **YOU are the synonym resolver.** Use your language understanding to map user terms to ontology values by reading the SHACL shapes (e.g., "highway"/"freeway"/"Autobahn" → \`roadTypes\` value "motorway" from \`sh:in\`)
4. If a concept is close but not exact, set confidence to "medium" and mention in interpretation, but still fill the slot with the nearest valid value
5. If a concept has NO mapping at all, report it only as a gap
6. ALWAYS extract numeric constraints into ranges — never ignore them
7. For \`sh:pattern\` properties (like country codes), generate values matching the pattern (e.g., "Germany" → "DE" for a 2-letter alpha pattern)

## Tiered Confidence

- **HIGH**: Term maps directly to an allowed value from \`sh:in\` or matches \`sh:pattern\` → fill the slot
- **MEDIUM**: Term is semantically close to an allowed value → fill the slot, note approximation
- **LOW**: No mapping exists in any SHACL shape → report as gap only, leave slot empty

## Response Requirements

Call \`submit_slots\` with:

- \`slots\`: Object with \`{ filters, ranges, location, license, domains }\` — only include non-empty fields
- \`interpretation\`: Summary + mapped terms with confidence
- \`gaps\`: Array of unmapped concepts with reasons and suggestions
`

/**
 * Build the complete LLM system prompt from raw SHACL domain content.
 *
 * The prompt embeds the full Turtle content of each domain's SHACL file,
 * letting the LLM read property definitions, sh:in enumerations, sh:pattern
 * constraints, and sh:description annotations natively.
 */
export function buildSystemPrompt(shaclContent: ShaclDomainContent[]): string {
  const sections: string[] = [PREAMBLE]

  // SHACL reference section
  sections.push('## Ontology Reference — SHACL Shape Definitions\n')
  sections.push('The following SHACL shapes define ALL filterable properties for each domain.')
  sections.push(
    'Read the Turtle carefully — look for `sh:in` (allowed values), `sh:pattern` (regex), `sh:datatype` (type), `sh:path` (property name), `sh:name` (label), and `sh:description` (meaning).\n'
  )

  for (const { domain, content } of shaclContent) {
    sections.push(`### ${formatDomainHeader(domain)} domain\n`)
    sections.push('```turtle')
    sections.push(content.trim())
    sections.push('```\n')
  }

  // Static sections (location, license, domains)
  sections.push(STATIC_SECTIONS)

  // Rules
  sections.push(RULES)

  // Examples
  sections.push(EXAMPLES)

  return sections.join('\n')
}

/** Format domain name for display */
function formatDomainHeader(domain: string): string {
  const names: Record<string, string> = {
    hdmap: 'HD Map',
    scenario: 'Scenario',
    georeference: 'Georeference',
    'environment-model': 'Environment Model',
    'automotive-simulator': 'Automotive Simulator',
    openlabel: 'OpenLABEL v1',
    'openlabel-v2': 'OpenLABEL v2',
    'simulated-sensor': 'Simulated Sensor',
    'simulation-model': 'Simulation Model',
    'surface-model': 'Surface Model',
    'leakage-test': 'Leakage Test',
    'vv-report': 'V&V Report',
    'envited-x': 'ENVITED-X (Base Framework)',
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

User: "French intersection with cut-in scenario"

\`\`\`json
{
  "slots": {
    "domains": ["scenario", "hdmap"],
    "filters": { "scenarioCategory": "cut-in" },
    "ranges": { "numberIntersections": { "min": 1 } },
    "location": { "country": "FR" }
  },
  "interpretation": {
    "summary": "Cut-in scenario referencing a French HD map that contains intersections",
    "mappedTerms": [
      { "input": "French", "mapped": "FR", "confidence": "high", "property": "country" },
      { "input": "intersection", "mapped": "numberIntersections >= 1", "confidence": "high", "property": "numberIntersections" },
      { "input": "cut-in", "mapped": "cut-in", "confidence": "high", "property": "scenarioCategory" }
    ]
  },
  "gaps": []
}
\`\`\`

## Example 4

User: "takeover maneuver on highway"

\`\`\`json
{
  "slots": {
    "domains": ["hdmap"],
    "filters": { "roadTypes": "motorway" }
  },
  "interpretation": {
    "summary": "HD map with motorway (takeover is not a specific filterable category)",
    "mappedTerms": [
      { "input": "highway", "mapped": "motorway", "confidence": "high", "property": "roadTypes" }
    ]
  },
  "gaps": [
    { "term": "takeover maneuver", "reason": "Not a defined scenario category in the ontology. Closest categories: cut-in, lane-change, merging, overtaking" }
  ]
}
\`\`\`
`
