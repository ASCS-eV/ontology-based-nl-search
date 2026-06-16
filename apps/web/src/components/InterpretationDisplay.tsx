import { Heading, Pill, type Tone } from '@ontology-search/design-system'

import type { MappedTerm, QueryInterpretation } from '../api-types'

interface InterpretationDisplayProps {
  interpretation: QueryInterpretation
}

const CONFIDENCE_TONE: Record<MappedTerm['confidence'], Tone> = {
  high: 'success',
  medium: 'info',
  low: 'warning',
}

function confidenceBadge(confidence: MappedTerm['confidence']) {
  return (
    <Pill tone={CONFIDENCE_TONE[confidence]} title={`Confidence: ${confidence}`}>
      {confidence}
    </Pill>
  )
}

export function InterpretationDisplay({ interpretation }: InterpretationDisplayProps) {
  return (
    <div className="w-full" role="region" aria-label="Query interpretation" aria-live="polite">
      <Heading level={4} className="mb-2">
        Interpreted as
      </Heading>
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
