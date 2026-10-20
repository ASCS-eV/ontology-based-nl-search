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

const PREFIX_DECL = /^\s*PREFIX\s+([A-Za-z][\w.-]*)?:/i

/**
 * Keep only the PREFIX declarations the query body references. A prefix
 * label is needed only where a prefixed name uses it ([SPARQL11] §4.1.1.1
 * Prefixed Names), so declaring the full standard set on every query just
 * advertises vocabularies the query never touches. Matching is
 * conservative: a label preceded by a name character is not a use, and a
 * spurious match (e.g. inside a literal) merely keeps a harmless line.
 */
export function pruneUnusedPrefixes(prefixes: string, body: string): string {
  return prefixes
    .split('\n')
    .filter((line) => {
      const match = PREFIX_DECL.exec(line)
      if (!match) return line.trim().length > 0
      const label = (match[1] ?? '').replace(/[.-]/g, '\\$&')
      return new RegExp(`(?<![\\w.-])${label}:`).test(body)
    })
    .join('\n')
}

/**
 * Assemble a complete SPARQL SELECT query from its constituent parts.
 * Centralizes the query-tail pattern used by both single-domain and
 * cross-domain compilation.
 *
 * Every query carries `LIMIT SPARQL_MAX_LIMIT` ([SPARQL11] §15.5). The limit
 * bounds *rows*, which is what a response costs to materialize and serialize,
 * and is the only ceiling in the system — a compiled query is the sole
 * producer the store ever sees, so bounding it here bounds the service.
 *
 * Rows are not assets: a multi-valued property or a cross-reference JOIN
 * emits one row per value (measured at 6.46 rows per asset for a
 * scenario→hdmap join on the shipped corpus), so hitting the limit truncates
 * fewer assets than the number suggests. That is why reaching it is reported
 * rather than hidden — `SearchService` flags `meta.truncated` when the row
 * count reaches the ceiling, instead of silently returning a short list.
 */
export function assembleQuery(
  prefixes: string,
  selectVars: string[] | Set<string>,
  patterns: string[],
  optionals: string[],
  filters: string[]
): string {
  const vars = selectVars instanceof Set ? [...selectVars] : selectVars
  const selectClause = `SELECT ${vars.join(' ')}`
  const whereBody = [...patterns, ...optionals, ...filters].join('\n  ')
  const prologue = pruneUnusedPrefixes(prefixes, `${selectClause}\n${whereBody}`)
  const query =
    `${prologue}\n${selectClause} WHERE {\n  ${whereBody}\n}` +
    `\nLIMIT ${getConfig().SPARQL_MAX_LIMIT}`

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
