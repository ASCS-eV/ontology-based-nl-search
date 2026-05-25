import {
  enforceSparqlPolicy,
  registerPolicyNamespaces,
  resetPolicyNamespaces,
  validateSchemaQuery,
} from '../policy.js'

describe('enforceSparqlPolicy', () => {
  // Register ontology namespaces so the test queries pass prefix validation.
  // In production this is done during app warmup from the domain registry.
  beforeAll(() => {
    registerPolicyNamespaces(['https://w3id.org/ascs-ev/envited-x/'])
  })
  afterAll(() => {
    resetPolicyNamespaces()
  })

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

  it('allows registered non-ENVITED-X ontology namespaces', () => {
    registerPolicyNamespaces([
      'https://w3id.org/ascs-ev/envited-x/',
      'https://example.org/custom-ontology/v1/',
    ])
    const q = `
      PREFIX custom: <https://example.org/custom-ontology/v1/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT ?name WHERE { ?x a custom:Asset ; rdfs:label ?name }
    `
    const result = enforceSparqlPolicy(q)
    expect(result.allowed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('rejects ontology namespaces when none are registered', () => {
    resetPolicyNamespaces()
    const q = `
      PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT ?name WHERE { ?x a hdmap:HdMap ; rdfs:label ?name }
    `
    const result = enforceSparqlPolicy(q)
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('not in allowlist')
    // Re-register for remaining tests
    registerPolicyNamespaces(['https://w3id.org/ascs-ev/envited-x/'])
  })
})

describe('validateSchemaQuery', () => {
  const schemaGraph = 'urn:graph:schema'

  it('allows a valid SELECT query and injects FROM scope', () => {
    const result = validateSchemaQuery(
      'PREFIX sh: <http://www.w3.org/ns/shacl#> SELECT ?s WHERE { ?s a sh:NodeShape }',
      schemaGraph
    )
    expect(result.allowed).toBe(true)
    expect(result.query).toContain(`FROM <${schemaGraph}>`)
  })

  it('rejects ASK queries even with PREFIX prefix', () => {
    const result = validateSchemaQuery(
      'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> ASK { ?s ?p ?o }',
      schemaGraph
    )
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('Only SELECT')
  })

  it('rejects DESCRIBE queries', () => {
    const result = validateSchemaQuery('DESCRIBE <urn:some:resource>', schemaGraph)
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('Only SELECT')
  })

  it('rejects CONSTRUCT queries with PREFIX prefix', () => {
    const result = validateSchemaQuery(
      'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
      schemaGraph
    )
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('Only SELECT')
  })

  it('scopes queries even without explicit WHERE keyword', () => {
    const result = validateSchemaQuery('SELECT * { ?s ?p ?o }', schemaGraph)
    expect(result.allowed).toBe(true)
    expect(result.query).toContain(`FROM <${schemaGraph}>`)
  })

  it('rejects SERVICE clauses', () => {
    const result = validateSchemaQuery(
      'SELECT * WHERE { SERVICE <http://evil.com/sparql> { ?s ?p ?o } }',
      schemaGraph
    )
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('SERVICE')
  })

  it('rejects GRAPH patterns', () => {
    const result = validateSchemaQuery(
      'SELECT * WHERE { GRAPH <urn:graph:data> { ?s ?p ?o } }',
      schemaGraph
    )
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('GRAPH')
  })

  it('rejects FROM clauses', () => {
    const result = validateSchemaQuery(
      'SELECT * FROM <urn:graph:data> WHERE { ?s ?p ?o }',
      schemaGraph
    )
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('FROM')
  })

  it('rejects FROM NAMED clauses', () => {
    const result = validateSchemaQuery(
      'SELECT * FROM NAMED <urn:graph:data> WHERE { GRAPH <urn:graph:data> { ?s ?p ?o } }',
      schemaGraph
    )
    expect(result.allowed).toBe(false)
    // Should catch both FROM NAMED and GRAPH
    expect(result.violations.length).toBeGreaterThanOrEqual(1)
  })

  it('rejects write operations disguised with PREFIX', () => {
    const result = validateSchemaQuery(
      'PREFIX ex: <http://example.org/> DELETE DATA { ex:a ex:b ex:c }',
      schemaGraph
    )
    expect(result.allowed).toBe(false)
  })

  it('rejects empty queries', () => {
    const result = validateSchemaQuery('', schemaGraph)
    expect(result.allowed).toBe(false)
    expect(result.violations[0]).toContain('empty')
  })

  it('caps results at 50 even if query has higher LIMIT', () => {
    const result = validateSchemaQuery('SELECT * WHERE { ?s ?p ?o } LIMIT 999', schemaGraph)
    expect(result.allowed).toBe(true)
    expect(result.query).toContain('LIMIT 50')
    expect(result.query).not.toContain('999')
  })
})
