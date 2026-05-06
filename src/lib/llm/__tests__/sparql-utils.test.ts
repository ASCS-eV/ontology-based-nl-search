import { extractSparql } from '../sparql-utils'

describe('extractSparql', () => {
  it('should extract SPARQL from markdown code block', () => {
    const text = `Here is the query:
\`\`\`sparql
SELECT ?s WHERE { ?s ?p ?o }
\`\`\`
`
    expect(extractSparql(text)).toBe('SELECT ?s WHERE { ?s ?p ?o }')
  })

  it('should extract SPARQL from generic code block', () => {
    const text = `\`\`\`
PREFIX ex: <http://example.org/>
SELECT ?s WHERE { ?s a ex:Thing }
\`\`\``
    expect(extractSparql(text)).toBe(
      'PREFIX ex: <http://example.org/>\nSELECT ?s WHERE { ?s a ex:Thing }'
    )
  })

  it('should return raw text when no code block present', () => {
    const text = 'SELECT ?s WHERE { ?s ?p ?o }'
    expect(extractSparql(text)).toBe('SELECT ?s WHERE { ?s ?p ?o }')
  })

  it('should handle multiline SPARQL in code block', () => {
    const text = `\`\`\`sparql
PREFIX envx: <https://w3id.org/2024/2/2/envited-x/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?asset ?name ?country
WHERE {
  ?asset a envx:SimulationAsset .
  ?asset rdfs:label ?name .
  ?asset envx:hasCountry ?country .
  FILTER(CONTAINS(LCASE(STR(?country)), "germany"))
}
\`\`\``
    const result = extractSparql(text)
    expect(result).toContain('PREFIX envx:')
    expect(result).toContain('SELECT ?asset ?name ?country')
    expect(result).toContain('FILTER')
  })
})
