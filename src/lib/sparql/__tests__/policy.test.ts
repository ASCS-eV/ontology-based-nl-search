import { enforceSparqlPolicy } from '../policy'

describe('enforceSparqlPolicy', () => {
  const validSelect = `
    PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?name WHERE {
      ?asset a hdmap:HdMap ;
        rdfs:label ?name .
    }
  `

  it('allows a valid SELECT query', () => {
    const result = enforceSparqlPolicy(validSelect)
    expect(result.allowed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('appends LIMIT if missing', () => {
    const result = enforceSparqlPolicy(validSelect)
    expect(result.query).toContain('LIMIT 500')
  })

  it('preserves existing LIMIT ≤ 500', () => {
    const q = validSelect.trimEnd() + ' LIMIT 50'
    const result = enforceSparqlPolicy(q)
    expect(result.allowed).toBe(true)
    expect(result.query).toContain('LIMIT 50')
    expect(result.query).not.toContain('LIMIT 500')
  })

  it('rejects LIMIT > 500', () => {
    const q = validSelect.trimEnd() + ' LIMIT 9999'
    const result = enforceSparqlPolicy(q)
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('exceeds maximum')
  })

  it('rejects INSERT queries', () => {
    const q = `
      PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
      INSERT DATA { hdmap:asset1 a hdmap:HdMap }
    `
    const result = enforceSparqlPolicy(q)
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toMatch(/Only SELECT|Parse error/)
  })

  it('rejects CONSTRUCT queries', () => {
    const q = `
      PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
      CONSTRUCT { ?s ?p ?o } WHERE { ?s a hdmap:HdMap ; ?p ?o }
    `
    const result = enforceSparqlPolicy(q)
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('Only SELECT')
  })

  it('rejects unknown prefix IRIs', () => {
    const q = `
      PREFIX evil: <https://evil.com/sparql/>
      PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
      SELECT ?x WHERE { ?x a evil:Malware }
    `
    const result = enforceSparqlPolicy(q)
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('not in allowlist')
  })

  it('rejects SERVICE clauses', () => {
    const q = `
      PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
      SELECT ?x WHERE {
        SERVICE <https://evil.com/sparql> { ?x a hdmap:HdMap }
      }
    `
    const result = enforceSparqlPolicy(q)
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('SERVICE')
  })

  it('rejects empty queries', () => {
    const result = enforceSparqlPolicy('')
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('empty')
  })

  it('rejects unparseable queries', () => {
    const result = enforceSparqlPolicy('THIS IS NOT SPARQL')
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('Parse error')
  })
})
