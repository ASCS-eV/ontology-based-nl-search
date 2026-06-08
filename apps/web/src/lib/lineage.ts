/**
 * Shared lineage helpers used by both the interactive LineageExplorer and the
 * JSON-LD export. Keeps the dedupe rule and the fetch in one place so the two
 * surfaces can't drift.
 */
import type { TraceabilityNode, TraceabilityResponse } from '../api-types'
import { apiGet, isAbortError } from './api-client'
import type { ExportReference } from './export-utils'

/**
 * Collapse the lineage DAG (returned as a tree with repeated nodes) so each
 * distinct asset IRI appears exactly once, at its SHALLOWEST path (BFS — a
 * directly-referenced asset wins over the same asset reached via an
 * intermediate). Returns the pruned tree plus the distinct reachable count.
 */
export function dedupeLineage(root: TraceabilityNode): {
  tree: TraceabilityNode
  distinct: number
} {
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
 * Best-effort fetch of an asset's lineage tree. Returns `null` on any failure
 * (offline, non-2xx, abort) so callers — notably the bulk export — degrade
 * gracefully rather than failing the whole operation for one asset.
 */
export async function fetchLineageTree(
  asset: string,
  depth?: number,
  signal?: AbortSignal
): Promise<TraceabilityNode | null> {
  try {
    const params = new URLSearchParams({ asset })
    if (depth !== undefined) params.set('depth', String(depth))
    const body = await apiGet<TraceabilityResponse>(
      `/api/traceability?${params.toString()}`,
      signal
    )
    return body.node ?? null
  } catch (err: unknown) {
    if (isAbortError(err)) return null

    console.warn('[lineage] Failed to fetch lineage tree', { asset, error: String(err) })
    return null
  }
}

/** Map a (deduped) lineage tree's outgoing edges to the export reference shape. */
export function lineageToExportReferences(node: TraceabilityNode): ExportReference[] {
  return node.references.map((edge) => ({
    asset: edge.target.asset,
    name: edge.target.name,
    references: lineageToExportReferences(edge.target),
  }))
}
