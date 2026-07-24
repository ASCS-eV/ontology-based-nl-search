import { Alert } from '@ontology-search/design-system'
import { useMemo } from 'react'

import { useAuthoringExecution } from '../hooks/useAuthoringExecution'
import { AuthoringGapsDisplay } from './AuthoringGapsDisplay'
import { GateTraceDisplay } from './GateTraceDisplay'
import { InterpretationDisplay } from './InterpretationDisplay'
import type { PipelineStep } from './PipelineStepper'
import { PipelineStepper } from './PipelineStepper'
import { ScenarioViewer } from './ScenarioViewer'
import { SceneSummary } from './SceneSummary'
import { SearchBar } from './SearchBar'
import { TypewriterText } from './TypewriterText'
import { XoscPreview } from './XoscPreview'

/** Steps that start collapsed — the user can expand them manually. */
const COLLAPSED_STEPS = new Set(['xosc'])

/**
 * The authoring page — the authoring analog of {@link ./SearchPage SearchPage}.
 * The user describes a driving scenario in natural language; the LLM fills the
 * scene IR (its only output), a deterministic pipeline gates + lowers it to a
 * valid OpenSCENARIO `.xosc`, and the per-gate validation is streamed back. The
 * IR is what the model authors; the `.xosc` is read-only (derived).
 */
export function AuthoringPage() {
  const {
    interpretation,
    scene,
    xosc,
    gaps,
    trace,
    valid,
    attempts,
    phase,
    statusMessage,
    loading,
    error,
    handleAuthor,
  } = useAuthoringExecution()

  const hasResponse = interpretation || scene || xosc || (gaps && gaps.length > 0)

  const activeStepId = useMemo(() => {
    if (!hasResponse) return 'nl-author'
    if (!interpretation) return 'interpretation'
    if (!scene) return 'scene'
    if (!xosc) return 'validation'
    return 'xosc'
  }, [hasResponse, interpretation, scene, xosc])

  const steps: PipelineStep[] = useMemo(
    () => [
      {
        id: 'nl-author',
        label: 'Describe the scenario',
        summary: phase !== 'idle' ? 'Request submitted' : undefined,
        hasContent: true,
        content: (
          <div>
            <SearchBar
              onSearch={handleAuthor}
              loading={loading}
              placeholder="Describe a driving scenario, e.g. a cut-in on a three-lane highway…"
              buttonLabel="Author"
              loadingLabel="Authoring…"
              inputAriaLabel="Natural language scenario description"
            />
            {(phase === 'authoring' || phase === 'repairing') && !scene && (
              <p className="text-blue-600 text-xs mt-2 text-center h-4">
                <TypewriterText
                  text={statusMessage ?? 'Authoring the scenario against the ontology…'}
                  speed={35}
                />
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'interpretation',
        label: 'LLM Interpretation & Ontology Mapping',
        summary: interpretation?.summary,
        hasContent: !!interpretation,
        content: interpretation ? <InterpretationDisplay interpretation={interpretation} /> : null,
      },
      {
        id: 'scene',
        label: 'Authored Scene (IR)',
        summary: scene
          ? `${scene.entities.length} entities · ${scene.actions.length} actions`
          : undefined,
        hasContent: !!scene,
        content: scene ? <SceneSummary scene={scene} /> : null,
      },
      {
        id: 'validation',
        label: 'Validation Gates',
        summary: valid !== null ? (valid ? 'All gates passed' : 'Gate violations') : undefined,
        hasContent: !!trace,
        content: trace ? (
          <div className="space-y-4">
            <GateTraceDisplay trace={trace} valid={valid} attempts={attempts} />
            {gaps && gaps.length > 0 && <AuthoringGapsDisplay gaps={gaps} />}
          </div>
        ) : null,
      },
      {
        id: 'xosc',
        label: 'OpenSCENARIO (.xosc)',
        summary: xosc ? `${xosc.split('\n').length} lines` : undefined,
        hasContent: !!xosc,
        content: xosc ? <XoscPreview xosc={xosc} /> : null,
      },
    ],
    [
      interpretation,
      scene,
      xosc,
      gaps,
      trace,
      valid,
      attempts,
      phase,
      statusMessage,
      loading,
      handleAuthor,
    ]
  )

  return (
    <div className="flex flex-col items-center px-4 pt-12 pb-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Scenario Authoring</h1>
        <p className="text-gray-500 max-w-2xl">
          Describe a driving scenario in plain language. The model fills a validated scene
          description; a deterministic pipeline generates a schema-valid OpenSCENARIO&nbsp;
          <code className="font-mono text-gray-700">.xosc</code>.
        </p>
      </div>

      {error && (
        <div className="mb-6 max-w-2xl w-full">
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        </div>
      )}

      <PipelineStepper
        steps={steps}
        activeStepId={activeStepId}
        showGraphQLEntry={false}
        defaultCollapsed={COLLAPSED_STEPS}
      />

      <ScenarioViewer xosc={xosc} scene={scene} valid={valid} />
    </div>
  )
}
