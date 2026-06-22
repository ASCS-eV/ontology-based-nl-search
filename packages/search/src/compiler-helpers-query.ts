/**
 * SPARQL query assembly (ADR 0003 step 22d): stitches prefixes + SELECT + WHERE
 * + LIMIT into the final query string and runs post-assembly validation.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
import { getConfig } from '@ontology-search/core/config'
import { createComponentLogger } from '@ontology-search/core/logging'

import { validateSparql } from './sparql-validator.js'

const log = createComponentLogger('compiler')

/**
 * Assemble a complete SPARQL SELECT query from its constituent parts.
 * Centralizes the query-tail pattern used by both single-domain and
 * cross-domain compilation. The LIMIT defaults to the operator-tunable
 * `SPARQL_DEFAULT_LIMIT` config field; the policy gate enforces the
 * separate `SPARQL_MAX_LIMIT` ceiling (the Zod schema rejects configs
 * where the default would exceed the ceiling).
 */
export function assembleQuery(
  prefixes: string,
  selectVars: string[] | Set<string>,
  patterns: string[],
  optionals: string[],
  filters: string[],
  limit: number = getConfig().SPARQL_DEFAULT_LIMIT,
  distinctSubjectVar?: string
): string {
  const vars = selectVars instanceof Set ? [...selectVars] : selectVars
  const selectClause = `SELECT ${vars.join(' ')}`
  const whereBody = [...patterns, ...optionals, ...filters].join('\n  ')

  let query: string
  if (distinctSubjectVar) {
    // Limit DISTINCT subjects, not rows. A cross-reference JOIN fans out (one
    // row per referenced asset), so a plain row-level LIMIT would silently
    // truncate distinct matching assets (a trace with 2 referenced maps eats 2
    // of the LIMIT). Select the limited distinct subjects in a sub-SELECT, then
    // re-state the body to bind every projected column for exactly those
    // subjects. The outer row cap is a safety net (SPARQL_MAX_LIMIT, which the
    // policy enforces anyway); the inner LIMIT is the real distinct-asset bound.
    const maxLimit = getConfig().SPARQL_MAX_LIMIT
    query =
      `${prefixes}\n${selectClause} WHERE {\n` +
      `  { SELECT DISTINCT ${distinctSubjectVar} WHERE {\n  ${whereBody}\n  } LIMIT ${limit} }\n` +
      `  ${whereBody}\n}\nLIMIT ${maxLimit}`
  } else {
    query = `${prefixes}\n${selectClause} WHERE {\n  ${whereBody}\n}\nLIMIT ${limit}`
  }

  // Post-assembly validation: catch syntax errors and W3C compliance issues
  const validation = validateSparql(query)
  if (!validation.valid) {
    log.error('Generated SPARQL has errors', undefined, { errors: validation.errors })
  }
  if (validation.warnings.length > 0) {
    log.warn('Generated SPARQL has warnings', { warnings: validation.warnings })
  }

  return query
}
