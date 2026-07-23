/**
 * Scene-authoring agent — the bounded repair loop that turns a natural-language
 * scenario description into a validated OpenSCENARIO `.xosc`.
 *
 * The authoring analog of the search agent: the LLM fills the scene IR (never
 * `.xosc`), the deterministic {@link runScenePipeline} gates and lowers it, and
 * on IR-fixable gaps the agent re-prompts the model — citing the exact
 * `asam.net:…` rule UID and message — up to `AUTHORING_MAX_REPAIRS` times.
 *
 * On exhaustion it returns the best artifact PLUS the outstanding gaps; it never
 * returns a silently-invalid document. Provider selection mirrors the search
 * agent: Copilot when `AI_PROVIDER=copilot`, otherwise the Vercel path.
 */

import { QC_RULES } from '@ontology-search/authoring-gate'
import { type AuthoringIR, createEmptyScene } from '@ontology-search/authoring-ir'
import { getConfig } from '@ontology-search/core/config'

import { fillSceneCopilot } from './fill-scene-copilot.js'
import { fillSceneVercel } from './fill-scene-vercel.js'
import {
  type GateTrace,
  repairableGaps,
  runScenePipeline,
  type SceneGap,
} from './run-scene-pipeline.js'
import { buildSceneRequest, renderRepairFeedback } from './scene-prompt.js'
import type { SceneSubmissionParams } from './scene-tool.js'

/** One turn of one fill; returns the submission or `null` when none was made. */
type SceneFiller = (
  requestMessage: string,
  signal?: AbortSignal
) => Promise<SceneSubmissionParams | null>

/** Progress phases the SSE route maps to status events. */
export type SceneProgressPhase = 'authoring' | 'authored' | 'gated' | 'repairing'

export interface SceneProgress {
  readonly phase: SceneProgressPhase
  /** 1-based attempt index. */
  readonly attempt: number
  /** Present on `authored`: the model's interpretation of the request. */
  readonly interpretation?: SceneSubmissionParams['interpretation']
  /** Present on `gated`: the pipeline verdict for this attempt. */
  readonly valid?: boolean
  readonly gaps?: readonly SceneGap[]
  readonly trace?: readonly GateTrace[]
}

export interface SceneAgentOptions {
  /** Archetype selector forwarded to the prompt and the IR (e.g. "cut-in"). */
  readonly archetype?: string
  /** Referenced `.xodr` content — enables the cross-file + residual gates. */
  readonly roadNetworkXodr?: string
  /** Override the config repair cap (tests / callers with a tighter budget). */
  readonly maxRepairs?: number
  /** Cooperative cancellation across fills and gates. */
  readonly signal?: AbortSignal
  /** Progress sink for SSE streaming. Awaited so back-pressure propagates. */
  readonly onProgress?: (progress: SceneProgress) => void | Promise<void>
}

export interface SceneAgentResult {
  /** The final authored IR (empty scene when the model never submitted). */
  readonly ir: AuthoringIR
  /** The emitted `.xosc`, when lowering produced one. */
  readonly xosc?: string
  /** True iff the final pipeline pass passed the semantic + structural gates. */
  readonly valid: boolean
  /** Outstanding gaps from the final pass (rule-attributed). */
  readonly gaps: readonly SceneGap[]
  /** The model's interpretation of the request, when it submitted one. */
  readonly interpretation?: SceneSubmissionParams['interpretation']
  /** Gaps the MODEL self-reported (concepts it could not express). */
  readonly reportedGaps: SceneSubmissionParams['gaps']
  /** Per-gate trace from the final pass. */
  readonly trace: readonly GateTrace[]
  /** Number of LLM authoring turns performed (1 + repairs used). */
  readonly attempts: number
}

function selectFiller(): SceneFiller {
  return getConfig().AI_PROVIDER === 'copilot' ? fillSceneCopilot : fillSceneVercel
}

/**
 * Author a scenario from natural language, gating and repairing until valid or
 * the repair budget is exhausted.
 */
export async function runSceneAgent(
  naturalLanguage: string,
  options: SceneAgentOptions = {}
): Promise<SceneAgentResult> {
  const fill = selectFiller()
  const maxRepairs = options.maxRepairs ?? getConfig().AUTHORING_MAX_REPAIRS
  const { archetype, roadNetworkXodr, signal, onProgress } = options

  const emit = async (progress: SceneProgress): Promise<void> => {
    if (signal?.aborted) return
    await onProgress?.(progress)
  }

  let feedback: string | undefined
  let lastSubmission: SceneSubmissionParams | null = null
  let attempts = 0

  // Total LLM turns = 1 initial authoring pass + up to `maxRepairs` re-prompts.
  for (let i = 0; i <= maxRepairs; i++) {
    const attempt = i + 1
    await emit({ phase: i === 0 ? 'authoring' : 'repairing', attempt })

    const request = buildSceneRequest(naturalLanguage, {
      ...(archetype ? { archetype } : {}),
      ...(feedback ? { feedback } : {}),
    })
    const submission = await fill(request, signal)
    attempts = attempt
    if (!submission) {
      lastSubmission = null
      break
    }
    lastSubmission = submission

    const ir = submission.scene as AuthoringIR
    await emit({ phase: 'authored', attempt, interpretation: submission.interpretation })

    const result = await runScenePipeline({
      ir,
      ...(roadNetworkXodr !== undefined ? { roadNetworkXodr } : {}),
      ...(signal ? { signal } : {}),
    })
    await emit({
      phase: 'gated',
      attempt,
      valid: result.valid,
      gaps: result.gaps,
      trace: result.trace,
    })

    if (result.valid) {
      return {
        ir: result.ir,
        ...(result.xosc !== undefined ? { xosc: result.xosc } : {}),
        valid: true,
        gaps: result.gaps,
        interpretation: submission.interpretation,
        reportedGaps: submission.gaps,
        trace: result.trace,
        attempts,
      }
    }

    const fixable = repairableGaps(result.gaps)
    if (fixable.length === 0) {
      // Nothing the model can fix by editing the IR — stop and return honestly.
      return {
        ir: result.ir,
        ...(result.xosc !== undefined ? { xosc: result.xosc } : {}),
        valid: false,
        gaps: result.gaps,
        interpretation: submission.interpretation,
        reportedGaps: submission.gaps,
        trace: result.trace,
        attempts,
      }
    }
    feedback = renderRepairFeedback(ir, fixable)

    // Budget exhausted: return the last (invalid) artifact with its gaps.
    if (i === maxRepairs) {
      return {
        ir: result.ir,
        ...(result.xosc !== undefined ? { xosc: result.xosc } : {}),
        valid: false,
        gaps: result.gaps,
        interpretation: submission.interpretation,
        reportedGaps: submission.gaps,
        trace: result.trace,
        attempts,
      }
    }
  }

  // The model never submitted a scene — surface it as a rule-attributed gap.
  return {
    ir: createEmptyScene(archetype),
    valid: false,
    gaps: [
      {
        term: 'scene authoring',
        reason: 'The model did not submit a scene via submit_scene.',
        ruleUid: QC_RULES.schemaValidation.uid,
        gate: 'structural',
      },
    ],
    ...(lastSubmission ? { interpretation: lastSubmission.interpretation } : {}),
    reportedGaps: lastSubmission?.gaps ?? [],
    trace: [],
    attempts,
  }
}
