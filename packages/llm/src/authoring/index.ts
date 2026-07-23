/**
 * `@ontology-search/llm/authoring` — the scene-authoring loop.
 *
 * Public surface for the API layer: the deterministic gate pipeline
 * ({@link runScenePipeline}) for IR-direct callers, and the LLM repair-loop
 * agent ({@link runSceneAgent}) for natural-language authoring. The security
 * boundary is the IR — the model only ever fills {@link SceneSubmissionParams},
 * never raw `.xosc`.
 */

export { warmupSceneCopilot } from './fill-scene-copilot.js'
export {
  type GateTrace,
  repairableGaps,
  runScenePipeline,
  type SceneGap,
  type SceneGateName,
  type ScenePipelineInput,
  type SceneResult,
} from './run-scene-pipeline.js'
export {
  runSceneAgent,
  type SceneAgentOptions,
  type SceneAgentResult,
  type SceneProgress,
  type SceneProgressPhase,
} from './scene-agent.js'
export { sceneAgentTools, type SceneSubmissionParams, sceneSubmissionSchema } from './scene-tool.js'
