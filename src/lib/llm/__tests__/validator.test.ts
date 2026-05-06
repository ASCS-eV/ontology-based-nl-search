import { validateSparql } from '../agent/validator'

describe('validateSparql', () => {
  it('should validate a correct SELECT query', () => {
    const query = `
      PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

      SELECT ?asset ?name
      WHERE {
        ?asset a hdmap:HdMap ;
               rdfs:label ?name .
      }
    `
    const result = validateSparql(query)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.queryType).toBe('query')
  })

  it('should reject invalid SPARQL with syntax error', () => {
    const query = 'SELCT ?x WHERE { ?x ?p ?o }'
    const result = validateSparql(query)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should reject empty query', () => {
    const result = validateSparql('')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should validate query with FILTER and OPTIONAL', () => {
    const query = `
      PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
      PREFIX georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

      SELECT ?asset ?name ?country
      WHERE {
        ?asset a hdmap:HdMap ;
               rdfs:label ?name ;
               hdmap:hasDomainSpecification ?domSpec .
        ?domSpec hdmap:hasGeoreference ?georef .
        ?georef georeference:hasProjectLocation ?loc .
        ?loc georeference:country ?country .
        FILTER(?country = "DE")
        OPTIONAL { ?domSpec hdmap:hasQuantity ?qty }
      }
    `
    const result = validateSparql(query)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should reject query with unclosed braces', () => {
    const query = `
      PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
      SELECT ?x WHERE { ?x a hdmap:HdMap
    `
    const result = validateSparql(query)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should reject query with invalid prefix usage', () => {
    const query = `
      SELECT ?x WHERE { ?x a undeclared:Class }
    `
    const result = validateSparql(query)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should validate ASK query', () => {
    const query = `
      PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
      ASK { ?x a hdmap:HdMap }
    `
    const result = validateSparql(query)
    expect(result.valid).toBe(true)
  })

  it('should extract variable names from SELECT', () => {
    const query = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT ?name ?country ?roadType
      WHERE { ?s rdfs:label ?name }
    `
    const result = validateSparql(query)
    expect(result.valid).toBe(true)
    expect(result.variables).toContain('name')
    expect(result.variables).toContain('country')
    expect(result.variables).toContain('roadType')
  })
})
