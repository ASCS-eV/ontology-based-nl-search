'use client'

import { useState } from 'react'

import type { MappedTerm } from '@/lib/llm/types'

interface QueryRefinementProps {
  mappedTerms: MappedTerm[]
  onRerun: (updatedTerms: MappedTerm[]) => void
  loading?: boolean
}

/**
 * Editable chips for the interpreted query terms.
 * Users can remove terms or edit values, then re-run directly.
 */
export function QueryRefinement({ mappedTerms, onRerun, loading }: QueryRefinementProps) {
  const [terms, setTerms] = useState<MappedTerm[]>(mappedTerms)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const hasChanges = JSON.stringify(terms) !== JSON.stringify(mappedTerms)

  const removeTerm = (idx: number) => {
    setTerms(terms.filter((_, i) => i !== idx))
  }

  const startEdit = (idx: number) => {
    const term = terms[idx]
    if (!term) return
    setEditingIdx(idx)
    setEditValue(term.mapped)
  }

  const confirmEdit = () => {
    if (editingIdx === null) return
    const updated = [...terms]
    const target = updated[editingIdx]
    if (target && editValue.trim()) {
      updated[editingIdx] = { ...target, mapped: editValue.trim(), confidence: 'medium' }
      setTerms(updated)
    }
    setEditingIdx(null)
    setEditValue('')
  }

  const cancelEdit = () => {
    setEditingIdx(null)
    setEditValue('')
  }

  const handleRerun = () => {
    onRerun(terms)
  }

  if (terms.length === 0) return null

  return (
    <div className="w-full" role="region" aria-label="Refine query">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Refine filters
        </h3>
        {hasChanges && <span className="text-xs text-blue-600 font-medium">Modified</span>}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {terms.map((term, i) => (
          <div
            key={`${term.property}-${i}`}
            className="group inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-sm shadow-sm hover:shadow transition-shadow"
          >
            {term.property && (
              <span className="text-xs text-gray-400 font-mono">{term.property}:</span>
            )}

            {editingIdx === i ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmEdit()
                  if (e.key === 'Escape') cancelEdit()
                }}
                onBlur={confirmEdit}
                className="w-24 px-1 py-0 text-sm border-b border-blue-400 outline-none bg-transparent"
                autoFocus
                aria-label={`Edit value for ${term.property || term.input}`}
              />
            ) : (
              <button
                onClick={() => startEdit(i)}
                className="font-medium text-gray-800 hover:text-blue-600 cursor-pointer"
                title="Click to edit"
                aria-label={`Edit ${term.mapped}`}
              >
                {term.mapped}
              </button>
            )}

            <button
              onClick={() => removeTerm(i)}
              className="ml-0.5 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove ${term.mapped} filter`}
              title="Remove filter"
            >
              ×
            </button>
          </div>
        ))}

        {hasChanges && (
          <button
            onClick={handleRerun}
            disabled={loading || terms.length === 0}
            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
            aria-label="Re-run with modified filters"
          >
            {loading ? 'Running…' : 'Re-run'}
          </button>
        )}
      </div>
    </div>
  )
}
