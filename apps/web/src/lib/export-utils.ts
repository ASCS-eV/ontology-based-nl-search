/**
 * Export utilities for search results.
 *
 * Provides CSV and JSON-LD export with proper sanitization:
 * - CSV: OWASP formula-injection prevention via cell prefixing
 * - JSON-LD: nested references + lineage, IRI-scheme-agnostic @id
 *
 * @see https://owasp.org/www-community/attacks/CSV_Injection
 * @see https://www.w3.org/TR/json-ld11/
 */

/**
 * Compiler-internal traceability-step columns (chain intermediates `_refSlot…`
 * and data-path intermediates `…_step_<n>`). They hold blank-node IDs that are
 * meaningless to a consumer; the UI hides them and exports must too. Mirrors
 * `TRACE_VAR_PREFIX_RE` in ResultsDisplay.
 */
export function isInternalTraceColumn(key: string): boolean {
  return /(?:^_refSlot)|(?:_step_\d+$)/.test(key)
}

/**
 * Heuristic: does a value look like an IRI (has a URI scheme)? Recognizes any
 * scheme — `did:web:…`, `urn:…`, `https://…` — not just http(s), so `did:web`
 * asset identifiers are treated as IRIs (the previous http-only check silently
 * dropped them, producing JSON-LD with no `@id`). Requires `scheme:` followed
 * by a non-space, so literals like `"note: text"` or `"DE"` are not matched.
 */
export function isIriValue(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]/.test(value)
}

/**
 * Prevent CSV formula injection by prefixing dangerous leading characters.
 * Characters that spreadsheet apps interpret as formulas: = + - @ TAB CR LF
 */
export function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r\n]/.test(value)) {
    return `'${value}`
  }
  return value
}

/**
 * Convert result rows to CSV text with sanitized cells. Internal
 * traceability-step columns are dropped (callers should pass an already-clean
 * `columns` list, but we defend here too).
 */
export function resultsToCsv(results: Record<string, string>[], columns: string[]): string {
  const cols = columns.filter((c) => !isInternalTraceColumn(c))
  const header = cols.join(',')
  const rows = results.map((row) =>
    cols.map((col) => `"${sanitizeCsvCell(row[col] || '').replace(/"/g, '""')}"`).join(',')
  )
  return [header, ...rows].join('\n')
}

// ─── Structured JSON-LD model ────────────────────────────────────────────────

/** A referenced asset, with any nested references it carries (a chain). */
export interface ExportReference {
  asset: string
  name: string
  references: ExportReference[]
}

/** One primary result asset for export: its literal properties + reference tree. */
export interface ExportAsset {
  asset: string
  /** Literal / non-reference properties (name, country, …); no internal columns. */
  properties: Record<string, string>
  /** Directly-referenced assets (the query's JOINs), nested as a tree. */
  references: ExportReference[]
  /** Optional deduped reachable lineage (everything reachable downstream). */
  lineage?: ExportReference[]
}

/** Split an IRI into its namespace (up to the last `/` or `#`) for @context, or null. */
function namespaceOf(iri: string): string | null {
  if (!iri.startsWith('http://') && !iri.startsWith('https://')) return null
  const cut = Math.max(iri.lastIndexOf('/'), iri.lastIndexOf('#'))
  return cut > 8 ? iri.slice(0, cut + 1) : null
}

/** Collect every IRI value appearing across the export model (for @context). */
function collectIris(assets: ExportAsset[]): string[] {
  const iris: string[] = []
  const visitRef = (r: ExportReference): void => {
    if (isIriValue(r.asset)) iris.push(r.asset)
    r.references.forEach(visitRef)
  }
  for (const a of assets) {
    if (isIriValue(a.asset)) iris.push(a.asset)
    for (const v of Object.values(a.properties)) if (isIriValue(v)) iris.push(v)
    a.references.forEach(visitRef)
    a.lineage?.forEach(visitRef)
  }
  return iris
}

/** Build an http(s)-only @context (did:/urn: IRIs stay full as @id — no clean prefix). */
function buildContext(iris: string[]): Record<string, string> {
  const namespaces = new Map<string, string>()
  const used = new Set<string>()
  for (const iri of iris) {
    const ns = namespaceOf(iri)
    if (!ns || namespaces.has(ns)) continue
    const segments = new URL(ns).pathname.split('/').filter(Boolean)
    let prefix = (segments[segments.length - 1] ?? 'ns').replace(/[^a-zA-Z0-9]/g, '')
    const base = prefix
    let counter = 2
    while (used.has(prefix)) prefix = `${base}${counter++}`
    used.add(prefix)
    namespaces.set(ns, prefix)
  }
  const context: Record<string, string> = {}
  for (const [ns, prefix] of namespaces) context[prefix] = ns
  return context
}

/** Serialize a reference node to a nested JSON-LD object. */
function referenceNode(ref: ExportReference): Record<string, unknown> {
  const node: Record<string, unknown> = { '@id': ref.asset, name: ref.name }
  if (ref.references.length > 0) node['references'] = ref.references.map(referenceNode)
  return node
}

/**
 * Build a JSON-LD document from the structured export model. Each asset is a
 * node keyed by its IRI `@id` (any scheme), with literal properties, nested
 * `references`, and optional `lineage`. The `@context` maps http(s) namespaces
 * to short prefixes; non-http IRIs (e.g. `did:web:…`) remain full `@id`s.
 */
export function resultsToJsonLd(assets: ExportAsset[]): object {
  return {
    '@context': buildContext(collectIris(assets)),
    '@graph': assets.map((a) => {
      const node: Record<string, unknown> = { '@id': a.asset, ...a.properties }
      if (a.references.length > 0) node['references'] = a.references.map(referenceNode)
      if (a.lineage && a.lineage.length > 0) node['lineage'] = a.lineage.map(referenceNode)
      return node
    }),
  }
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
