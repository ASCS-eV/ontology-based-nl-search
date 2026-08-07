import { Button } from '@ontology-search/design-system'
import type { SearchSlots } from '@ontology-search/slots/slots'
import { useEffect, useState } from 'react'

/**
 * Editable chips over the **slot IR** the server compiled and streamed back.
 *
 * The slots are the source of truth, exactly as the authoring page edits the
 * scene IR. Earlier this component edited `interpretation.mappedTerms` — a
 * human-readable summary — and the hook regex-parsed those strings back into
 * slots, which silently flattened multi-valued filters and dropped references.
 *
 * One chip per VALUE, not per property: a filter holding `['motorway','urban']`
 * renders two chips, so editing or removing one value is unambiguous and needs
 * no delimiter convention. Ranges get typed min/max number inputs rather than
 * free text, for the same reason.
 */

/** A single editable filter value, addressed by its property and array index. */
interface FilterChip {
  property: string
  value: string
  /** Index within the property's value array; `null` when it is a lone string. */
  index: number | null
}

function filterChips(filters: SearchSlots['filters']): FilterChip[] {
  const chips: FilterChip[] = []
  for (const [property, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      value.forEach((v, index) => chips.push({ property, value: v, index }))
    } else if (value) {
      chips.push({ property, value, index: null })
    }
  }
  return chips
}

/** Replace one value in place, preserving whether the slot held an array. */
function setFilterValue(slots: SearchSlots, chip: FilterChip, next: string): SearchSlots {
  const filters = { ...slots.filters }
  if (chip.index === null) {
    filters[chip.property] = next
  } else {
    const current = filters[chip.property]
    const arr = Array.isArray(current) ? [...current] : [current ?? '']
    arr[chip.index] = next
    filters[chip.property] = arr
  }
  return { ...slots, filters }
}

/** Drop one value; removing the last one drops the property entirely. */
function removeFilterValue(slots: SearchSlots, chip: FilterChip): SearchSlots {
  const filters = { ...slots.filters }
  if (chip.index === null) {
    delete filters[chip.property]
    return { ...slots, filters }
  }
  const current = filters[chip.property]
  const arr = (Array.isArray(current) ? current : [current ?? '']).filter(
    (_, i) => i !== chip.index
  )
  if (arr.length === 0) delete filters[chip.property]
  else filters[chip.property] = arr.length === 1 ? arr[0]! : arr
  return { ...slots, filters }
}

function removeRange(slots: SearchSlots, property: string): SearchSlots {
  const ranges = { ...slots.ranges }
  delete ranges[property]
  return { ...slots, ranges }
}

function setRangeBound(
  slots: SearchSlots,
  property: string,
  bound: 'min' | 'max',
  raw: string
): SearchSlots {
  const ranges = { ...slots.ranges }
  const current = { ...(ranges[property] ?? {}) }
  // An empty field means "no bound on this side", which is not the same as 0.
  if (raw.trim() === '') delete current[bound]
  else {
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return slots
    current[bound] = parsed
  }
  ranges[property] = current
  return { ...slots, ranges }
}

function removeDomain(slots: SearchSlots, domain: string): SearchSlots {
  return { ...slots, domains: slots.domains.filter((d) => d !== domain) }
}

function removeReference(slots: SearchSlots, domain: string): SearchSlots {
  const references = (slots.references ?? []).filter((r) => r.domain !== domain)
  const next: SearchSlots = { ...slots, references }
  if (references.length === 0) delete next.references
  return next
}

/** Structural equality over the parts this component can edit. */
function slotsEqual(a: SearchSlots, b: SearchSlots): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Whether the IR carries anything this panel can show or edit. Exported so the
 * page's pipeline step cannot claim content while the panel renders nothing.
 */
export function hasEditableSlots(slots: SearchSlots): boolean {
  return (
    slots.domains.length > 0 ||
    Object.keys(slots.filters).length > 0 ||
    Object.keys(slots.ranges).length > 0 ||
    (slots.references?.length ?? 0) > 0
  )
}

interface QueryRefinementProps {
  slots: SearchSlots
  onRerun: (slots: SearchSlots) => void
  loading?: boolean
}

const CHIP = 'group inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm shadow-sm'
const REMOVE =
  'ml-0.5 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity'

