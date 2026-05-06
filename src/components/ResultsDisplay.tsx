'use client'

interface ResultsDisplayProps {
  results: Record<string, string>[]
}

export function ResultsDisplay({ results }: ResultsDisplayProps) {
  if (results.length === 0) {
    return (
      <div
        className="mt-6 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg max-w-2xl w-full text-center"
        role="status"
      >
        <p className="text-yellow-700 dark:text-yellow-300 font-medium">
          No results found for your query.
        </p>
        <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
          Try broadening your search — use fewer filters or more general terms.
          Check the interpretation above to see how your query was understood.
        </p>
      </div>
    )
  }

  const columns = Object.keys(results[0])

  const exportCsv = () => {
    const header = columns.join(',')
    const rows = results.map((row) =>
      columns.map((col) => `"${(row[col] || '').replace(/"/g, '""')}"`).join(','),
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
    downloadFile(
      JSON.stringify(jsonLd, null, 2),
      'search-results.jsonld',
      'application/ld+json',
    )
  }

  return (
    <div className="mt-6 w-full max-w-4xl" role="region" aria-label="Search results">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">
          {results.length} {results.length === 1 ? 'match' : 'matches'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
            aria-label="Export results as CSV"
          >
            ↓ CSV
          </button>
          <button
            onClick={exportJsonLd}
            className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
            aria-label="Export results as JSON-LD"
          >
            ↓ JSON-LD
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300"
                  >
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
