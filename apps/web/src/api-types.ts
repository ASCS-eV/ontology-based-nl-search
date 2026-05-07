/** API response types matching the backend contract */

export interface MappedTerm {
  input: string
  mapped: string
  confidence: 'high' | 'medium' | 'low'
  property?: string
}

export interface OntologyGap {
  term: string
  reason: string
  suggestions?: string[]
  definition?: string
  scopeNote?: string
  isDomainConcept?: boolean
}

export interface QueryInterpretation {
  summary: string
  mappedTerms: MappedTerm[]
}

export interface SearchMeta {
  totalDatasets: number
  matchCount: number
  executionTimeMs: number
}

export interface SearchResponse {
  interpretation: QueryInterpretation
  gaps: OntologyGap[]
  sparql: string
  results: Record<string, string>[]
  meta: SearchMeta
}

export interface StatsResponse {
  totalAssets: number
  domains: Record<string, number>
  availableDomains: string[]
}
