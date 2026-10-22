import { useId, useState } from 'react'

interface DomainScopeSelectorProps {
  /** Every domain the loaded ontology has, as `/stats` lists them. */
  available: readonly string[]
  /** The domains the next search is scoped to; empty searches every domain. */
  selected: readonly string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}

/**
 * Choose the domains a search covers. The selection is sent with the query
 * and searched exactly as chosen: a part of the query none of the chosen
 * domains can express is reported as a gap instead of widening the search.
 * With nothing chosen, the model picks the domains from the query.
 */
export function DomainScopeSelector({
  available,
  selected,
  onChange,
  disabled,
}: DomainScopeSelectorProps) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const isSelected = new Set(selected)

  const toggle = (domain: string) =>
    onChange(
      isSelected.has(domain)
        ? selected.filter((d) => d !== domain)
        : available.filter((d) => d === domain || isSelected.has(d))
    )

  return (
    <div className="w-full max-w-2xl mt-2 text-sm" role="group" aria-label="Search scope">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-500 dark:text-gray-400">Search in:</span>
        {selected.length === 0 ? (
          <span className="text-gray-700 dark:text-gray-300">all domains</span>
        ) : (
          selected.map((domain) => (
            <span
              key={domain}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800"
            >
              {domain}
              <button
                type="button"
                onClick={() => toggle(domain)}
                disabled={disabled}
                className="px-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50"
                aria-label={`Remove ${domain} from the search scope`}
              >
                ×
              </button>
            </span>
          ))
        )}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          disabled={disabled || available.length === 0}
          aria-expanded={open}
          aria-controls={listId}
          className="text-blue-600 hover:underline disabled:opacity-50 disabled:no-underline dark:text-blue-400"
        >
          {open ? 'Done' : 'Choose domains'}
        </button>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled}
            className="text-gray-500 hover:underline disabled:opacity-50 dark:text-gray-400"
          >
            Search all
          </button>
        )}
      </div>
      {open && (
        <fieldset
          id={listId}
          className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 p-3 border border-gray-200 rounded-xl dark:border-gray-700"
        >
          <legend className="sr-only">Domains to search</legend>
          {available.map((domain) => (
            <label
              key={domain}
              className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <input
                type="checkbox"
                checked={isSelected.has(domain)}
                onChange={() => toggle(domain)}
                disabled={disabled}
              />
              {domain}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  )
}
