import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import type { StatsResponse } from '../api-types'
import { useSearchExecution } from '../hooks/useSearchExecution'
import { useSearchHistory } from '../hooks/useSearchHistory'
import { apiGet } from '../lib/api-client'
import { GraphQLEditor } from './GraphQLEditor'
import { InterpretationDisplay } from './InterpretationDisplay'
import { OntologyGapsDisplay } from './OntologyGapsDisplay'
import type { PipelineStep } from './PipelineStepper'
import { PipelineStepper } from './PipelineStepper'
import { QueryRefinement } from './QueryRefinement'
import { ResultsDisplay } from './ResultsDisplay'
import { SearchBar } from './SearchBar'
import { SparqlPreview } from './SparqlPreview'
import { TypewriterText } from './TypewriterText'

export function SearchPage() {
  const {
    data: stats,
    isSuccess: apiReady,
    isLoading: apiLoading,
  } = useQuery<StatsResponse>({
    queryKey: ['stats'],
    queryFn: () => apiGet<StatsResponse>('/api/stats'),
    retry: true,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  })

  const { history, addToHistory } = useSearchHistory()

  const {
    interpretation,
    gaps,
    sparql,
    graphql,
    results,
    traceability,
    meta,
    phase,
    loading,
    error,
    handleSearch: executeSearch,
    handleRefine,
  } = useSearchExecution(stats?.availableDomains ?? [])

  const [graphQLEntryMode, setGraphQLEntryMode] = useState(false)

  const handleSearch = async (query: string) => {
    setGraphQLEntryMode(false)
    await executeSearch(query)
    addToHistory(query)
  }

  const handleSkipToGraphQL = () => {
    setGraphQLEntryMode(true)
  }

  const hasResponse = interpretation || gaps || sparql || results
  const showGraphQLFeature = stats?.features?.graphqlLayer !== false

  // Determine which step is currently active (by step ID)
  const activeStepId = useMemo(() => {
    if (graphQLEntryMode) return 'graphql'
    if (!hasResponse) return 'nl-search'
    if (phase === 'interpreting' && !interpretation) return 'interpretation'
    if (interpretation && !sparql) return 'filters'
    if (sparql && !results) return 'graphql'
    if (results) return 'sparql'
    return 'nl-search'
  }, [graphQLEntryMode, hasResponse, phase, interpretation, sparql, results])

  // Build pipeline steps
  const steps: PipelineStep[] = useMemo(
    () => [
      {
        id: 'nl-search',
        label: 'Natural Language Search',
        summary: phase !== 'idle' ? 'Query submitted' : undefined,
        hasContent: true,
        content: (
          <div>
            <SearchBar
              onSearch={handleSearch}
              loading={loading}
              disabled={!apiReady}
              history={history}
            />
            {apiLoading && (
              <p className="text-gray-400 text-xs mt-2 text-center h-4 animate-pulse">
                Connecting to search API…
              </p>
            )}
            {phase === 'interpreting' && !interpretation && (
              <p className="text-blue-600 text-xs mt-2 text-center h-4">
                <TypewriterText text="Interpreting your query against the ontology…" speed={35} />
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'interpretation',
        label: 'LLM Interpretation & Ontology Mapping',
        summary: interpretation?.summary,
        hasContent: !!interpretation,
        content: interpretation ? <InterpretationDisplay interpretation={interpretation} /> : null,
      },
      {
        id: 'filters',
        label: 'Selected Filters',
        summary: interpretation
          ? `${interpretation.mappedTerms.length} filter(s) applied`
          : undefined,
        hasContent: !!(interpretation && interpretation.mappedTerms.length > 0),
        content:
          interpretation && interpretation.mappedTerms.length > 0 ? (
            <QueryRefinement
              mappedTerms={interpretation.mappedTerms}
              domains={interpretation.domains ?? []}
              onRerun={handleRefine}
              loading={loading}
            />
          ) : null,
      },
      {
        id: 'gaps',
        label: 'Ontology Gaps',
        summary: gaps && gaps.length > 0 ? `${gaps.length} gap(s) detected` : undefined,
        hasContent: !!(gaps && gaps.length > 0),
        content: gaps ? <OntologyGapsDisplay gaps={gaps} /> : null,
      },
      {
        id: 'graphql',
        label: 'GraphQL Query',
        summary: graphql ? 'Generated' : undefined,
        hasContent: !!(graphql || graphQLEntryMode),
        content:
          graphql || graphQLEntryMode ? (
            <GraphQLEditor value={graphql ?? 'query {\n  \n}'} readOnly={false} />
          ) : null,
      },
      {
        id: 'sparql',
        label: 'SPARQL Query',
        summary: sparql ? 'Generated' : undefined,
        hasContent: !!sparql,
        content: sparql ? <SparqlPreview sparql={sparql} inline /> : null,
      },
    ],
    [
      interpretation,
      gaps,
      sparql,
      graphql,
      phase,
      loading,
      apiReady,
      apiLoading,
      history,
      graphQLEntryMode,
      handleSearch,
      handleRefine,
    ]
  )

  return (
    <div className="flex flex-col items-center px-4 pt-12 pb-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Simulation Asset Search</h1>
        {stats && stats.totalAssets > 0 && (
          <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-blue-50 text-blue-900 text-sm font-medium rounded-full border border-blue-100">
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            {stats.totalAssets} assets in graph
          </span>
        )}
      </div>

      {error && !results && (
        <div
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 max-w-2xl w-full"
          role="alert"
        >
          {error}
        </div>
      )}

      {showGraphQLFeature ? (
        <PipelineStepper
          steps={steps}
          activeStepId={activeStepId}
          onSkipToGraphQL={handleSkipToGraphQL}
          showGraphQLEntry={!hasResponse}
        />
      ) : (
        /* Fallback: original layout without stepper (feature flag off) */
        <div className="w-full max-w-4xl mx-auto">
          <SearchBar
            onSearch={handleSearch}
            loading={loading}
            disabled={!apiReady}
            history={history}
          />
          {hasResponse && (
            <div className="mt-8 space-y-4">
              {interpretation && <InterpretationDisplay interpretation={interpretation} />}
              {interpretation && interpretation.mappedTerms.length > 0 && (
                <QueryRefinement
                  mappedTerms={interpretation.mappedTerms}
                  domains={interpretation.domains ?? []}
                  onRerun={handleRefine}
                  loading={loading}
                />
              )}
              {gaps && <OntologyGapsDisplay gaps={gaps} />}
              {sparql && <SparqlPreview sparql={sparql} />}
              {results && <ResultsDisplay results={results} traceability={traceability} />}
            </div>
          )}
        </div>
      )}

      {/* Results always shown below the stepper */}
      {showGraphQLFeature && results && (
        <div className="mt-8 w-full max-w-4xl mx-auto">
          <ResultsDisplay results={results} traceability={traceability} />
        </div>
      )}

      {meta && (
        <div className="mt-4 text-xs text-gray-400 flex flex-col items-center gap-1">
          <div className="flex items-center gap-3">
            <span>{meta.matchCount} results</span>
            <span className="text-gray-300">·</span>
            <span>{meta.executionTimeMs}ms</span>
          </div>
          {meta.timings && meta.timings.length > 0 && (
            <details className="w-full max-w-md">
              <summary className="cursor-pointer text-gray-400 hover:text-gray-600 text-center">
                Pipeline breakdown
              </summary>
              <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[11px] font-mono bg-gray-50 rounded p-2">
                {meta.timings.map((t, i) => (
                  <span key={i} className="contents">
                    <span className="text-gray-500 truncate">{t.stage}</span>
                    <span className="text-right tabular-nums text-gray-700 font-medium">
                      {t.durationMs}ms
                    </span>
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
