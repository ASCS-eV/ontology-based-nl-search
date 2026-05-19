import { useEffect, useState } from 'react'

import type { MappedTerm } from '../api-types'

/** Structural equality check for MappedTerm arrays (avoids JSON.stringify) */
function termsEqual(a: MappedTerm[], b: MappedTerm[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (term, i) =>
      term.property === b[i]?.property &&
      term.mapped === b[i]?.mapped &&
      term.input === b[i]?.input &&
      term.confidence === b[i]?.confidence
  )
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

interface QueryRefinementProps {
  mappedTerms: MappedTerm[]
  domains: string[]
  onRerun: (updatedTerms: MappedTerm[], updatedDomains: string[]) => void
  loading?: boolean
}

/**
 * Editable chips for the interpreted query terms and domains.
 * Users can remove terms/domains or edit values, then re-run directly.
 * Removing all domains means "search all domains".
 */
export function QueryRefinement({
  mappedTerms,
  domains: initialDomains,
  onRerun,
  loading,
}: QueryRefinementProps) {
  const [terms, setTerms] = useState<MappedTerm[]>(mappedTerms)
  const [domains, setDomains] = useState<string[]>(initialDomains)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  // Sync internal state when parent provides new data (e.g., new search)
  useEffect(() => {
    setTerms(mappedTerms)
  }, [mappedTerms])

  useEffect(() => {
    setDomains(initialDomains)
  }, [initialDomains])

  const hasChanges = !termsEqual(terms, mappedTerms) || !arraysEqual(domains, initialDomains)

  const removeDomain = (domain: string) => {
    setDomains(domains.filter((d) => d !== domain))
  }

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
    onRerun(terms, domains)
  }

  if (terms.length === 0 && domains.length === 0) return null

  return (
    <div className="w-full" role="region" aria-label="Refine query">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Refine filters
        </h3>
        {hasChanges && <span className="text-xs text-blue-600 font-medium">Modified</span>}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {/* Domain chips */}
        {domains.map((domain) => (
          <div
            key={`domain-${domain}`}
            className="group inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-sm shadow-sm hover:shadow transition-shadow"
          >
            <span className="text-xs text-indigo-400 font-mono">domain:</span>
            <span className="font-medium text-indigo-700">{domain}</span>
            <button
              onClick={() => removeDomain(domain)}
              className="ml-0.5 w-4 h-4 flex items-center justify-center text-indigo-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove ${domain} domain filter`}
              title="Remove domain (empty = all domains)"
            >
              ×
            </button>
          </div>
        ))}

        {/* No-domain hint */}
        {domains.length === 0 && initialDomains.length > 0 && (
          <span className="text-xs text-gray-400 italic">all domains</span>
        )}

        {/* Property filter chips (exclude domain terms — shown above) */}
        {terms
          .map((term, origIdx) => ({ term, origIdx }))
          .filter(({ term }) => term.property !== 'domain' && term.property !== 'domains')
          .map(({ term, origIdx }) => (
            <div
              key={`${term.property}-${origIdx}`}
              className="group inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-sm shadow-sm hover:shadow transition-shadow"
            >
              {term.property && (
                <span className="text-xs text-gray-400 font-mono">{term.property}:</span>
              )}

              {editingIdx === origIdx ? (
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
                  onClick={() => startEdit(origIdx)}
                  className="font-medium text-gray-800 hover:text-blue-600 cursor-pointer"
                  title="Click to edit"
                  aria-label={`Edit ${term.mapped}`}
                >
                  {term.mapped}
                </button>
              )}

              <button
                onClick={() => removeTerm(origIdx)}
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
