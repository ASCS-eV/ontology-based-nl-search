import type { OntologyGap } from '@/lib/llm/types'

interface OntologyGapsDisplayProps {
  gaps: OntologyGap[]
}

export function OntologyGapsDisplay({ gaps }: OntologyGapsDisplayProps) {
  if (gaps.length === 0) return null

  return (
    <div
      className="mt-4 w-full max-w-2xl"
      role="region"
      aria-label="Ontology gaps"
      aria-live="polite"
    >
      <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        Not in ontology
      </h2>

      <div className="space-y-2">
        {gaps.map((gap, i) => (
          <div
            key={i}
            className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg"
          >
            <div className="flex items-start gap-2">
              <span className="font-medium text-amber-800 dark:text-amber-200">
                &ldquo;{gap.term}&rdquo;
              </span>
              <span className="text-sm text-amber-700 dark:text-amber-300">
                — {gap.reason}
              </span>
            </div>
            {gap.suggestions && gap.suggestions.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <span>Nearest concepts:</span>
                {gap.suggestions.map((s, j) => (
                  <code
                    key={j}
                    className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-800/40 rounded font-mono"
                  >
                    {s}
                  </code>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
