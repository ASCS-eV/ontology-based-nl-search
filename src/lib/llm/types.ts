/** A single term mapped from user input to an ontology concept */
export interface MappedTerm {
  /** What the user typed or implied */
  input: string
  /** The ontology concept it mapped to */
  mapped: string
  /** How confidently the term was mapped */
  confidence: 'high' | 'medium' | 'low'
  /** The ontology property/class used (e.g., "georeference:country") */
  property?: string
}

/** A concept the user mentioned that isn't in the ontology */
export interface OntologyGap {
  /** The unmapped user term */
  term: string
  /** Why it couldn't be mapped */
  reason: string
  /** Nearest concepts in the ontology that might be relevant */
  suggestions?: string[]
  /** Domain glossary definition if available */
  definition?: string
  /** Usage guidance (how to achieve what the user wants) */
  scopeNote?: string
  /** Whether this is a recognized domain concept (just not filterable) */
  isDomainConcept?: boolean
}

/** The LLM's structured interpretation of a user query */
export interface QueryInterpretation {
  /** Human-readable summary of what was understood */
  summary: string
  /** Individual term mappings with confidence */
  mappedTerms: MappedTerm[]
}

/** Full structured response from the LLM */
export interface LlmStructuredResponse {
  interpretation: QueryInterpretation
  gaps: OntologyGap[]
  sparql: string
}

/** Complete search API response */
export interface SearchResponse {
  interpretation: QueryInterpretation
  gaps: OntologyGap[]
  sparql: string
  results: Record<string, string>[]
  meta: {
    totalDatasets: number
    matchCount: number
    executionTimeMs: number
  }
}