export function QueryRefinement({ slots: incoming, onRerun, loading }: QueryRefinementProps) {
  const [slots, setSlots] = useState<SearchSlots>(incoming)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Adopt fresh server slots (a new search, or a completed refine).
  useEffect(() => {
    setSlots(incoming)
    setEditing(null)
  }, [incoming])

  const hasChanges = !slotsEqual(slots, incoming)
  const chips = filterChips(slots.filters)

  const startEdit = (key: string, value: string) => {
    setEditing(key)
    setEditValue(value)
  }

  const confirmEdit = (chip: FilterChip) => {
    const next = editValue.trim()
    if (next) setSlots(setFilterValue(slots, chip, next))
    setEditing(null)
    setEditValue('')
  }

  if (!hasEditableSlots(slots) && !hasEditableSlots(incoming)) return null

  return (
    <div className="w-full" role="region" aria-label="Refine query">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Refine filters
        </h3>
        {hasChanges && <span className="text-xs text-blue-600 font-medium">Modified</span>}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {slots.domains.map((domain) => (
          <div
            key={`domain-${domain}`}
            className={`${CHIP} bg-indigo-50 border border-indigo-200 hover:shadow transition-shadow`}
          >
            <span className="text-xs text-indigo-400 font-mono">domain:</span>
            <span className="font-medium text-indigo-700">{domain}</span>
            <button
              onClick={() => setSlots(removeDomain(slots, domain))}
              className={REMOVE}
              aria-label={`Remove ${domain} domain filter`}
              title="Remove domain (empty = all domains)"
            >
              ×
            </button>
          </div>
        ))}

        {slots.domains.length === 0 && incoming.domains.length > 0 && (
          <span className="text-xs text-gray-400 italic">all domains</span>
        )}

        {(slots.references ?? []).map((ref) => (
          <div
            key={`ref-${ref.domain}`}
            className={`${CHIP} bg-amber-50 border border-amber-200 hover:shadow transition-shadow`}
          >
            <span className="text-xs text-amber-500 font-mono">references:</span>
            <span className="font-medium text-amber-700">{ref.domain}</span>
            <button
              onClick={() => setSlots(removeReference(slots, ref.domain))}
              className={REMOVE}
              aria-label={`Remove ${ref.domain} reference filter`}
              title="Remove cross-reference"
            >
              ×
            </button>
          </div>
        ))}

        {chips.map((chip) => {
          const key = `${chip.property}#${chip.index ?? 'single'}`
          return (
            <div
              key={key}
              className={`${CHIP} bg-white border border-gray-200 hover:shadow transition-shadow`}
            >
              <span className="text-xs text-gray-400 font-mono">{chip.property}:</span>
              {editing === key ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmEdit(chip)
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  onBlur={() => confirmEdit(chip)}
                  className="w-24 px-1 py-0 text-sm border-b border-blue-400 outline-none bg-transparent"
                  autoFocus
                  aria-label={`Edit value for ${chip.property}`}
                />
              ) : (
                <button
                  onClick={() => startEdit(key, chip.value)}
                  className="font-medium text-gray-800 hover:text-blue-600 cursor-pointer"
                  title="Click to edit"
                  aria-label={`Edit ${chip.value}`}
                >
                  {chip.value}
                </button>
              )}
              <button
                onClick={() => setSlots(removeFilterValue(slots, chip))}
                className={REMOVE}
                aria-label={`Remove ${chip.value} filter`}
                title="Remove filter"
              >
                ×
              </button>
            </div>
          )
        })}

        {Object.entries(slots.ranges).map(([property, range]) => (
          <div
            key={`range-${property}`}
            className={`${CHIP} bg-emerald-50 border border-emerald-200 hover:shadow transition-shadow`}
          >
            <span className="text-xs text-emerald-500 font-mono">{property}:</span>
            <input
              type="number"
              value={range.min ?? ''}
              placeholder="min"
              onChange={(e) => setSlots(setRangeBound(slots, property, 'min', e.target.value))}
              className="w-14 px-1 py-0 text-sm bg-transparent border-b border-emerald-300 outline-none"
              aria-label={`Minimum ${property}`}
            />
            <span className="text-emerald-400">–</span>
            <input
              type="number"
              value={range.max ?? ''}
              placeholder="max"
              onChange={(e) => setSlots(setRangeBound(slots, property, 'max', e.target.value))}
              className="w-14 px-1 py-0 text-sm bg-transparent border-b border-emerald-300 outline-none"
              aria-label={`Maximum ${property}`}
            />
            <button
              onClick={() => setSlots(removeRange(slots, property))}
              className={REMOVE}
              aria-label={`Remove ${property} range filter`}
              title="Remove range"
            >
              ×
            </button>
          </div>
        ))}

        {hasChanges && (
          <Button
            onClick={() => onRerun(slots)}
            disabled={loading || !hasEditableSlots(slots)}
            variant="primary"
            size="sm"
            ariaLabel="Re-run with modified filters"
          >
            {loading ? 'Running…' : 'Re-run'}
          </Button>
        )}
      </div>
    </div>
  )
}
