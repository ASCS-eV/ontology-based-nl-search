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

  // No SERVICE clauses — walk the whole AST so a SERVICE buried in a
  // sub-SELECT or FILTER EXISTS cannot slip past the gate.
  if (astHasPatternType(parsed, 'service')) {
    violations.push('SERVICE clauses are not allowed (no federation)')
  }

  // No FROM / FROM NAMED — the compiler never emits a dataset clause, so any
  // FROM is an attempt to redirect the query off the default (data) graph.
  if (astHasFromClause(parsed)) {
    violations.push('FROM/FROM NAMED clauses are not allowed (no graph redirection)')
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

/**
 * Recursively determine whether any node in a parsed SPARQL AST is a
 * pattern of the given `type` (`service` or `graph`).
 *
 * Unlike a hand-rolled recursion over `.patterns`/`.triples`, this walks
 * EVERY nested container the parser can produce — including sub-SELECT
 * `query` nodes' `.where`, `FILTER EXISTS`/`NOT EXISTS` operation args, and
 * UNION/OPTIONAL/MINUS groups. A SERVICE or GRAPH buried inside a subquery
 * (e.g. `SELECT * { { SELECT ?x { GRAPH <g> { ?x ?p ?o } } } }`) therefore
 * cannot slip past the gate — the previous two-key recursion missed it,
 * which let the schema-query sandbox be escaped (named-graph read + SSRF).
 *
 * Term nodes carry `termType`, not `type`, so a variable named "graph"
 * never matches; only genuine GraphPattern/ServicePattern nodes do.
 */
function astHasPatternType(node: unknown, patternType: 'service' | 'graph'): boolean {
  if (Array.isArray(node)) {
    return node.some((child) => astHasPatternType(child, patternType))
  }
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>
    if (rec.type === patternType) return true
    return Object.values(rec).some((value) => astHasPatternType(value, patternType))
  }
  return false
}

/**
 * Recursively determine whether any (sub)query in the AST declares a
 * `FROM` / `FROM NAMED` dataset clause — graph redirection that would
 * escape the intended default-graph scoping.
 */
function astHasFromClause(node: unknown): boolean {
  if (Array.isArray(node)) {
    return node.some(astHasFromClause)
  }
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>
    const from = rec.from as { default?: unknown[]; named?: unknown[] } | undefined
    if (from && ((from.default?.length ?? 0) > 0 || (from.named?.length ?? 0) > 0)) {
      return true
    }
    return Object.values(rec).some(astHasFromClause)
  }
  return false
}

// ─── Schema-scoped query validation ──────────────────────────────────────────

const generator = new Generator()

/** Row ceiling for LLM-authored schema-introspection queries. */
const SCHEMA_QUERY_MAX_ROWS = 50

/**
 * Validate and scope a SPARQL query for schema-only access.
 *
 * Uses the sparqljs AST (not regex) to enforce:
 * - SELECT-only (rejects ASK, DESCRIBE, CONSTRUCT, updates)
 * - No SERVICE clauses (no federation)
 * - No GRAPH patterns (no cross-graph access)
 * - No FROM/FROM NAMED (no graph redirection)
 * - Injects FROM <schemaGraph> via AST to guarantee schema scoping
 * - Caps results at SCHEMA_QUERY_MAX_ROWS rows
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

  // No SERVICE clauses — full-AST walk catches a SERVICE inside a
  // sub-SELECT / FILTER EXISTS, not just a top-level WHERE pattern.
  if (astHasPatternType(parsed, 'service')) {
    violations.push('SERVICE clauses are not allowed (no federation)')
  }

  // No GRAPH patterns (prevents cross-graph access) — full-AST walk, so an
  // explicit GRAPH inside a sub-SELECT cannot override the injected FROM
  // scoping and read another named graph.
  if (astHasPatternType(parsed, 'graph')) {
    violations.push('GRAPH clauses are not allowed — queries are scoped to the schema graph')
  }

  // No FROM/FROM NAMED (prevents graph redirection) — checked across the
  // whole AST so a dataset clause on a sub-SELECT is caught too.
  const parsedAny = parsed as unknown as Record<string, unknown>
  if (astHasFromClause(parsed)) {
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
  // Cap at the schema-query row ceiling.
  if (!parsed.limit || parsed.limit > SCHEMA_QUERY_MAX_ROWS) {
    parsed.limit = SCHEMA_QUERY_MAX_ROWS
  }

  const scopedQuery = generator.stringify(parsed as unknown as SparqlQuery)

  return { allowed: true, violations: [], query: scopedQuery }
}
