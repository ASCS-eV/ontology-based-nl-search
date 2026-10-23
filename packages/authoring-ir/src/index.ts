export type { AuthoringIR, SceneAction, SceneEntity } from './scene.js'
export { createEmptyScene } from './scene.js'
export type {
  AuthoringIRWire,
  RoadNetworkWire,
  SceneActionWire,
  SceneAssumptionWire,
  SceneEntityWire,
} from './scene-wire-schema.js'
export {
  authoringIrWireSchema,
  roadNetworkWireSchema,
  sceneActionWireSchema,
  sceneAssumptionWireSchema,
  sceneEntityWireSchema,
} from './scene-wire-schema.js'
export type { IrValuePath, LoweringDefault, SceneAssumption } from './value-path.js'
export { actionPath, entityPath, irValueAt } from './value-path.js'
