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
  // Deduplicate by IRI so each distinct asset appears once (at its shallowest
  // path) and the count reflects distinct reachable assets — the raw tree is a
  // DAG flattened with repetition, which otherwise shows the same asset under
  // several paths with confusing ×N counts.
  const { tree, distinct } = dedupeLineage(node)
  const clusters = clusterEdgesByLabel(tree.references)
  return (
    <div className="px-4 py-3 bg-blue-50/50 border-t border-gray-100">
      <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
        <LinkIcon />
        Lineage ({distinct} distinct {distinct === 1 ? 'asset' : 'assets'} reachable)
      </p>
      <p className="text-[10px] text-blue-700/60 mb-2">
        Everything reachable by following references outward — deeper than the direct References
        above, each asset shown once at its shortest path.
      </p>
      <div className="flex flex-col gap-2">
        {clusters.map((cluster, i) => (
          <LineageBranch
            key={`${tree.asset}-${i}-${cluster.label}`}
            cluster={cluster}
            depth={1}
            parentName={tree.name || 'asset'}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Collapse the lineage DAG (returned as a tree with repeated nodes) so each
 * distinct asset IRI appears exactly once, at its SHALLOWEST path (BFS — a
 * directly-referenced asset wins over the same asset reached via an
 * intermediate). Returns the pruned tree plus the distinct reachable count.
 */
function dedupeLineage(root: TraceabilityNode): { tree: TraceabilityNode; distinct: number } {
  const seen = new Set<string>([root.asset])
  const prunedRoot: TraceabilityNode = { ...root, references: [] }
  const queue: Array<[TraceabilityNode, TraceabilityNode]> = [[root, prunedRoot]]
  while (queue.length > 0) {
    const [orig, pruned] = queue.shift()!
    for (const edge of orig.references) {
      const iri = edge.target.asset
      if (seen.has(iri)) continue
      seen.add(iri)
      const prunedChild: TraceabilityNode = { ...edge.target, references: [] }
      pruned.references.push({ predicatePath: edge.predicatePath, target: prunedChild })
      queue.push([edge.target, prunedChild])
    }
  }
  return { tree: prunedRoot, distinct: seen.size - 1 } // exclude the root asset itself
}

/**
 * A label-cluster of outgoing edges that share a display name and
 * predicate chain — analogous to the References-pill cluster in
 * `ResultsDisplay`. Collapsing by `target.name` keeps the lineage
 * tree readable when many siblings share the same `rdfs:label`
 * (common in our fixture's HD-Map tiles). The first cluster member
 * keeps its full nested subtree; siblings only contribute their IRI
 * to the `×N` hover list — their subtrees aren't shown twice.
 */
interface LineageEdgeCluster {
  label: string
  domain: string
  truncated: boolean
  predicatePath: string[]
  /** Distinct asset IRIs sharing this label at this level. */
  assets: string[]
  /** Subtree of the first cluster member — used when expanding the pill. */
  primaryTarget: TraceabilityNode
}

function clusterEdgesByLabel(edges: TraceabilityNode['references']): LineageEdgeCluster[] {
  const byKey = new Map<string, LineageEdgeCluster>()
  for (const edge of edges) {
    const t = edge.target
    // Cluster on (label, predicate-chain) so unrelated paths to a
    // similarly-named asset don't accidentally collapse.
    const key = `${t.name}|${edge.predicatePath.join('>')}`
    const existing = byKey.get(key)
    if (existing) {
      if (!existing.assets.includes(t.asset)) existing.assets.push(t.asset)
    } else {
      byKey.set(key, {
        label: t.name,
        domain: t.domain,
        truncated: t.truncated,
        predicatePath: edge.predicatePath,
        assets: [t.asset],
        primaryTarget: t,
      })
    }
  }
  return [...byKey.values()]
}

/**
 * One outgoing edge + recursive subtree, rendered with the same blue
 * pill + breadcrumb style as the existing References section. Depth
 * controls the indent rail; `parentName` surfaces a `↳ via …` hint on
 * nodes reached through an intermediate (depth ≥ 2) so the tree shape
 * stays readable even when many siblings share a label.
 */
function LineageBranch({
  cluster,
  depth,
  parentName,
}: {
  cluster: LineageEdgeCluster
  depth: number
  parentName: string
}) {
  const primary = cluster.primaryTarget
  const childClusters = clusterEdgesByLabel(primary.references)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span aria-hidden="true" className="text-blue-400 text-xs font-mono leading-none">
          ↳
        </span>
        <span
          className="inline-flex self-start items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-blue-100 text-blue-800 border border-blue-200"
          title={cluster.assets.join('\n')}
        >
          <MapIcon />
          {cluster.label}
          {cluster.domain && (
            <span className="text-[10px] text-blue-600/80 font-mono">({cluster.domain})</span>
          )}
          {cluster.assets.length > 1 && (
            <span className="text-[10px] text-blue-600/80 font-mono">×{cluster.assets.length}</span>
          )}
          {cluster.truncated && (
            <span className="text-[10px] text-blue-600/80 italic" title="Depth budget exhausted">
              more…
            </span>
          )}
        </span>
        {depth > 1 && (
          <span
            className="text-[10px] text-blue-600/70 italic"
            title="Reached through an intermediate asset"
          >
            via {parentName}
          </span>
        )}
      </div>
      <LineageBreadcrumb predicatePath={cluster.predicatePath} />
      {childClusters.length > 0 && (
        <div className="pl-5 ml-1 border-l-2 border-blue-300/70 flex flex-col gap-1.5 mt-1">
          {childClusters.map((childCluster, i) => (
            <LineageBranch
              key={`${primary.asset}-${i}-${childCluster.label}`}
              cluster={childCluster}
              depth={depth + 1}
              parentName={cluster.label || 'asset'}
            />
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
