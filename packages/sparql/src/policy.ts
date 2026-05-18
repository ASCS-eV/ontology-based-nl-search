import { getConfig } from '@ontology-search/core/config'
import { RDF_PREFIXES } from '@ontology-search/core/rdf/prefixes'
import { Parser } from 'sparqljs'

export interface PolicyResult {
  allowed: boolean
  violations: string[]
}

/**
 * Base prefixes that are always allowed: every W3C / GAIA-X namespace
 * the project knows about. Sourced from the canonical RDF_PREFIXES map
 * so the allowlist cannot drift from the IRIs the compiler emits.
 */
const BASE_ALLOWED_PREFIXES = new Set<string>(Object.values(RDF_PREFIXES))

/**
 * Pattern for ASCS/ENVITED-X ontology IRIs.
 * Matches: https://w3id.org/ascs-ev/envited-x/{domain}/{version}/
 */
const ENVITED_X_PATTERN = /^https:\/\/w3id\.org\/ascs-ev\/envited-x\//

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

  // sparqljs does not ship TypeScript declarations; this interface covers
  // the subset of the parse tree we inspect for policy enforcement.
  interface ParsedQuery {
    type: string
    queryType?: string
    where?: SparqlPattern[]
    prefixes?: Record<string, string>
    limit?: number
  }

  let parsed: ParsedQuery
  try {
    parsed = parser.parse(query) as unknown as ParsedQuery
  } catch (err: unknown) {
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
  if (parsed.where && containsService(parsed.where)) {
    violations.push('SERVICE clauses are not allowed (no federation)')
  }

  // Check prefixes — allow W3C standards, GAIA-X, and any ENVITED-X ontology
  if (parsed.prefixes) {
    for (const [, iriStr] of Object.entries(parsed.prefixes)) {
      if (!BASE_ALLOWED_PREFIXES.has(iriStr) && !ENVITED_X_PATTERN.test(iriStr)) {
        violations.push(`Prefix IRI not in allowlist: ${iriStr}`)
      }
    }
  }

  // Check LIMIT against the configured maximum.
  const maxLimit = getConfig().SPARQL_MAX_LIMIT
  let resultQuery = query
  if (parsed.type === 'query' && parsed.queryType === 'SELECT') {
    if (parsed.limit === undefined) {
      // Append a default LIMIT
      resultQuery = query.trimEnd() + `\nLIMIT ${maxLimit}`
    } else if (parsed.limit > maxLimit) {
      violations.push(`LIMIT ${parsed.limit} exceeds maximum ${maxLimit}`)
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
    query: violations.length === 0 ? resultQuery : query,
  }
}

interface SparqlPattern {
  type?: string
  patterns?: SparqlPattern[]
  triples?: SparqlPattern[]
}

function containsService(patterns: SparqlPattern[] | undefined): boolean {
  if (!patterns) return false
  for (const p of patterns) {
    if (p.type === 'service') return true
    if (p.patterns && containsService(p.patterns)) return true
    if (p.triples && containsService(p.triples)) return true
  }
  return false
}
