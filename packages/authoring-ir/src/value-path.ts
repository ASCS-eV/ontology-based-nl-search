/**
 * Where a value of an {@link AuthoringIR} came from.
 *
 * A scene mixes values the user stated with values the model chose and
 * values the lowering filled in. A statement about one value names it by a
 * path into the IR:
 *
 *   entity.<ref>                        the entity itself
 *   entity.<ref>.<property>             a property of the entity
 *   action.<actor>.<kind>               the first action of that kind by that actor
 *   action.<actor>.<kind>.<property>    a property of that action
 *   parameters.<name>                   a parameter declaration
 *   roadNetwork.logicFile               the road the scene is bound to
 *   stopTime                            the simulation end time
 *
 * Segments are separated by `.`; refs, kinds and property names carry none.
 */
import type { AuthoringIR } from './scene.js'

/** A path into an {@link AuthoringIR}, in the grammar of the module doc. */
export type IrValuePath = string

/** A value the model chose that the user did not state. */
export interface SceneAssumption {
  readonly path: IrValuePath
  /** Why the model chose it, in the model's words. */
  readonly reason: string
}

/** A value the lowering filled in because the IR does not carry one. */
export interface LoweringDefault {
  readonly path: IrValuePath
  /** The value the emitted document carries. */
  readonly value: string
  /** What the default stands for (e.g. a standard passenger car). */
  readonly reason: string
}

/** The path of an entity, or of one of its properties. */
export function entityPath(ref: string, property?: string): IrValuePath {
  return property === undefined ? `entity.${ref}` : `entity.${ref}.${property}`
}

/** The path of an action, or of one of its properties. */
export function actionPath(actor: string, kind: string, property?: string): IrValuePath {
  return property === undefined ? `action.${actor}.${kind}` : `action.${actor}.${kind}.${property}`
}

const joined = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value.join(',') : value

/**
 * The value `path` names in `ir`, as a string (a list comma-joined); the ref
 * or kind for a path to an entity or an action. Undefined when `ir` has no
 * such value, so a statement about a value the scene does not carry can be
 * told apart.
 */
export function irValueAt(ir: AuthoringIR, path: IrValuePath): string | undefined {
  const [head, ...rest] = path.split('.')
  switch (head) {
    case 'entity': {
      const [ref, property, extra] = rest
      if (ref === undefined || extra !== undefined) return undefined
      const entity = ir.entities.find((e) => e.ref === ref)
      if (!entity) return undefined
      return property === undefined ? entity.ref : joined(entity.properties[property])
    }
    case 'action': {
      const [actor, kind, property, extra] = rest
      if (actor === undefined || kind === undefined || extra !== undefined) return undefined
      const action = ir.actions.find((a) => a.actor === actor && a.kind === kind)
      if (!action) return undefined
      return property === undefined ? action.kind : joined(action.properties[property])
    }
    case 'parameters':
      return rest.length === 1 ? ir.parameters?.[rest[0]!] : undefined
    case 'roadNetwork':
      return rest.length === 1 && rest[0] === 'logicFile' ? ir.roadNetwork?.logicFile : undefined
    case 'stopTime':
      return rest.length === 0 && ir.stopTime !== undefined ? String(ir.stopTime) : undefined
    default:
      return undefined
  }
}
