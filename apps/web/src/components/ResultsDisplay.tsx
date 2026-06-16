import { Alert, Button, Heading, Pill } from '@ontology-search/design-system'
import { useState } from 'react'

import type { ResultTraceStep, RowTraceability } from '../api-types'
import type { ExportAsset, ExportReference } from '../lib/export-utils'
import {
  downloadFile,
  isInternalTraceColumn,
  resultsToCsv,
  resultsToJsonLd,
} from '../lib/export-utils'
import { dedupeLineage, fetchLineageTree, lineageToExportReferences } from '../lib/lineage'
import { LineageExplorer } from './LineageExplorer'

/** Bounded-concurrency lineage enrichment for export (best-effort per asset). */
async function attachLineage(assets: ExportAsset[]): Promise<void> {
  const CONCURRENCY = 6
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < assets.length) {
      const asset = assets[next++]!
      const node = await fetchLineageTree(asset.asset)
      if (!node) continue
      const refs = lineageToExportReferences(dedupeLineage(node).tree)
      if (refs.length > 0) asset.lineage = refs
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, assets.length) }, worker))
}

interface ResultsDisplayProps {
  results: Record<string, string>[]
  /**
   * Per-row traceability, aligned by index with `results`. Each entry maps a
   * referenced-asset variable (`refAsset`, `refAsset1`, …) to that reference's
   * predicate-chain breadcrumb, so every reference badge — not just the first —
   * gets the graph path the JOIN walked.
   */
  traceability?: RowTraceability[] | null
}

/**
 * Cross-reference columns the compiler projects. Depth-0 references are
 * `refAsset`/`refName`, then `refAsset1`/`refName1`, …; a NESTED reference (a
 * chain — e.g. trace → map) appends `_<index>`: `refAsset_0`/`refName_0`,
 * `refAsset_0_0`/…. These are hidden from the main column display and shown in
 * the References section instead.
 */
const REF_ASSET_RE = /^refAsset(\d*(?:_\d+)*)$/
const REF_NAME_RE = /^refName(\d*(?:_\d+)*)$/
function isRefColumn(key: string): boolean {
  return REF_ASSET_RE.test(key) || REF_NAME_RE.test(key)
}
/**
 * The parent reference variable of a nested ref var, or `null` for a depth-0
 * root. The compiler's path-suffix naming makes the parent the var with its
 * trailing `_<index>` removed: `refAsset_0` → `refAsset`, `refAsset1_0` →
 * `refAsset1`, `refAsset_0_0` → `refAsset_0`. Depth-0 siblings (`refAsset`,
 * `refAsset1`) have no `_<index>` tail and are roots.
 */
function parentRefVar(refVar: string): string | null {
  const m = /^(.*)_\d+$/.exec(refVar)
  return m ? m[1]! : null
}
/**
 * Variables the compiler binds for traceability-step intermediates. Chain
 * intermediates start with `_refSlot` (`_refSlot_0`, `_refSlot_0_1`, …);
 * data-path intermediates end with `_step_<n>` (`ref_step_1`, `ref_0_step_2`,
 * …). Both are infrastructure columns hidden from the property grid.
 */
const TRACE_VAR_PREFIX_RE = /(?:^_refSlot)|(?:_step_\d+$)/

/** Check whether results contain cross-reference data */
function hasReferences(results: Record<string, string>[]): boolean {
  return results.some((r) => Object.keys(r).some((k) => REF_ASSET_RE.test(k) && r[k]))
}

interface GroupedReference {
  asset: string
  name: string
  /** Predicate-IRI chain the SPARQL JOIN walked from this ref's parent. */
  trace?: ResultTraceStep[]
  /** Nested references the referenced asset itself carries (chain one hop deeper). */
  children: GroupedReference[]
}

/** Total reference nodes across the tree (all depths). */
function countReferences(refs: GroupedReference[]): number {
  return refs.reduce((n, r) => n + 1 + countReferences(r.children), 0)
}

interface GroupedAsset {
  asset: string
  name: string
  properties: Record<string, string>
  references: GroupedReference[]
}

/**
 * Cluster of references sharing a display label. The fixture (and
 * real-world data) often points one asset at multiple physical
 * resources that carry an identical `rdfs:label` — e.g. several map
 * tiles all labelled "Cologne Motorway HD Map". Rendering each as a
 * separate pill bloats the card; collapsing by label with a `×N`
 * count keeps the surface scannable while preserving every IRI in
 * the pill's `title` attribute for hover inspection.
 */
