'use client'

import { useState } from 'react'

interface SparqlPreviewProps {
  sparql: string
}

export function SparqlPreview({ sparql }: SparqlPreviewProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sparql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-4 w-full">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
        aria-expanded={expanded}
        aria-controls="sparql-preview"
      >
        <span className={`transition-transform inline-block ${expanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
        {expanded ? 'Hide' : 'Show'} generated SPARQL query
      </button>
      {expanded && (
        <div id="sparql-preview" className="relative mt-2">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            aria-label="Copy SPARQL query"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <pre className="p-4 bg-gray-900 text-green-300 rounded-lg text-sm overflow-x-auto font-mono leading-relaxed">
            {sparql}
          </pre>
        </div>
      )}
    </div>
  )
}
