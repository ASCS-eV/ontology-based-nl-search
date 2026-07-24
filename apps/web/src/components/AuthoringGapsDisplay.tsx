import type { SceneGap, SceneGateName } from '../api-types'

interface AuthoringGapsDisplayProps {
  gaps: SceneGap[]
}

/** Per-gate presentation — colour + heading, so the user can tell a schema
 *  (structural) defect from a referential (semantic) one from a road-geometry
 *  (residual) note. Each gap is attributed to a canonical ASAM qc rule UID. */
const SECTIONS: {
  gate: SceneGateName
  title: string
  heading: string
  card: string
  term: string
  text: string
  chip: string
}[] = [
  {
    gate: 'semantic',
    title: 'Semantic gate',
    heading: 'text-orange-600',
    card: 'bg-orange-50 border-orange-200',
    term: 'text-orange-800',
    text: 'text-orange-700',
    chip: 'bg-orange-100 text-orange-600',
  },
  {
    gate: 'structural',
    title: 'Structural gate (XSD)',
    heading: 'text-red-600',
    card: 'bg-red-50 border-red-200',
    term: 'text-red-800',
    text: 'text-red-700',
    chip: 'bg-red-100 text-red-600',
  },
  {
    gate: 'residual',
    title: 'Residual gate (road geometry)',
    heading: 'text-amber-600',
    card: 'bg-amber-50 border-amber-200',
    term: 'text-amber-800',
    text: 'text-amber-700',
    chip: 'bg-amber-100 text-amber-600',
  },
]

/**
 * Renders the outstanding scene-pipeline gaps grouped by the gate that raised
 * them — the authoring analog of {@link ./OntologyGapsDisplay OntologyGapsDisplay}.
 * Every gap carries its ASAM `asam.net:…` rule UID so the same rule identity is
 * visible in the UI, the repair loop, and the ASAM qc-framework.
 */
export function AuthoringGapsDisplay({ gaps }: AuthoringGapsDisplayProps) {
  if (gaps.length === 0) return null

  return (
    <div className="w-full space-y-4" role="region" aria-label="Scene gaps" aria-live="polite">
      {SECTIONS.map((section) => {
        const sectionGaps = gaps.filter((g) => g.gate === section.gate)
        if (sectionGaps.length === 0) return null

        return (
          <div key={section.gate}>
            <h2 className={`text-sm font-semibold ${section.heading} uppercase tracking-wide mb-2`}>
              {section.title}
            </h2>
            <div className="space-y-2">
              {sectionGaps.map((gap, i) => (
                <div key={i} className={`px-4 py-3 border rounded-lg ${section.card}`}>
                  <div className="flex flex-wrap items-start gap-2">
                    <span className={`font-medium ${section.term}`}>&ldquo;{gap.term}&rdquo;</span>
                    {gap.focusNode && (
                      <code className={`text-xs px-1.5 py-0.5 rounded font-mono ${section.chip}`}>
                        {gap.focusNode}
                      </code>
                    )}
                    <span className={`text-sm ${section.text}`}>— {gap.reason}</span>
                  </div>
                  {gap.location && (
                    <p className={`mt-1 text-xs ${section.text}`}>
                      at line {gap.location.line}, col {gap.location.col}
                    </p>
                  )}
                  <p className={`mt-1.5 text-xs font-mono ${section.text}`}>
                    <span className="opacity-60">rule:</span> {gap.ruleUid}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
