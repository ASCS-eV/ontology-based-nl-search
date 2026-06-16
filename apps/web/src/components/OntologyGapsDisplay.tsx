import { Pill } from '@ontology-search/design-system'

import type { GapKind, OntologyGap } from '../api-types'

interface OntologyGapsDisplayProps {
  gaps: OntologyGap[]
}

/**
 * Per-kind presentation. Gaps used to all render under one "Not in ontology"
 * heading, which mislabeled recognized concepts (interpretation notes) and
 * engine limitations as unknown terms. Each kind now has its own section,
 * heading, and colour so the user can tell "I don't know this term" from
 * "I understood it but can't filter on it" from "this is a current limit".
 */
const SECTIONS: {
  kind: GapKind
  title: string
  heading: string
  card: string
  term: string
  text: string
  chip: string
}[] = [
  {
    kind: 'unmapped',
    title: 'Not in ontology',
    heading: 'text-orange-600',
    card: 'bg-orange-50 border-orange-200',
    term: 'text-orange-800',
    text: 'text-orange-700',
    chip: 'bg-orange-100 text-orange-600',
  },
  {
    kind: 'recognized',
    title: 'Understood, not filtered',
    heading: 'text-blue-600',
    card: 'bg-blue-50 border-blue-200',
    term: 'text-blue-800',
    text: 'text-blue-700',
    chip: 'bg-blue-100 text-blue-600',
  },
  {
    kind: 'limitation',
    title: 'Query limitations',
    heading: 'text-amber-600',
    card: 'bg-amber-50 border-amber-200',
    term: 'text-amber-800',
    text: 'text-amber-700',
    chip: 'bg-amber-100 text-amber-600',
  },
]

/** Gaps default to `unmapped` when the server omits `kind` (back-compat). */
const gapKind = (gap: OntologyGap): GapKind => gap.kind ?? 'unmapped'

export function OntologyGapsDisplay({ gaps }: OntologyGapsDisplayProps) {
  if (gaps.length === 0) return null

  return (
    <div className="w-full space-y-4" role="region" aria-label="Ontology gaps" aria-live="polite">
      {SECTIONS.map((section) => {
        const sectionGaps = gaps.filter((g) => gapKind(g) === section.kind)
        if (sectionGaps.length === 0) return null

        return (
          <div key={section.kind}>
            <h2
              className={`text-sm font-semibold ${section.heading} uppercase tracking-wide mb-2 flex items-center gap-1.5`}
            >
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
                  d={
                    section.kind === 'unmapped'
                      ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z'
                      : 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                  }
                />
              </svg>
              {section.title}
            </h2>

            <div className="space-y-2">
              {sectionGaps.map((gap, i) => (
                <div key={i} className={`px-4 py-3 border rounded-lg ${section.card}`}>
                  <div className="flex items-start gap-2">
                    <span className={`font-medium ${section.term}`}>&ldquo;{gap.term}&rdquo;</span>
                    {gap.isDomainConcept && <Pill tone="warning">Domain concept</Pill>}
                    <span className={`text-sm ${section.text}`}>— {gap.reason}</span>
                  </div>
                  {gap.definition && (
                    <p className={`mt-1.5 text-sm italic ${section.text}`}>{gap.definition}</p>
                  )}
                  {gap.scopeNote && (
                    <p className={`mt-1 text-xs px-2 py-1 rounded ${section.chip}`}>
                      💡 {gap.scopeNote}
                    </p>
                  )}
                  {gap.suggestions && gap.suggestions.length > 0 && (
                    <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${section.text}`}>
                      <span>Related concepts:</span>
                      {gap.suggestions.map((s, j) => (
                        <code key={j} className={`px-1.5 py-0.5 rounded font-mono ${section.chip}`}>
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
      })}
    </div>
  )
}
