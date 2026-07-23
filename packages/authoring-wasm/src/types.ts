/**
 * Public types for the in-process OpenSCENARIO WASM engine.
 *
 * The engine is the RA Consulting `openscenario.api.test` C++ API (Apache-2.0)
 * compiled to WebAssembly. Everything crosses the WASM boundary as strings +
 * plain data — no native handles leak into TypeScript.
 *
 * [OSC-XSD] OpenSCENARIO 1.3 — the checker rules the engine runs are generated
 * from the ASAM UML model (range/cardinality/union/enum + parameter resolution).
 */

/** Capability descriptor returned by {@link OscEngine.describe}. */
export interface EngineInfo {
  /** Engine implementation identifier. */
  readonly engine: string
  /** Pinned RAC submodule commit the binary was built from. */
  readonly engineCommit: string
  /** OpenSCENARIO versions this build supports. */
  readonly oscVersions: readonly string[]
  /** OpenSCENARIO XSD version the checker targets. */
  readonly xsd: string
}

/** Diagnostic severity, normalized from the engine's `ErrorLevel` enum. */
export type Severity = 'error' | 'warning' | 'info'

/** A single validation diagnostic with source location. */
export interface Diagnostic {
  readonly severity: Severity
  /** 1-based source line, or 0 when the engine reports no marker. */
  readonly line: number
  /** 1-based source column, or 0 when the engine reports no marker. */
  readonly col: number
  /** Human-readable message from the checker rule. */
  readonly message: string
}

/** Result of {@link OscEngine.validate}. `ok` is false iff any error/fatal. */
export interface ValidationResult {
  readonly ok: boolean
  readonly diagnostics: readonly Diagnostic[]
}

/**
 * Extra files to place on the engine's in-memory filesystem before validation,
 * keyed by the path the scenario references them at (e.g. catalog imports).
 * Paths are resolved relative to the scenario's directory, exactly as a real
 * OpenSCENARIO tool resolves catalog/import references.
 */
export type EngineFiles = Readonly<Record<string, string>>

/**
 * The in-process OpenSCENARIO engine. Load once via {@link loadOscEngine}, then
 * call in-process — mirroring `WorkerOxigraphStore` in packages/sparql.
 */
export interface OscEngine {
  /** Report engine / OSC / XSD versions (a capability probe). */
  describe(): EngineInfo
  /**
   * Validate a scenario. `xosc` is the main document; `files` supplies any
   * referenced catalogs/imports by their referenced path.
   */
  validate(xosc: string, files?: EngineFiles): ValidationResult
  /**
   * Author a `.xosc` document from a resolved {@link EngineTree}. The typed
   * writer factory (generated from the ASAM UML model) owns element order,
   * `xsd:choice` selection and attribute-vs-element placement, so emitted
   * documents are structurally standard by construction. Deterministic: the
   * same tree yields a byte-identical document. Throws on an authoring fault.
   */
  author(tree: EngineTree): string
}

// ---------------------------------------------------------------------------
// Engine tree — the resolved, engine-facing description the writer facade
// lowers to `.xosc`. It is NOT the LLM-facing IR (that is the generic,
// SHACL-keyed AuthoringIR in packages/authoring-ir); packages/authoring maps
// the IR onto this concrete tree (ir-to-engine.ts). Numbers are plain doubles;
// enum-valued fields carry the OpenSCENARIO literal (e.g. `"car"`, `"cubic"`).
//
// [OSC-XSD] OpenSCENARIO 1.3 — field names and nesting mirror the standard's
// model elements the writer factory materializes.

/** A vehicle axle → `<FrontAxle>` / `<RearAxle>`. */
export interface EngineAxle {
  readonly maxSteering: number
  readonly wheelDiameter: number
  readonly trackWidth: number
  readonly positionX: number
  readonly positionZ: number
}

/** A vehicle → `<Vehicle>`. */
export interface EngineVehicle {
  readonly name: string
  readonly vehicleCategory: string
  readonly performance?: {
    readonly maxSpeed: number
    readonly maxAcceleration: number
    readonly maxDeceleration: number
  }
  readonly boundingBox?: {
    readonly center: { readonly x: number; readonly y: number; readonly z: number }
    readonly dimensions: {
      readonly width: number
      readonly length: number
      readonly height: number
    }
  }
  readonly axles?: { readonly front?: EngineAxle; readonly rear?: EngineAxle }
}

/** A scenario object → `<ScenarioObject>` wrapping a vehicle. */
export interface EngineEntity {
  readonly name: string
  readonly vehicle: EngineVehicle
}

/** A teleport position → `<LanePosition>` or `<RelativeLanePosition>`. */
export interface EnginePosition {
  readonly lane?: {
    readonly roadId: string
    readonly laneId: string
    readonly s: number
    readonly offset: number
  }
  readonly relativeLane?: {
    readonly entityRef: string
    readonly dLane: number
    readonly ds: number
    readonly offset?: number
  }
}

/** An entity's Init actions → a `<Private>` (initial speed + teleport). */
export interface EngineInitPrivate {
  readonly entityRef: string
  readonly speed?: number
  readonly teleport?: EnginePosition
}

/** The single lane-change maneuver → `<Story>/<Act>/…/<LaneChangeAction>`. */
export interface EngineManeuver {
  readonly storyName?: string
  readonly actName?: string
  readonly groupName?: string
  readonly maneuverName?: string
  readonly eventName?: string
  readonly actionName?: string
  readonly priority?: string
  readonly actorRef: string
  readonly startTime?: number
  readonly laneChange: {
    readonly targetLaneOffset: number
    readonly dynamics: {
      readonly dynamicsShape: string
      readonly dynamicsDimension: string
      readonly value: number
    }
    readonly relativeTarget: { readonly entityRef: string; readonly value: number }
  }
}

/** The resolved scenario the writer facade lowers to a `.xosc` document. */
export interface EngineTree {
  readonly fileHeader?: {
    readonly author?: string
    readonly description?: string
    readonly revMajor?: number
    readonly revMinor?: number
    readonly date?: string
  }
  readonly parameters?: ReadonlyArray<{
    readonly name: string
    readonly parameterType: string
    readonly value: string
  }>
  readonly roadNetwork?: { readonly logicFile?: string; readonly sceneGraphFile?: string }
  readonly entities?: readonly EngineEntity[]
  readonly init?: readonly EngineInitPrivate[]
  readonly maneuver?: EngineManeuver
  readonly stopTime?: number
}
