import { Parser } from 'sparqljs'

export interface PolicyResult {
  allowed: boolean
  violations: string[]
}

const ALLOWED_PREFIXES = new Set([
  'https://w3id.org/ascs-ev/envited-x/hdmap/v6/',
  'https://w3id.org/ascs-ev/envited-x/envited-x/v3/',
  'https://w3id.org/ascs-ev/envited-x/georeference/v5/',
  'https://w3id.org/ascs-ev/envited-x/manifest/v5/',
  'https://w3id.org/gaia-x/development#',
  'http://www.w3.org/2000/01/rdf-schema#',
  'http://www.w3.org/2001/XMLSchema#',
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
])

const MAX_LIMIT = 500

const parser = new Parser()

/**
 * Enforce security policy on a SPARQL query before execution.
 * Rules:
 * - Must be a SELECT query (no INSERT, DELETE, CONSTRUCT, DESCRIBE, LOAD, etc.)
 * - No SERVICE clauses (no federation to external endpoints)
 * - LIMIT must be ≤ MAX_LIMIT (auto-appended if missing)
 * - All prefixes must be from the allowed set
 */
export function enforceSparqlPolicy(query: string): PolicyResult & { query: string } {
  const violations: string[] = []

  if (!query || !query.trim()) {
    return { allowed: false, violations: ['Query is empty'], query }
  }

  let parsed
  try {
    parsed = parser.parse(query)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { allowed: false, violations: [`Parse error: ${msg}`], query }
  }

  // Must be SELECT
  if (parsed.type !== 'query') {
    violations.push(`Only SELECT queries are allowed, got: ${parsed.type}`)
    return { allowed: false, violations, query }
  }

  if (parsed.queryType !== 'SELECT') {
    violations.push(`Only SELECT queries are allowed, got: ${parsed.queryType}`)
  }

  // No SERVICE clauses (check recursively in where patterns)
  if ('where' in parsed && containsService(parsed.where)) {
    violations.push('SERVICE clauses are not allowed (no federation)')
  }

  // Check prefixes
  if (parsed.prefixes) {
    for (const [, iri] of Object.entries(parsed.prefixes)) {
      if (!ALLOWED_PREFIXES.has(iri as string)) {
        violations.push(`Prefix IRI not in allowlist: ${iri}`)
      }
    }
  }

  // Check LIMIT
  let resultQuery = query
  if (parsed.type === 'query' && parsed.queryType === 'SELECT') {
    if (parsed.limit === undefined) {
      // Append a default LIMIT
      resultQuery = query.trimEnd() + `\nLIMIT ${MAX_LIMIT}`
    } else if (parsed.limit > MAX_LIMIT) {
      violations.push(`LIMIT ${parsed.limit} exceeds maximum ${MAX_LIMIT}`)
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
    query: violations.length === 0 ? resultQuery : query,
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function containsService(patterns: any[] | undefined): boolean {
  if (!patterns) return false
  for (const p of patterns) {
    if (p.type === 'service') return true
    if (p.patterns && containsService(p.patterns)) return true
    if (p.triples && containsService(p.triples)) return true
  }
  return false
}
/* eslint-enable @typescript-eslint/no-explicit-any */
