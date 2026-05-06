import { Parser } from 'sparqljs'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  queryType?: string
  variables?: string[]
}

const parser = new Parser()

/**
 * Validate a SPARQL query string for syntactic correctness.
 * Uses sparqljs (SPARQL 1.1 compliant parser).
 */
export function validateSparql(query: string): ValidationResult {
  if (!query || !query.trim()) {
    return { valid: false, errors: ['Query is empty'] }
  }

  try {
    const parsed = parser.parse(query)

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, errors: ['Parser returned empty result'] }
    }

    const queryType = parsed.type || 'unknown'
    const variables: string[] = []

    if ('variables' in parsed && Array.isArray(parsed.variables)) {
      for (const v of parsed.variables) {
        if (v && typeof v === 'object' && 'value' in v) {
          variables.push(v.value as string)
        } else if (typeof v === 'string') {
          variables.push(v)
        }
      }
    }

    return { valid: true, errors: [], queryType, variables }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { valid: false, errors: [message] }
  }
}
