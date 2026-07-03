import { Alert, Button, Heading, Pill } from '@ontology-search/design-system'
import { useState } from 'react'

import type { ResultTraceStep } from '../api-types'
import {
  downloadFile,
  isInternalTraceColumn,
  resultsToCsv,
  resultsToJsonLd,
} from '../lib/export-utils'
import { LineageExplorer } from './LineageExplorer'
import {
  attachLineage,
  clusterReferencesByLabel,
  countReferences,
  formatDid,
  formatValue,
  groupByAsset,
  type GroupedAsset,
  type GroupedReference,
  hasReferences,
  localName,
  type ResultsDisplayProps,
  toExportAssets,
} from './ResultsDisplay.helpers'

export function ResultsDisplay({ results, traceability }: ResultsDisplayProps) {
  if (results.length === 0) {
    return (
      <Alert tone="neutral" role="status" className="w-full text-center">
        <p className="font-medium text-gray-700">No results found for your query.</p>
        <p className="text-sm text-gray-500 mt-2">
          Try broadening your search — use fewer filters or more general terms. Check the
          interpretation above to see how your query was understood.
        </p>
      </Alert>
    )
  }

  // Drop compiler-internal breadcrumb-intermediate columns (blank-node IDs) from
  // every surface — they're hidden in the UI and must not leak into exports.
  const columns = Object.keys(results[0] ?? {}).filter((c) => !isInternalTraceColumn(c))

  const showCards = hasReferences(results)
  const grouped = showCards ? groupByAsset(results, traceability) : []

  const exportCsv = () => {
    const csv = resultsToCsv(results, columns)
    downloadFile(csv, 'search-results.csv', 'text/csv')
  }

  const exportJsonLd = async () => {
    const assets = toExportAssets(results, grouped)
    // Enrich with the deduped reachable lineage (best-effort) for reference
    // results — mirrors the per-card "Explore lineage" affordance.
    if (showCards) await attachLineage(assets)
    const jsonLd = resultsToJsonLd(assets)
    downloadFile(JSON.stringify(jsonLd, null, 2), 'search-results.jsonld', 'application/ld+json')
  }

  return (
    <div className="w-full" role="region" aria-label="Search results">
      <div className="flex items-center justify-between mb-3">
        <Heading level={2}>
          {showCards ? grouped.length : results.length}{' '}
          {(showCards ? grouped.length : results.length) === 1 ? 'match' : 'matches'}
        </Heading>
        <div className="flex gap-2">
          <Button
            onClick={exportCsv}
            variant="secondary"
            size="sm"
            ariaLabel="Export results as CSV"
          >
            ↓ CSV
          </Button>
          <Button
            onClick={exportJsonLd}
            variant="secondary"
            size="sm"
            ariaLabel="Export results as JSON-LD"
          >
            ↓ JSON-LD
          </Button>
        </div>
      </div>

      {showCards ? (
        <div className="space-y-3">
          {grouped.map((group) => (
            <AssetCard key={group.asset} group={group} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left font-medium text-gray-600 border-b border-gray-200"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2.5 border-b border-gray-100 text-gray-700">
                      {formatValue(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AssetCard({ group }: { group: GroupedAsset }) {
  const propertyEntries = Object.entries(group.properties)
  const [lineageOpen, setLineageOpen] = useState(false)

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900">{group.name}</h3>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{formatDid(group.asset)}</p>
        </div>
        <button
          onClick={() => setLineageOpen((open) => !open)}
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-md border border-emerald-200/70 transition-colors"
          aria-expanded={lineageOpen}
          aria-label={lineageOpen ? 'Hide lineage' : 'Explore lineage'}
        >
          {lineageOpen ? 'Hide lineage' : 'Explore lineage'}
        </button>
      </div>

      {propertyEntries.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-2">
          {propertyEntries.map(([key, value]) => (
            <Pill key={key} tone="neutral">
              <span className="font-medium text-gray-500">{key}:</span> {formatValue(value)}
            </Pill>
          ))}
        </div>
      )}

      {group.references.length > 0 && (
        <div className="px-4 py-3 bg-blue-50/50 border-t border-gray-100">
          <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
            <LinkIcon />
            References ({countReferences(group.references)})
          </p>
          <p className="text-[10px] text-blue-700/60 mb-2">
            Assets this result references to satisfy the query — the cross-reference JOINs the
            search matched on.
          </p>
          <ReferenceTree refs={group.references} rootLabel="asset" />
        </div>
      )}

      {lineageOpen && <LineageExplorer asset={group.asset} />}
    </div>
  )
}

/**
 * Recursively render a reference tree. A flat level (no nesting) keeps the
 * existing same-label clustering (map tiles collapse into one ×N pill). When a
 * level has nested children, each node renders individually with its children
 * indented under it, mirroring the graph chain (scenario → trace → map).
 * `rootLabel` is the breadcrumb root for this level — the primary `asset` at
 * the top, the parent reference's name one level down.
 */
function ReferenceTree({ refs, rootLabel }: { refs: GroupedReference[]; rootLabel: string }) {
  const anyNested = refs.some((r) => r.children.length > 0)

  if (!anyNested) {
    return (
      <div className="flex flex-col gap-2">
        {clusterReferencesByLabel(refs).map((cluster) => (
          <div key={cluster.label} className="flex flex-col gap-1">
            <ReferencePill
              label={cluster.label}
              title={cluster.assets.join('\n')}
              count={cluster.assets.length}
            />
            {cluster.trace && cluster.trace.length > 0 && (
              <TraceabilityBreadcrumb steps={cluster.trace} rootLabel={rootLabel} />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {refs.map((ref) => (
        <div key={ref.asset} className="flex flex-col gap-1">
          <ReferencePill label={ref.name} title={ref.asset} />
          {ref.trace && ref.trace.length > 0 && (
            <TraceabilityBreadcrumb steps={ref.trace} rootLabel={rootLabel} />
          )}
          {ref.children.length > 0 && (
            <div className="ml-3 pl-3 border-l-2 border-blue-200/60">
              <ReferenceTree refs={ref.children} rootLabel={ref.name} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** A single reference badge, optionally annotated with an `×N` same-label count. */
function ReferencePill({ label, title, count }: { label: string; title: string; count?: number }) {
  return (
    <span
      className="inline-flex self-start items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-blue-100 text-blue-800 border border-blue-200"
      title={title}
    >
      <MapIcon />
      {label}
      {count !== undefined && count > 1 && (
        <span className="text-[10px] text-blue-600/80 font-mono">×{count}</span>
      )}
    </span>
  )
}

/**
 * Render the predicate-chain breadcrumb from `rootLabel` down to a referenced
 * child. Shows each predicate's localName; the full IRI is in the `title` for
 * hover inspection.
 */
function TraceabilityBreadcrumb({
  steps,
  rootLabel = 'asset',
}: {
  steps: ResultTraceStep[]
  rootLabel?: string
}) {
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[10px] text-blue-700/80 font-mono">
      <li className="px-1 py-0.5 rounded bg-white/60 border border-blue-100">{rootLabel}</li>
      {steps.map((step, i) => {
        const local = localName(step.predicate)
        return (
          <li key={i} className="flex items-center gap-1">
            <span aria-hidden="true">→</span>
            <span
              className="px-1 py-0.5 rounded bg-white/60 border border-blue-100"
              title={step.predicate}
            >
              {local}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function LinkIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
      />
    </svg>
  )
}
