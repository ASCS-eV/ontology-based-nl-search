/**
 * ResultsDisplay logic helpers (ADR 0003) — pure grouping/clustering/export and
 * reference-column parsing for the search results view, plus the data shapes the
 * components render. No JSX/React; consumed by `./ResultsDisplay.tsx`.
 */
import type { ResultTraceStep, RowTraceability } from '../api-types'
import { type ExportAsset, type ExportReference, isInternalTraceColumn } from '../lib/export-utils'
import { dedupeLineage, fetchLineageTree, lineageToExportReferences } from '../lib/lineage'

/** Bounded-concurrency lineage enrichment for export (best-effort per asset). */
export async function attachLineage(assets: ExportAsset[]): Promise<void> {
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

export interface ResultsDisplayProps {
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
export function hasReferences(results: Record<string, string>[]): boolean {
  return results.some((r) => Object.keys(r).some((k) => REF_ASSET_RE.test(k) && r[k]))
}

export interface GroupedReference {
  asset: string
  name: string
  /** Predicate-IRI chain the SPARQL JOIN walked from this ref's parent. */
  trace?: ResultTraceStep[]
  /** Nested references the referenced asset itself carries (chain one hop deeper). */
  children: GroupedReference[]
}

/** Total reference nodes across the tree (all depths). */
export function countReferences(refs: GroupedReference[]): number {
  return refs.reduce((n, r) => n + 1 + countReferences(r.children), 0)
}

export interface GroupedAsset {
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

export function clusterReferencesByLabel(refs: GroupedReference[]): ReferenceLabelCluster[] {
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
export function groupByAsset(
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
export function toExportAssets(
  results: Record<string, string>[],
  grouped: GroupedAsset[]
): ExportAsset[] {
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

/** Extract the local name suffix of an IRI for compact display. */
export function localName(iri: string): string {
  const hash = iri.lastIndexOf('#')
  const slash = iri.lastIndexOf('/')
  const cut = Math.max(hash, slash)
  return cut >= 0 ? iri.slice(cut + 1) : iri
}

export function formatDid(did: string): string {
  if (did.startsWith('did:web:')) {
    return did.replace('did:web:', '').replace(/:/g, '/')
  }
  return did
}

export function formatValue(value: unknown): string {
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
