import { useState } from 'react'

import type { ResultTraceStep } from '../api-types'
import { downloadFile, resultsToCsv, resultsToJsonLd } from '../lib/export-utils'
import { LineageExplorer } from './LineageExplorer'

interface ResultsDisplayProps {
  results: Record<string, string>[]
  /**
   * Per-row traceability breadcrumb, aligned by index with `results`.
   * When present, each reference badge gets an expandable predicate-chain
   * breadcrumb showing the graph path the JOIN walked (WP3, task #18).
   */
  traceability?: ResultTraceStep[][] | null
}

/** Columns that represent cross-references (hidden from main display, shown in References section) */
const REF_COLUMNS = new Set(['refAsset', 'refName'])
/**
 * Variables the compiler binds for traceability-step intermediates. These
 * are infrastructure rows; the user sees the predicate breadcrumb in the
 * "References" section, not as plain columns next to user-meaningful
 * fields like `name` / `country`.
 */
const TRACE_VAR_PREFIX_RE = /^(?:ref_step_|_refSlot_)/

/** Check whether results contain cross-reference data */
function hasReferences(results: Record<string, string>[]): boolean {
  return results.some((r) => r['refAsset'] || r['refName'])
}

interface GroupedReference {
  asset: string
  name: string
  /** Predicate-IRI chain the SPARQL JOIN walked from the primary asset. */
  trace?: ResultTraceStep[]
}

interface GroupedAsset {
  asset: string
  name: string
  properties: Record<string, string>
  references: GroupedReference[]
}

/** Group flat rows by primary asset, collecting references per group */
function groupByAsset(
  results: Record<string, string>[],
  traceability?: ResultTraceStep[][] | null
): GroupedAsset[] {
  const groups = new Map<string, GroupedAsset>()

  for (let i = 0; i < results.length; i++) {
    const row = results[i]!
    const trace = traceability?.[i]
    const key = row['asset'] ?? ''
    if (!groups.has(key)) {
      const properties: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) {
        if (REF_COLUMNS.has(k) || k === 'asset' || k === 'name' || !v) continue
        if (TRACE_VAR_PREFIX_RE.test(k)) continue
        properties[k] = v
      }
      groups.set(key, {
        asset: key,
        name: row['name'] ?? key,
        properties,
        references: [],
      })
    }
    const group = groups.get(key)!
    if (row['refAsset'] && row['refName']) {
      const alreadyAdded = group.references.some((r) => r.asset === row['refAsset'])
      if (!alreadyAdded) {
        group.references.push({
          asset: row['refAsset'],
          name: row['refName'],
          trace: trace && trace.length > 0 ? trace : undefined,
        })
      }
    }
  }

  return [...groups.values()]
}

export function ResultsDisplay({ results, traceability }: ResultsDisplayProps) {
  if (results.length === 0) {
    return (
      <div
        className="p-6 bg-gray-50 border border-gray-200 rounded-lg w-full text-center"
        role="status"
      >
        <p className="text-gray-700 font-medium">No results found for your query.</p>
        <p className="text-sm text-gray-500 mt-2">
          Try broadening your search — use fewer filters or more general terms. Check the
          interpretation above to see how your query was understood.
        </p>
      </div>
    )
  }

  const columns = Object.keys(results[0] ?? {})

  const exportCsv = () => {
    const csv = resultsToCsv(results, columns)
    downloadFile(csv, 'search-results.csv', 'text/csv')
  }

  const exportJsonLd = () => {
    const jsonLd = resultsToJsonLd(results)
    downloadFile(JSON.stringify(jsonLd, null, 2), 'search-results.jsonld', 'application/ld+json')
  }

  const showCards = hasReferences(results)
  const grouped = showCards ? groupByAsset(results, traceability) : []

  return (
    <div className="w-full" role="region" aria-label="Search results">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">
          {showCards ? grouped.length : results.length}{' '}
          {(showCards ? grouped.length : results.length) === 1 ? 'match' : 'matches'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            aria-label="Export results as CSV"
          >
            ↓ CSV
          </button>
          <button
            onClick={exportJsonLd}
            className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            aria-label="Export results as JSON-LD"
          >
            ↓ JSON-LD
          </button>
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
            <span
              key={key}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600"
            >
              <span className="font-medium text-gray-500">{key}:</span>
              {formatValue(value)}
            </span>
          ))}
        </div>
      )}

      {group.references.length > 0 && (
        <div className="px-4 py-3 bg-blue-50/50 border-t border-gray-100">
          <p className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
            <LinkIcon />
            References ({group.references.length})
          </p>
          <div className="flex flex-col gap-2">
            {group.references.map((ref) => (
              <div key={ref.asset} className="flex flex-col gap-1">
                <span
                  className="inline-flex self-start items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-blue-100 text-blue-800 border border-blue-200"
                  title={ref.asset}
                >
                  <MapIcon />
                  {ref.name}
                </span>
                {ref.trace && ref.trace.length > 0 && <TraceabilityBreadcrumb steps={ref.trace} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {lineageOpen && <LineageExplorer asset={group.asset} />}
    </div>
  )
}

/**
 * Render the predicate-chain breadcrumb from the primary asset down to a
 * referenced child. Shows each predicate's localName; the full IRI is in
 * the `title` for hover inspection (WP3, task #18).
 */
function TraceabilityBreadcrumb({ steps }: { steps: ResultTraceStep[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[10px] text-blue-700/80 font-mono">
      <li className="px-1 py-0.5 rounded bg-white/60 border border-blue-100">asset</li>
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

/** Extract the local name suffix of an IRI for compact display. */
function localName(iri: string): string {
  const hash = iri.lastIndexOf('#')
  const slash = iri.lastIndexOf('/')
  const cut = Math.max(hash, slash)
  return cut >= 0 ? iri.slice(cut + 1) : iri
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

function formatDid(did: string): string {
  if (did.startsWith('did:web:')) {
    return did.replace('did:web:', '').replace(/:/g, '/')
  }
  return did
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const parts = value.split(/[#/]/)
      return parts[parts.length - 1] || value
    }
    return value
  }
  return String(value)
}
