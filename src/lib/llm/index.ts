import { getOntologyContext } from '@/lib/ontology'
import { generateWithCopilot } from './copilot-provider'
import { runSparqlAgent } from './agent'
import { extractSparql as extractSparqlFromResponse } from './sparql-utils'
import type { LlmStructuredResponse } from './types'

/**
 * Translate a natural language query into a structured response containing
 * interpretation, ontology gaps, and SPARQL query.
 *
 * Uses the agentic tool-use flow for providers that support function calling
 * (openai, ollama with compatible models). Falls back to structured prompt
 * for the copilot SDK which uses a chat interface.
 */
export async function generateStructuredSearch(
  naturalLanguageQuery: string
): Promise<LlmStructuredResponse> {
  const provider = process.env.AI_PROVIDER || 'openai'

  if (provider === 'copilot') {
    // Copilot SDK doesn't support Vercel AI tool calling — use structured prompt
    return generateWithStructuredPrompt(naturalLanguageQuery)
  }

  // Use the full agentic flow with tool calling
  return runSparqlAgent(naturalLanguageQuery)
}

/**
 * Legacy function: Translate NL query directly to SPARQL.
 * Kept for backward compatibility with existing tests.
 */
export async function generateSparql(naturalLanguageQuery: string): Promise<string> {
  const response = await generateStructuredSearch(naturalLanguageQuery)
  return response.sparql
}

/**
 * Fallback for providers that don't support tool calling (e.g., Copilot SDK).
 * Uses a structured JSON prompt and parses the response.
 */
async function generateWithStructuredPrompt(
  naturalLanguageQuery: string
): Promise<LlmStructuredResponse> {
  const ontologyContext = await getOntologyContext()
  const modelId = process.env.AI_MODEL || 'gpt-4o'
  const systemPrompt = buildStructuredSystemPrompt(ontologyContext)

  const text = await generateWithCopilot(systemPrompt, naturalLanguageQuery, modelId)
  return parseStructuredResponse(text)
}

/**
 * Parse the LLM's JSON response into our structured type.
 * Handles cases where the LLM wraps output in markdown code blocks.
 */
function parseStructuredResponse(text: string): LlmStructuredResponse {
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  const jsonText = jsonBlockMatch ? jsonBlockMatch[1].trim() : text.trim()

  try {
    const parsed = JSON.parse(jsonText)
    return {
      interpretation: {
        summary: parsed.interpretation?.summary || 'Query interpreted',
        mappedTerms: Array.isArray(parsed.interpretation?.mappedTerms)
          ? parsed.interpretation.mappedTerms
          : [],
      },
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      sparql: extractSparqlFromResponse(parsed.sparql || ''),
    }
  } catch {
    const sparql = extractSparqlFromResponse(text)
    return {
      interpretation: {
        summary: 'Query processed (unstructured response)',
        mappedTerms: [],
      },
      gaps: [],
      sparql,
    }
  }
}

function buildStructuredSystemPrompt(ontologyContext: string): string {
  return `You are a SPARQL query generator for the ENVITED-X HD Map knowledge graph.

Your task: Convert natural language questions about HD map simulation assets into:
1. A structured interpretation of what the user wants
2. Identified ontology gaps (concepts the user mentions that don't exist in the ontology)
3. A valid SPARQL SELECT query

## Ontology Context
${ontologyContext}

## Key Data Model
- Each asset is typed \`hdmap:HdMap\` (subclass of \`envited-x:SimulationAsset\`)
- Assets have: \`hdmap:hasDomainSpecification\` → \`hdmap:DomainSpecification\` which contains:
  - \`hdmap:hasContent\` → \`hdmap:Content\` (roadTypes, laneTypes, levelOfDetail, trafficDirection)
  - \`hdmap:hasQuantity\` → \`hdmap:Quantity\` (length, numberIntersections, numberTrafficLights, numberTrafficSigns, numberObjects, speedLimit)
  - \`hdmap:hasQuality\` → \`hdmap:Quality\` (precision, accuracyLaneModel2d, accuracyLaneModelHeight)
  - \`hdmap:hasDataSource\` → \`hdmap:DataSource\` (usedDataSources, measurementSystem)
  - \`hdmap:hasGeoreference\` → \`georeference:Georeference\` → \`georeference:hasProjectLocation\` → \`georeference:ProjectLocation\` (country, state, region, city)

## Response Format
Respond with a JSON object (no markdown wrapping):
{
  "interpretation": {
    "summary": "Human-readable sentence describing what was understood",
    "mappedTerms": [{ "input": "user term", "mapped": "ontology concept", "confidence": "high|medium|low", "property": "prefix:name" }]
  },
  "gaps": [{ "term": "unmapped term", "reason": "why not in ontology", "suggestions": ["nearest concept"] }],
  "sparql": "PREFIX hdmap: <...>\\nSELECT ..."
}

## SPARQL Prefixes
PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
PREFIX envited-x: <https://w3id.org/ascs-ev/envited-x/envited-x/v3/>
PREFIX georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/>
PREFIX gx: <https://w3id.org/gaia-x/development#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
`
}
