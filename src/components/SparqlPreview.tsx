'use client'

import { useState } from 'react'

interface SparqlPreviewProps {
  sparql: string
}

export function SparqlPreview({ sparql }: SparqlPreviewProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-6 w-full max-w-2xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
      >
        <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
        {expanded ? 'Hide' : 'Show'} generated SPARQL query
      </button>
      {expanded && (
        <pre className="mt-2 p-4 bg-gray-900 text-green-300 rounded-lg text-sm overflow-x-auto font-mono">
          {sparql}
        </pre>
      )}
    </div>
  )
}
