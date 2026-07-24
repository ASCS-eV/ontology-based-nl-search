import { Pill } from '@ontology-search/design-system'

import type { GateTrace } from '../api-types'

interface GateTraceDisplayProps {
  trace: GateTrace[]
  /** Whether the pipeline's overall verdict is valid. */
  valid: boolean | null
  /** Number of authoring attempts (1 + repairs), when known. */
  attempts?: number | null
}

/** Human-readable label per gate. */
const GATE_LABEL: Record<GateTrace['gate'], string> = {
  semantic: 'Semantic',
  structural: 'Structural (XSD)',
  residual: 'Residual (geometry)',
}

/**
 * Per-gate pass/fail chips plus the overall validity badge — the authoring
 * analog of a query's result summary. Each gate maps to an ASAM qc rule family;
 * a skipped gate is shown explicitly so a silent pass is never implied.
 */
export function GateTraceDisplay({ trace, valid, attempts }: GateTraceDisplayProps) {
  return (
    <div className="w-full" role="region" aria-label="Validation trace" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        {valid !== null && (
          <Pill tone={valid ? 'success' : 'danger'}>{valid ? '✓ Valid' : '✗ Invalid'}</Pill>
        )}
        {trace.map((t) => {
          const skipped = t.skipped && t.skipped.length > 0
          const tone = t.ok ? 'success' : 'danger'
          return (
            <span
              key={t.gate}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              title={
                skipped ? `Rules not evaluated: ${t.skipped?.join(', ')}` : `${t.gapCount} gap(s)`
              }
            >
              <span className="font-medium text-gray-700">{GATE_LABEL[t.gate]}</span>
              <Pill tone={tone}>{t.ok ? 'pass' : `${t.gapCount} gap(s)`}</Pill>
              {skipped && <span className="text-xs text-gray-400">skipped</span>}
            </span>
          )
        })}
      </div>
      {typeof attempts === 'number' && attempts > 1 && (
        <p className="mt-2 text-xs text-gray-400">
          Reached after {attempts} authoring attempts (repair loop).
        </p>
      )}
    </div>
  )
}
