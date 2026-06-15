import { type ReactNode, useCallback, useMemo, useState } from 'react'

/** A single step in the pipeline */
export interface PipelineStep {
  /** Unique identifier for this step */
  id: string
  /** Step label shown in the stepper header */
  label: string
  /** One-line summary shown when the step is collapsed after completion */
  summary?: string
  /** Content to render when the step is expanded */
  content: ReactNode
  /** Whether this step has data/content available */
  hasContent: boolean
}

interface PipelineStepperProps {
  steps: PipelineStep[]
  /** ID of the currently active step */
  activeStepId: string
  /** Called when user clicks "Start with GraphQL" */
  onSkipToGraphQL?: () => void
  /** Whether to show the "Start with GraphQL" entry point */
  showGraphQLEntry?: boolean
}

/**
 * Accordion-style pipeline stepper showing numbered steps.
 * Each completed step collapses to show its summary; the active step expands.
 * Users can expand/collapse any step manually.
 */
export function PipelineStepper({
  steps,
  activeStepId,
  onSkipToGraphQL,
  showGraphQLEntry = true,
}: PipelineStepperProps) {
  // Track which steps are manually expanded/collapsed by the user
  const [manualOverrides, setManualOverrides] = useState<Record<string, boolean>>({})

  const toggleStep = useCallback((stepId: string) => {
    setManualOverrides((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }))
  }, [])

  // Map step IDs to their original index in the full steps array for ordering
  const stepOrder = useMemo(() => {
    const map = new Map<string, number>()
    steps.forEach((s, i) => map.set(s.id, i))
    return map
  }, [steps])

  const activeOriginalIndex = stepOrder.get(activeStepId) ?? 0

  const isExpanded = useCallback(
    (step: PipelineStep): boolean => {
      const override = manualOverrides[step.id]
      if (override !== undefined) {
        return override
      }
      return step.id === activeStepId && step.hasContent
    },
    [manualOverrides, activeStepId]
  )

  const visibleSteps = useMemo(() => steps.filter((s) => s.hasContent || s.content), [steps])

  return (
    <div className="w-full max-w-4xl mx-auto">
      {showGraphQLEntry && onSkipToGraphQL && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={onSkipToGraphQL}
            className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full hover:bg-purple-100 transition-colors font-medium"
          >
            ⚡ Start with GraphQL
          </button>
        </div>
      )}

      <div className="space-y-2">
        {visibleSteps.map((step, displayIndex) => {
          const expanded = isExpanded(step)
          const originalIndex = stepOrder.get(step.id) ?? displayIndex
          const isCompleted = originalIndex < activeOriginalIndex && step.hasContent
          const isActive = step.id === activeStepId

          return (
            <div
              key={step.id}
              className={`border rounded-lg transition-all ${
                isActive
                  ? 'border-blue-200 bg-blue-50/30'
                  : isCompleted
                    ? 'border-gray-200 bg-white'
                    : 'border-gray-100 bg-gray-50/50'
              }`}
            >
              {/* Step header */}
              <button
                onClick={() => toggleStep(step.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/50 transition-colors"
                aria-expanded={expanded}
                aria-controls={`step-content-${step.id}`}
              >
                {/* Step number badge */}
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCompleted
                      ? 'bg-green-100 text-green-700'
                      : isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? '✓' : originalIndex + 1}
                </span>

                {/* Label */}
                <span
                  className={`flex-1 text-sm font-medium ${
                    isActive ? 'text-gray-900' : 'text-gray-600'
                  }`}
                >
                  {step.label}
                </span>

                {/* Summary (when collapsed and completed) */}
                {!expanded && step.summary && (
                  <span className="text-xs text-gray-400 truncate max-w-[200px]">
                    {step.summary}
                  </span>
                )}

                {/* Expand/collapse indicator */}
                <span
                  className={`text-gray-400 transition-transform text-xs ${expanded ? 'rotate-90' : ''}`}
                >
                  ▶
                </span>
              </button>

              {/* Step content — hidden via CSS to preserve internal state */}
              <div
                id={`step-content-${step.id}`}
                className="px-4 pb-4 pt-1"
                style={expanded ? undefined : { display: 'none' }}
              >
                {step.content}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
