interface ResultsDisplayProps {
  results: Record<string, unknown>[]
}

export function ResultsDisplay({ results }: ResultsDisplayProps) {
  if (results.length === 0) {
    return (
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 max-w-2xl w-full">
        No results found for your query.
      </div>
    )
  }

  const columns = Object.keys(results[0])

  return (
    <div className="mt-6 w-full max-w-4xl overflow-x-auto">
      <h2 className="text-lg font-semibold mb-3">
        Results ({results.length} {results.length === 1 ? 'match' : 'matches'})
      </h2>
      <table className="w-full border-collapse border border-gray-200 dark:border-gray-700 text-sm">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800">
            {columns.map((col) => (
              <th key={col} className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {columns.map((col) => (
                <td key={col} className="border border-gray-200 dark:border-gray-700 px-3 py-2">
                  {formatValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') {
    // Shorten URIs for display
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const parts = value.split(/[#/]/)
      return parts[parts.length - 1] || value
    }
    return value
  }
  return String(value)
}
