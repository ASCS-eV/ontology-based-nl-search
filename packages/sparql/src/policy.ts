import { getConfig } from '@ontology-search/core/config'
import { RDF_PREFIXES } from '@ontology-search/core/rdf/prefixes'
import { Generator, Parser, type SparqlQuery } from 'sparqljs'

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
 * Ontology namespace IRIs registered at startup from the domain registry.
 * Replaces the former hardcoded ENVITED-X regex pattern — any ontology
 * loaded via the registry is automatically allowed.
 */
let registeredNamespaces = new Set<string>()

/**
 * Register additional namespace IRIs as allowed SPARQL prefixes.
 * Called during app warmup after the domain registry is built.
 * This makes the policy ontology-agnostic: whatever namespaces the
 * loaded ontology declares are automatically allowed.
 */
export function registerPolicyNamespaces(namespaces: Iterable<string>): void {
  registeredNamespaces = new Set(namespaces)
}

/** Reset registered namespaces (for test isolation). */
export function resetPolicyNamespaces(): void {
  registeredNamespaces = new Set()
}

/**
 * Check whether an IRI is allowed by the policy.
 * An IRI is allowed if it exactly matches a known base prefix OR
 * starts with any registered ontology namespace.
 */
function isAllowedIri(iri: string): boolean {
  if (BASE_ALLOWED_PREFIXES.has(iri)) return true
  for (const ns of registeredNamespaces) {
    if (iri.startsWith(ns)) return true
  }
  return false
}

const parser = new Parser()

/**
 * Shape of the sparqljs parse tree we care about — the library ships no
 * TypeScript declarations, so we describe only the subset the policy
 * inspects. Lives at module scope so the cast and the consumers share the
 * same definitions.
 */
interface ParsedQuery {
  type: string
  queryType?: string
  where?: SparqlPattern[]
  prefixes?: Record<string, string>
  limit?: number
}

interface SparqlPattern {
  type?: string
  patterns?: SparqlPattern[]
  triples?: SparqlPattern[]
}

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

  // Check prefixes — allow W3C standards and registered ontology namespaces
  if (parsed.prefixes) {
    for (const [, iriStr] of Object.entries(parsed.prefixes)) {
      if (!isAllowedIri(iriStr)) {
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

function containsService(patterns: SparqlPattern[] | undefined): boolean {
  if (!patterns) return false
  for (const p of patterns) {
    if (p.type === 'service') return true
    if (p.patterns && containsService(p.patterns)) return true
    if (p.triples && containsService(p.triples)) return true
  }
  return false
}

function containsGraph(patterns: SparqlPattern[] | undefined): boolean {
  if (!patterns) return false
  for (const p of patterns) {
    if (p.type === 'graph') return true
    if (p.patterns && containsGraph(p.patterns)) return true
  }
  return false
}

// ─── Schema-scoped query validation ──────────────────────────────────────────

const generator = new Generator()

/**
 * Validate and scope a SPARQL query for schema-only access.
 *
 * Uses the sparqljs AST (not regex) to enforce:
 * - SELECT-only (rejects ASK, DESCRIBE, CONSTRUCT, updates)
 * - No SERVICE clauses (no federation)
 * - No GRAPH patterns (no cross-graph access)
 * - No FROM/FROM NAMED (no graph redirection)
 * - Injects FROM <schemaGraph> via AST to guarantee schema scoping
 * - Caps results at 50 rows
 *
 * Returns the validated, schema-scoped query string on success.
 */
export function validateSchemaQuery(
  query: string,
  schemaGraph: string
): PolicyResult & { query: string } {
  const violations: string[] = []

  if (!query || !query.trim()) {
    return { allowed: false, violations: ['Query is empty'], query }
  }

  let parsed: ParsedQuery
  try {
    parsed = parser.parse(query) as unknown as ParsedQuery
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { allowed: false, violations: [`Parse error: ${msg}`], query }
  }

  // Must be a SELECT query (blocks ASK, DESCRIBE, CONSTRUCT)
  if (parsed.type !== 'query') {
    violations.push(`Only SELECT queries are allowed, got: ${parsed.type}`)
    return { allowed: false, violations, query }
  }
  if (parsed.queryType !== 'SELECT') {
    violations.push(`Only SELECT queries are allowed, got: ${parsed.queryType}`)
  }

  // No write operations (INSERT, DELETE, etc. are type 'update', caught above,
  // but belt-and-suspenders for safety)
  if (/\b(INSERT|DELETE|DROP|CLEAR|CREATE|LOAD)\b/i.test(query)) {
    violations.push('Write operations are not allowed')
  }

  // No SERVICE clauses
  if (parsed.where && containsService(parsed.where)) {
    violations.push('SERVICE clauses are not allowed (no federation)')
  }

  // No GRAPH patterns (prevents cross-graph access)
  if (parsed.where && containsGraph(parsed.where)) {
    violations.push('GRAPH clauses are not allowed — queries are scoped to the schema graph')
  }

  // No FROM/FROM NAMED (prevents graph redirection)
  const parsedAny = parsed as unknown as Record<string, unknown>
  const from = parsedAny.from as { default?: unknown[]; named?: unknown[] } | undefined
  if (
    from &&
    ((from.default && from.default.length > 0) || (from.named && from.named.length > 0))
  ) {
    violations.push(
      'FROM/FROM NAMED clauses are not allowed — queries are scoped to the schema graph'
    )
  }

  if (violations.length > 0) {
    return { allowed: false, violations, query }
  }

  // Inject FROM <schemaGraph> via AST and regenerate the query.
  // This guarantees schema scoping regardless of input syntax (e.g., no WHERE keyword).
  parsedAny.from = {
    default: [{ termType: 'NamedNode', value: schemaGraph }],
    named: [],
  }
  // Cap at 50 results
  if (!parsed.limit || parsed.limit > 50) {
    parsed.limit = 50
  }

  const scopedQuery = generator.stringify(parsed as unknown as SparqlQuery)

  return { allowed: true, violations: [], query: scopedQuery }
}
