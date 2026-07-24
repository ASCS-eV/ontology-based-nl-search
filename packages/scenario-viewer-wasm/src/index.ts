/**
 * @ontology-search/scenario-viewer-wasm
 *
 * A leak-free TypeScript facade over a prebuilt WebAssembly build of the esmini
 * OpenSCENARIO player (esmini's own esminiJS Emscripten target, MPL-2.0 — see
 * NOTICE). It steps an authored `.xosc` in the browser and exposes the road
 * geometry + per-frame entity poses a viewer needs, with every embind vector
 * handle deterministically freed.
 *
 * The compiled artifact is `wasm/esmini.js` (imported by the app as
 * `@ontology-search/scenario-viewer-wasm/esmini.js`); this entry point exports
 * the facade only, so it stays importable off-browser for tests.
 */
export type {
  EmscriptenFS,
  EsminiFactory,
  EsminiModule,
  OpenScenarioHandle,
  RawOpenScenarioConfig,
  RawScenarioFrame,
  RawScenarioRoadGeometry,
} from './esmini-module.js'
export { drainVector, extractFrame, extractRoadGeometry } from './extract.js'
export type { LoadScenarioOptions } from './load-esmini.js'
export { loadScenario } from './load-esmini.js'
export {
  DEFAULT_SCENARIO_CONFIG,
  EsminiScenario,
  ScenarioDisposedError,
  toRawConfig,
} from './scenario-engine.js'
export type {
  LaneCenter,
  LaneSurface,
  ObjectState,
  RoadFeatureBox,
  RoadGeometry,
  RoadMark,
  RoadObject,
  RoadPoint,
  ScenarioConfig,
  ScenarioFrame,
} from './types.js'
export type { ViewerEngineVersions } from './versions.js'
export { VIEWER_ENGINE_VERSIONS } from './versions.js'
