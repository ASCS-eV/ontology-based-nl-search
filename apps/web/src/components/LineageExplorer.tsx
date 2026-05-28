import { useEffect, useState } from 'react'

import type { TraceabilityNode, TraceabilityResponse } from '../api-types'

interface LineageExplorerProps {
  /** Asset IRI to root the lineage walk at. */
  asset: string
  /** Recursion depth budget (default mirrors the server default of 3). */
  depth?: number
}

/**
 * Per-row "Explore lineage" affordance (WP3, task #19).
 *
 * Fetches `GET /api/traceability?asset=<iri>&depth=N` and renders the
 * outgoing-reference tree as nested **blue reference pills** — the same
 * visual language the AssetCard's "References" section already uses for
 * one-hop JOIN matches. The graph already carries the `@id` references;
 * this component just walks and displays them, with no new UI vocabulary
 * for the user to learn.
 *
 * The lineage tree is a *deeper* version of the References section, not
 * a competing visualisation: each child pill is rendered with the same
 * `MapIcon` + name styling, and the predicate chain between parent and
 * child reuses the {@link TraceabilityBreadcrumb}-style display from
 * task #18 (rendered inline below the parent pill).
 */
export function LineageExplorer({ asset, depth }: LineageExplorerProps) {
  const [node, setNode] = useState<TraceabilityNode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setNode(null)

    const params = new URLSearchParams({ asset })
    if (depth !== undefined) params.set('depth', String(depth))

    fetch(`/api/traceability?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string
            message?: string
          } | null
          throw new Error(body?.error ?? body?.message ?? `HTTP ${res.status}`)
        }
        return (await res.json()) as TraceabilityResponse
      })
      .then((body) => {
        setNode(body.node)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load lineage')
        setLoading(false)
      })

    return () => controller.abort()
  }, [asset, depth])

  if (loading) {
    return (
      <div className="px-4 py-3 bg-blue-50/50 border-t border-gray-100">
        <p className="text-xs text-blue-700/80 italic" role="status">
          Loading lineage…
        </p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="px-4 py-3 bg-blue-50/50 border-t border-gray-100">
        <p className="text-xs text-red-600" role="alert">
          Lineage unavailable: {error}
        </p>
      </div>
    )
  }
  if (!node || node.references.length === 0) {
    return (
      <div className="px-4 py-3 bg-blue-50/50 border-t border-gray-100">
        <p className="text-xs text-blue-700/80 italic">No outgoing references in the graph.</p>
      </div>
    )
  }
  return (
    <div className="px-4 py-3 bg-blue-50/50 border-t border-gray-100">
      <p className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
        <LinkIcon />
        Lineage ({countReferences(node)} reachable)
      </p>
      <div className="flex flex-col gap-2">
        {node.references.map((edge, i) => (
          <LineageBranch key={`${node.asset}-${i}`} edge={edge} />
        ))}
      </div>
    </div>
  )
}

/**
 * One outgoing edge + recursive subtree, rendered with the same blue
 * pill + breadcrumb style as the existing References section.
 */
function LineageBranch({ edge }: { edge: TraceabilityNode['references'][number] }) {
  const target = edge.target
  return (
    <div className="flex flex-col gap-1">
      <span
        className="inline-flex self-start items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-blue-100 text-blue-800 border border-blue-200"
        title={target.asset}
      >
        <MapIcon />
        {target.name}
        {target.domain && (
          <span className="text-[10px] text-blue-600/80 font-mono">({target.domain})</span>
        )}
        {target.truncated && (
          <span className="text-[10px] text-blue-600/80 italic" title="Depth budget exhausted">
            more…
          </span>
        )}
      </span>
      <LineageBreadcrumb predicatePath={edge.predicatePath} />
      {target.references.length > 0 && (
        <div className="pl-4 border-l border-blue-200/60 flex flex-col gap-1">
          {target.references.map((childEdge, i) => (
            <LineageBranch key={`${target.asset}-${i}`} edge={childEdge} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Predicate-chain breadcrumb between parent and child. Same shape as
 * the task #18 `TraceabilityBreadcrumb` so a row that has BOTH the
 * filter-matched single hop and the lineage walk reads consistently.
 */
function LineageBreadcrumb({ predicatePath }: { predicatePath: string[] }) {
  if (predicatePath.length === 0) return null
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[10px] text-blue-700/80 font-mono">
      {predicatePath.map((predicate, i) => (
        <li key={i} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden="true">→</span>}
          <span
            className="px-1 py-0.5 rounded bg-white/60 border border-blue-100"
            title={predicate}
          >
            {predicateLocalName(predicate)}
          </span>
        </li>
      ))}
    </ol>
  )
}

function countReferences(node: TraceabilityNode): number {
  let n = 0
  for (const edge of node.references) {
    n += 1 + countReferences(edge.target)
  }
  return n
}

function predicateLocalName(iri: string): string {
  const hash = iri.lastIndexOf('#')
  const slash = iri.lastIndexOf('/')
  const cut = Math.max(hash, slash)
  return cut >= 0 ? iri.slice(cut + 1) : iri
}

/* — icons (kept inline so the lineage view doesn't depend on the
   ResultsDisplay module while still matching its styling). */
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
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.553 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m-6 3l6-3m0 13V4"
      />
    </svg>
  )
}
