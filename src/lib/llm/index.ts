import { generateText } from 'ai'
import { getModel } from './provider'
import { getOntologyContext } from '@/lib/ontology'
import { extractSparql as extractSparqlFromResponse } from './sparql-utils'

/**
 * Translate a natural language query into a SPARQL query
 * using the configured LLM provider and ontology context.
 */
export async function generateSparql(naturalLanguageQuery: string): Promise<string> {
  const ontologyContext = await getOntologyContext()
  const model = getModel()

  const { text } = await generateText({
    model,
    system: buildSystemPrompt(ontologyContext),
    prompt: naturalLanguageQuery,
  })

  // Extract SPARQL from the response (may be wrapped in markdown code blocks)
  return extractSparqlFromResponse(text)
}

function buildSystemPrompt(ontologyContext: string): string {
  return `You are a SPARQL query generator for the ENVITED-X Simulation Asset knowledge graph.

Your task: Convert natural language questions about simulation assets into valid SPARQL SELECT queries.

## Ontology Context
The knowledge graph uses the following ontology structure:

${ontologyContext}

## Rules
1. Generate ONLY a valid SPARQL SELECT query — no explanations.
2. Use the prefixes defined in the ontology context.
3. Use proper RDF/OWL property paths from the ontology.
4. Always include relevant labels and human-readable properties in the SELECT.
5. Use FILTER for string matching, comparisons, and language tags.
6. If the query is ambiguous, make reasonable assumptions based on the ontology structure.
7. Return the SPARQL query wrapped in a \`\`\`sparql code block.

## Example
User: "Show me all highways in Germany"
\`\`\`sparql
PREFIX envx: <https://w3id.org/2024/2/2/envited-x/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?asset ?name ?country ?roadType
WHERE {
  ?asset a envx:SimulationAsset .
  ?asset rdfs:label ?name .
  ?asset envx:hasCountry ?country .
  ?asset envx:hasRoadType ?roadType .
  FILTER(CONTAINS(LCASE(STR(?country)), "germany") || CONTAINS(LCASE(STR(?country)), "de"))
  FILTER(CONTAINS(LCASE(STR(?roadType)), "highway") || CONTAINS(LCASE(STR(?roadType)), "autobahn"))
}
\`\`\`
`
}
