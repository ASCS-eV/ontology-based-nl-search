/**
 * Export utilities for search results.
 *
 * Provides CSV and JSON-LD export with proper sanitization:
 * - CSV: OWASP formula-injection prevention via cell prefixing
 * - JSON-LD: Minimal context derived from result URIs (ontology-agnostic)
 *
 * @see https://owasp.org/www-community/attacks/CSV_Injection
 * @see https://www.w3.org/TR/json-ld11/
 */

/**
 * Prevent CSV formula injection by prefixing dangerous leading characters.
 * Characters that spreadsheet apps interpret as formulas: = + - @ TAB CR
 */
export function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`
  }
  return value
}

/**
 * Convert result rows to CSV text with sanitized cells.
 */
export function resultsToCsv(results: Record<string, string>[], columns: string[]): string {
  const header = columns.join(',')
  const rows = results.map((row) =>
    columns.map((col) => `"${sanitizeCsvCell(row[col] || '').replace(/"/g, '""')}"`).join(',')
  )
  return [header, ...rows].join('\n')
}

/**
 * Build a minimal JSON-LD document from search results.
 *
 * The @context is derived from URI values found in the results rather than
 * hard-coding ontology-specific namespaces. This keeps the export
 * ontology-agnostic while still producing valid JSON-LD.
 */
export function resultsToJsonLd(results: Record<string, string>[]): object {
  // Discover namespace prefixes from URI values in the results
  const namespaces = new Map<string, string>()
  for (const row of results) {
    for (const value of Object.values(row)) {
      if (value.startsWith('https://') || value.startsWith('http://')) {
        const lastSlash = value.lastIndexOf('/')
        const lastHash = value.lastIndexOf('#')
        const splitIdx = Math.max(lastSlash, lastHash)
        if (splitIdx > 8) {
          const ns = value.slice(0, splitIdx + 1)
          if (!namespaces.has(ns)) {
            // Derive a short prefix from the namespace path
            const pathSegments = new URL(ns).pathname.split('/').filter(Boolean)
            const prefix = pathSegments[pathSegments.length - 1] ?? 'ns'
            namespaces.set(ns, prefix.replace(/[^a-zA-Z0-9]/g, ''))
          }
        }
      }
    }
  }

  const context: Record<string, string> = {}
  for (const [ns, prefix] of namespaces) {
    context[prefix] = ns
  }

  return {
    '@context': context,
    '@graph': results.map((row) => {
      const entry: Record<string, string> = {}
      for (const [key, value] of Object.entries(row)) {
        if (value.startsWith('http://') || value.startsWith('https://')) {
          entry['@id'] = value
        } else {
          entry[key] = value
        }
      }
      return entry
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
