/**
 * Map the generic, SHACL-keyed authoring IR onto the concrete engine tree the
 * writer facade lowers to `.xosc` (task 04). This is the archetype mapping: it
 * resolves the LLM-facing {@link AuthoringIR} (entities + flat actions) into the
 * structured {@link EngineTree} the model-generated writers materialize, filling
 * standard-car defaults so a minimal IR still yields a schema-valid scenario.
 *
 * The IR stays domain-agnostic (keyed by ontology local names, exactly like
 * `SearchSlots`); all OpenSCENARIO-specific structure lives here and in the
 * engine — never in the LLM contract. The mapping is deterministic and pure.
 *
 * Action conventions (the first-slice cut-in archetype):
 *   - `SpeedAction`      → an entity's initial speed. `properties.speed` (or
 *                          `value`), in m/s.
 *   - `TeleportAction`   → an entity's start position. Either an absolute lane
 *                          (`properties.roadId/laneId/s/offset`) or one relative
 *                          to another entity (`references.relativeTo` +
 *                          `properties.dLane/ds/offset`).
 *   - `LaneChangeAction` → the single triggered maneuver. Actor changes lane
 *                          relative to `references.relativeTo`; `properties`
 *                          carry `targetLaneOffset`, `dynamicsShape`,
 *                          `dynamicsDimension`, `dynamicsValue`, `targetValue`
 *                          and `startTime` (s).
 *
 * [OSC-XSD] OpenSCENARIO 1.3 — the produced tree mirrors the standard's model
 * elements; the writer factory (packages/authoring-wasm) enforces order/choice.
 */
import type { AuthoringIR, SceneAction } from '@ontology-search/authoring-ir'
import type {
  EngineEntity,
  EngineInitPrivate,
  EngineManeuver,
  EnginePosition,
  EngineTree,
  EngineVehicle,
} from '@ontology-search/authoring-wasm'

/** A standard passenger car — defaults for any vehicle field the IR omits. */
const DEFAULT_CAR = {
  vehicleCategory: 'car',
  performance: { maxSpeed: 69.444, maxAcceleration: 10, maxDeceleration: 10 },
  boundingBox: {
    center: { x: 1.4, y: 0, z: 0.9 },
    dimensions: { width: 2.0, length: 4.5, height: 1.8 },
  },
  axles: {
    front: {
      maxSteering: 0.5,
      wheelDiameter: 0.6,
      trackWidth: 1.8,
      positionX: 2.8,
      positionZ: 0.3,
    },
    rear: { maxSteering: 0, wheelDiameter: 0.6, trackWidth: 1.8, positionX: 0, positionZ: 0.3 },
  },
} as const

type PropertyBag = Readonly<Record<string, string | string[]>>

/** First value of a possibly-multi-valued property. */
function first(props: PropertyBag, key: string): string | undefined {
  const v = props[key]
  if (v === undefined) return undefined
  return Array.isArray(v) ? v[0] : v
}

/** Numeric property with a fallback (non-finite parses fall back too). */
function num(props: PropertyBag, key: string, fallback: number): number {
  const raw = first(props, key)
  if (raw === undefined) return fallback
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : fallback
}

/** String property with a fallback. */
function str(props: PropertyBag, key: string, fallback: string): string {
  return first(props, key) ?? fallback
}

/** Infer an OpenSCENARIO `ParameterType` literal from a declared value. */
function inferParameterType(value: string): string {
  if (value === 'true' || value === 'false') return 'boolean'
  if (/^[+-]?\d+$/.test(value)) return 'int'
  if (/^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(value)) return 'double'
  return 'string'
}

function toVehicle(name: string, props: PropertyBag): EngineVehicle {
  const d = DEFAULT_CAR
  return {
    name: str(props, 'name', name),
    vehicleCategory: str(props, 'vehicleCategory', d.vehicleCategory),
    performance: {
      maxSpeed: num(props, 'maxSpeed', d.performance.maxSpeed),
      maxAcceleration: num(props, 'maxAcceleration', d.performance.maxAcceleration),
      maxDeceleration: num(props, 'maxDeceleration', d.performance.maxDeceleration),
    },
    boundingBox: {
      center: { ...d.boundingBox.center },
      dimensions: {
        width: num(props, 'width', d.boundingBox.dimensions.width),
        length: num(props, 'length', d.boundingBox.dimensions.length),
        height: num(props, 'height', d.boundingBox.dimensions.height),
      },
    },
    axles: { front: { ...d.axles.front }, rear: { ...d.axles.rear } },
  }
}

