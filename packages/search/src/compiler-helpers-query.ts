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
 * Every query carries `ORDER BY ?asset` followed by `LIMIT SPARQL_MAX_LIMIT`
 * ([SPARQL11] §15.1, §15.5). This is the only ceiling in the system — a
 * compiled query is the sole producer the store ever sees — so bounding it
 * here bounds the service.
 *
 * The limit counts *rows*, and rows are not assets: a multi-valued property
 * or a cross-reference JOIN emits one row per value, so a bounded page holds
 * fewer assets than rows. Ordering by the primary asset is what makes that
 * safe to report. It gives two properties a bare `LIMIT` cannot:
 *
 *  - the page is deterministic. A solution sequence has no inherent order,
 *    so which rows a `LIMIT` keeps is otherwise arbitrary ([SPARQL11] §15.5)
 *    and may differ between runs of the same query;
 *  - every asset's rows are contiguous, so at most one asset — the last —
 *    can be cut part-way through. `SearchService` drops that trailing group,
 *    which is what lets it report `meta.truncated` as a fact rather than a
 *    guess, and guarantees every asset it does return carries its complete
 *    set of joined rows rather than a silently partial one.
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
    `\nORDER BY ?asset\nLIMIT ${getConfig().SPARQL_MAX_LIMIT}`

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
