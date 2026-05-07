'use client'

interface ResultsDisplayProps {
  results: Record<string, string>[]
}

export function ResultsDisplay({ results }: ResultsDisplayProps) {
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
    const header = columns.join(',')
    const rows = results.map((row) =>
      columns.map((col) => `"${(row[col] || '').replace(/"/g, '""')}"`).join(',')
    )
    const csv = [header, ...rows].join('\n')
    downloadFile(csv, 'search-results.csv', 'text/csv')
  }

  const exportJsonLd = () => {
    const jsonLd = {
      '@context': {
        hdmap: 'https://w3id.org/ascs-ev/envited-x/hdmap/v6/',
        georeference: 'https://w3id.org/ascs-ev/envited-x/georeference/v5/',
      },
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
    downloadFile(JSON.stringify(jsonLd, null, 2), 'search-results.jsonld', 'application/ld+json')
  }

  return (
    <div className="w-full" role="region" aria-label="Search results">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">
          {results.length} {results.length === 1 ? 'match' : 'matches'}
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
    </div>
  )
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

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
