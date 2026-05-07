import type { MappedTerm, QueryInterpretation } from '../api-types'

interface InterpretationDisplayProps {
  interpretation: QueryInterpretation
}

function confidenceBadge(confidence: MappedTerm['confidence']) {
  const styles = {
    high: 'bg-green-50 text-green-700 border-green-200',
    medium: 'bg-blue-50 text-blue-900 border-blue-100',
    low: 'bg-red-50 text-red-700 border-red-200',
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

export function InterpretationDisplay({ interpretation }: InterpretationDisplayProps) {
  return (
    <div className="w-full" role="region" aria-label="Query interpretation" aria-live="polite">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Interpreted as
      </h2>
      <p className="text-base text-gray-800 mb-3">{interpretation.summary}</p>

      {interpretation.mappedTerms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {interpretation.mappedTerms.map((term, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            >
              <span className="text-gray-400 line-through text-xs">{term.input}</span>
              <span className="text-gray-400">→</span>
              <span className="font-medium text-gray-800">{term.mapped}</span>
              {confidenceBadge(term.confidence)}
              {term.property && (
                <code className="text-xs text-gray-400 font-mono">{term.property}</code>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
