import type { MappedTerm, QueryInterpretation } from '@/lib/llm/types'

interface InterpretationDisplayProps {
  interpretation: QueryInterpretation
}

function confidenceBadge(confidence: MappedTerm['confidence']) {
  const styles = {
    high: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
    medium:
      'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
    low: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
  }

  const icons = { high: '✓', medium: '~', low: '?' }

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 text-xs font-medium rounded-full border ${styles[confidence]}`}
      title={`Confidence: ${confidence}`}
    >
      {icons[confidence]} {confidence}
    </span>
  )
}

export function InterpretationDisplay({
  interpretation,
}: InterpretationDisplayProps) {
  return (
    <div
      className="mt-4 w-full max-w-2xl"
      role="region"
      aria-label="Query interpretation"
      aria-live="polite"
    >
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Interpreted as
      </h2>
      <p className="text-base text-gray-800 dark:text-gray-200 mb-3">
        {interpretation.summary}
      </p>

      {interpretation.mappedTerms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {interpretation.mappedTerms.map((term, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
            >
              <span className="text-gray-500 dark:text-gray-400 line-through text-xs">
                {term.input}
              </span>
              <span className="text-gray-400 dark:text-gray-500">→</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {term.mapped}
              </span>
              {confidenceBadge(term.confidence)}
              {term.property && (
                <code className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                  {term.property}
                </code>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