interface ReferenceLabelCluster {
  label: string
  /** Distinct asset IRIs that all share this label. */
  assets: string[]
  /** Predicate breadcrumb from the parent — identical across cluster members by construction. */
  trace?: ResultTraceStep[]
}

function clusterReferencesByLabel(refs: GroupedReference[]): ReferenceLabelCluster[] {
  const byLabel = new Map<string, ReferenceLabelCluster>()
  for (const ref of refs) {
    const existing = byLabel.get(ref.name)
    if (existing) {
      if (!existing.assets.includes(ref.asset)) existing.assets.push(ref.asset)
    } else {
      byLabel.set(ref.name, {
        label: ref.name,
        assets: [ref.asset],
        trace: ref.trace,
      })
    }
  }
  return [...byLabel.values()]
}

interface GroupBuilder {
  asset: string
  name: string
  properties: Record<string, string>
  /** Reference nodes by their asset IRI (deduped across rows). */
  nodes: Map<string, GroupedReference>
  /** childIri → parentIri (null = depth-0 root), captured per row. */
  parentOf: Map<string, string | null>
}

/**
 * Group flat rows by primary asset and assemble the reference tree. Each ref
 * column contributes a node; its parent is the value of its parent column in
 * the SAME row (so a nested map attaches to the specific trace it hangs off,
 * not to some other trace the scenario references).
 */
function groupByAsset(
  results: Record<string, string>[],
  traceability?: RowTraceability[] | null
): GroupedAsset[] {
  const builders = new Map<string, GroupBuilder>()

  for (let i = 0; i < results.length; i++) {
    const row = results[i]!
    const rowTrace = traceability?.[i]
    const key = row['asset'] ?? ''
    let builder = builders.get(key)
    if (!builder) {
      const properties: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) {
        if (isRefColumn(k) || k === 'asset' || k === 'name' || !v) continue
        if (TRACE_VAR_PREFIX_RE.test(k)) continue
        properties[k] = v
      }
      builder = {
        asset: key,
        name: row['name'] ?? key,
        properties,
        nodes: new Map(),
        parentOf: new Map(),
      }
      builders.set(key, builder)
    }
    // Each projected ref column (refAsset, refAsset1, refAsset_0, …) → a node.
    for (const [k, v] of Object.entries(row)) {
      const match = REF_ASSET_RE.exec(k)
      if (!match || !v) continue
      const name = row[`refName${match[1]}`]
      if (!name) continue
      if (!builder.nodes.has(v)) {
        const steps = rowTrace?.[k] // breadcrumb keyed by this node's column
        builder.nodes.set(v, {
          asset: v,
          name,
          trace: steps && steps.length > 0 ? steps : undefined,
          children: [],
        })
      }
      if (!builder.parentOf.has(v)) {
        const parentColumn = parentRefVar(k)
        builder.parentOf.set(v, parentColumn ? (row[parentColumn] ?? null) : null)
      }
    }
  }

  // Link children to parents by IRI; depth-0 nodes become the group's roots.
  return [...builders.values()].map((b) => {
    const roots: GroupedReference[] = []
    for (const [iri, node] of b.nodes) {
      const parentIri = b.parentOf.get(iri) ?? null
      const parent = parentIri ? b.nodes.get(parentIri) : undefined
      if (parent && parent !== node) {
        if (!parent.children.some((c) => c.asset === node.asset)) parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return { asset: b.asset, name: b.name, properties: b.properties, references: roots }
  })
}

/** Map a grouped reference subtree to the export shape (recursive). */
function toExportReference(ref: GroupedReference): ExportReference {
  return { asset: ref.asset, name: ref.name, references: ref.children.map(toExportReference) }
}

/**
 * Build the structured export model. When references are present we serialize
 * the grouped tree (one node per primary asset, references nested); otherwise
 * each flat row becomes one asset with its literal properties. Internal
 * trace-step and reference columns never become plain properties.
 */
function toExportAssets(results: Record<string, string>[], grouped: GroupedAsset[]): ExportAsset[] {
  if (grouped.length > 0) {
    return grouped.map((g) => ({
      asset: g.asset,
      properties: { name: g.name, ...g.properties },
      references: g.references.map(toExportReference),
    }))
  }
  return results.map((row) => {
    const properties: Record<string, string> = {}
    for (const [k, v] of Object.entries(row)) {
      if (k === 'asset' || !v) continue
      if (isInternalTraceColumn(k) || isRefColumn(k)) continue
      properties[k] = v
    }
    return { asset: row['asset'] ?? '', properties, references: [] }
  })
}

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