function toPosition(action: SceneAction): EnginePosition {
  const relativeTo = action.references?.relativeTo ?? action.references?.entityRef
  if (relativeTo !== undefined) {
    const rel: EnginePosition['relativeLane'] = {
      entityRef: relativeTo,
      dLane: num(action.properties, 'dLane', 0),
      ds: num(action.properties, 'ds', 0),
    }
    const offset = first(action.properties, 'offset')
    return {
      relativeLane: offset === undefined ? rel : { ...rel, offset: Number.parseFloat(offset) },
    }
  }
  return {
    lane: {
      roadId: str(action.properties, 'roadId', '1'),
      laneId: str(action.properties, 'laneId', '-1'),
      s: num(action.properties, 's', 0),
      offset: num(action.properties, 'offset', 0),
    },
  }
}

function toManeuver(action: SceneAction, index: number): EngineManeuver {
  const target = action.references?.relativeTo ?? action.references?.targetRef ?? ''
  return {
    storyName: str(action.properties, 'storyName', 'Story1'),
    actName: str(action.properties, 'actName', 'Act1'),
    groupName: str(action.properties, 'groupName', `ManeuverGroup${index + 1}`),
    maneuverName: str(action.properties, 'maneuverName', `Maneuver${index + 1}`),
    eventName: str(action.properties, 'eventName', `Event${index + 1}`),
    actionName: str(action.properties, 'actionName', `Action${index + 1}`),
    priority: str(action.properties, 'priority', 'override'),
    actorRef: action.actor,
    startTime: num(action.properties, 'startTime', 0),
    laneChange: {
      targetLaneOffset: num(action.properties, 'targetLaneOffset', 0),
      dynamics: {
        dynamicsShape: str(action.properties, 'dynamicsShape', 'cubic'),
        dynamicsDimension: str(action.properties, 'dynamicsDimension', 'distance'),
        value: num(action.properties, 'dynamicsValue', 25),
      },
      relativeTarget: { entityRef: target, value: num(action.properties, 'targetValue', 0) },
    },
  }
}

/**
 * Resolve an {@link AuthoringIR} into the {@link EngineTree} the writer facade
 * lowers. Deterministic and pure — no engine call, no I/O.
 */
export function irToEngineTree(ir: AuthoringIR): EngineTree {
  const entities: EngineEntity[] = ir.entities.map((e) => ({
    name: e.ref,
    vehicle: toVehicle(e.ref, e.properties),
  }))

  // Group Init actions (speed + teleport) per entity, preserving IR order.
  const initByEntity = new Map<string, { speed?: number; teleport?: EnginePosition }>()
  const initOrder: string[] = []
  const ensureInit = (ref: string) => {
    let entry = initByEntity.get(ref)
    if (!entry) {
      entry = {}
      initByEntity.set(ref, entry)
      initOrder.push(ref)
    }
    return entry
  }

  let maneuver: EngineManeuver | undefined
  ir.actions.forEach((action, index) => {
    switch (action.kind) {
      case 'SpeedAction':
      case 'AbsoluteTargetSpeed': {
        const raw = first(action.properties, 'speed') ?? first(action.properties, 'value')
        ensureInit(action.actor).speed = raw === undefined ? 27.778 : Number.parseFloat(raw)
        break
      }
      case 'TeleportAction':
        ensureInit(action.actor).teleport = toPosition(action)
        break
      case 'LaneChangeAction':
        maneuver ??= toManeuver(action, index)
        break
      default:
        break
    }
  })

  const init: EngineInitPrivate[] = initOrder.map((ref) => ({
    entityRef: ref,
    ...initByEntity.get(ref),
  }))

  const parameters = ir.parameters
    ? Object.entries(ir.parameters).map(([name, value]) => ({
        name,
        parameterType: inferParameterType(value),
        value,
      }))
    : undefined

  const tree: EngineTree = {
    fileHeader: {
      author: 'ontology-based-nl-search',
      description: ir.archetype ? `${ir.archetype} scenario` : 'authored scenario',
      revMajor: 1,
      revMinor: 3,
      date: '2020-01-01T00:00:00',
    },
    entities,
    init,
    stopTime: 30,
  }
  return {
    ...tree,
    ...(parameters && parameters.length > 0 ? { parameters } : {}),
    ...(ir.roadNetwork ? { roadNetwork: ir.roadNetwork } : {}),
    ...(maneuver ? { maneuver } : {}),
  }
}
