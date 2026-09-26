import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

/**
 * Grow the field to fit its text; its CSS `max-height` caps the growth and it
 * scrolls beyond that. A field measured while hidden (a collapsed step) reads
 * 0 — it is left at its natural one-row height rather than pinned to nothing,
 * and refitted once it becomes visible.
 */
function fitToContent(field: HTMLTextAreaElement | null): void {
  if (!field) return
  field.style.height = 'auto'
  if (field.scrollHeight > 0) field.style.height = `${field.scrollHeight}px`
}

interface SearchBarProps {
  onSearch: (query: string) => void
  loading?: boolean
  disabled?: boolean
  history?: string[]
  /** Input placeholder. Defaults to the search prompt. */
  placeholder?: string
  /** Submit-button label (also the idle aria-label). Defaults to "Search". */
  buttonLabel?: string
  /** Accessible label for the submit button while loading. Defaults to "Searching…". */
  loadingLabel?: string
  /** Accessible label for the input. Defaults to the search description. */
  inputAriaLabel?: string
  /** Heading and accessible label for the history dropdown. Defaults to "Recent searches". */
  historyLabel?: string
}

export function SearchBar({
  onSearch,
  loading,
  disabled,
  history = [],
  placeholder = "Describe what you're looking for in plain language…",
  buttonLabel = 'Search',
  loadingLabel = 'Searching...',
  inputAriaLabel = 'Natural language search query',
  historyLabel = 'Recent searches',
}: SearchBarProps) {
  const [input, setInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const query = input.trim()
    if (query && !loading && !disabled) {
      onSearch(query)
      setShowHistory(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  // Enter submits, like the single-line field this replaces; Shift+Enter adds
  // a line break. Never while an IME composition is open — there Enter
  // confirms the composed characters.
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  useLayoutEffect(() => fitToContent(fieldRef.current), [input])

  // Refit when the field's width changes: a window resize rewraps the text,
  // and a field first measured while hidden gets its real height once shown.
  // Only the width is compared, so the refit's own height change cannot loop.
  useEffect(() => {
    const field = fieldRef.current
    if (!field || typeof ResizeObserver === 'undefined') return
    let width = field.clientWidth
    const observer = new ResizeObserver(() => {
      if (field.clientWidth === width) return
      width = field.clientWidth
      fitToContent(field)
    })
    observer.observe(field)
    return () => observer.disconnect()
  }, [])

  const selectHistory = (query: string) => {
    setInput(query)
    setShowHistory(false)
    onSearch(query)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl" role="search">
      <div className="relative" ref={wrapperRef}>
        {/* The field wraps and grows with its text (up to ~8 lines, then it
            scrolls), and the button sits beside it rather than over it — so a
            long query is always fully readable. */}
        <div className="flex items-end gap-2 w-full pl-6 pr-2 py-2 bg-white border border-gray-300 rounded-[31px] shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-blue-400 transition-shadow dark:bg-gray-900 dark:border-gray-700">
          <textarea
            ref={fieldRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => history.length > 0 && setShowHistory(true)}
            placeholder={placeholder}
            className="flex-1 min-w-0 max-h-60 py-2 text-lg leading-7 bg-transparent resize-none overflow-y-auto focus:outline-none disabled:cursor-not-allowed dark:text-white"
            disabled={loading || disabled}
            aria-label={inputAriaLabel}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button
            type="submit"
            disabled={loading || disabled || !input.trim()}
            className="shrink-0 mb-0.5 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label={loading ? loadingLabel : buttonLabel}
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              buttonLabel
            )}
          </button>
        </div>

        {/* History dropdown */}
        {showHistory && history.length > 0 && (
          <ul
            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 overflow-hidden"
            role="listbox"
            aria-label={historyLabel}
          >
            <li className="px-4 py-1.5 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              {historyLabel}
            </li>
            {history.map((h, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => selectHistory(h)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                  role="option"
                  aria-selected={false}
                >
                  <svg
                    className="w-3.5 h-3.5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {h}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  )
}
