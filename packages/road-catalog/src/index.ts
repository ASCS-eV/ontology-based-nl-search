/**
 * Curated OpenDRIVE road catalog — the single source every consumer resolves a
 * road by `logicFile`:
 *
 *   - the authoring gates (semantic cross-file `.xosc`↔`.xodr` + residual geometry)
 *     bind {@link CatalogRoad.xodr} so they RUN instead of being skipped;
 *   - the qc / esmini self-test validates against the same bytes;
 *   - the browser scenario viewer mounts the same bytes into the engine FS.
 *
 * "What you validate is what you see": the bytes are identical across all three.
 *
 * The road data (bytes + discovered topology) is machine-generated from the pinned
 * `asam-openx-assets` submodule by `native/generate.mjs`; this module only resolves
 * and describes it. No OpenDRIVE ids are hand-authored here — the archetype guidance
 * is derived from the discovered topology so it cannot drift from the geometry.
 */
import { ROADS } from './road-data.generated.js'
import type { CatalogRoad, DrivableLane, RoadSegment } from './types.js'

export { ROADS } from './road-data.generated.js'
export type {
  CatalogRoad,
  DrivableLane,
  LaneSide,
  RoadProvenance,
  RoadSegment,
  RoadTopology,
  TrafficRule,
} from './types.js'

/** The bare filename of a path, tolerant of both `/` and `\` separators. */
function basename(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return cut >= 0 ? path.slice(cut + 1) : path
}

/**
 * Resolve a catalog road by the `logicFile` a scenario references. Matches on the
 * bare filename, so `german_highway_short.xodr`, `xodr/german_highway_short.xodr`
 * and `Databases/german_highway_short.xodr` all resolve to the same road.
 */
export function getRoad(logicFile: string): CatalogRoad | undefined {
  const wanted = basename(logicFile)
  return ROADS.find((r) => basename(r.logicFile) === wanted)
}

/** The default catalog road (the archetype road). Throws if the catalog is empty. */
export function defaultRoad(): CatalogRoad {
  const road = ROADS[0]
  if (!road)
    throw new Error(
      'road-catalog: no roads generated — run `pnpm --filter @ontology-search/road-catalog generate`'
    )
  return road
}

/** The entry road segment of a catalog road (where entities are placed by default). */
export function entrySegment(road: CatalogRoad): RoadSegment {
  const entry = road.topology.roads.find((r) => r.id === road.topology.entryRoadId)
  if (!entry)
    throw new Error(`road-catalog: entry road ${road.topology.entryRoadId} not found in ${road.id}`)
  return entry
}

/**
 * The drivable lanes on the travel side of the entry road, ordered inner→outer
 * (ascending |laneId|). For right-hand traffic these are the negative-id lanes;
 * for left-hand traffic the positive-id lanes. This is the set the archetype may
 * place entities on and change between.
 */
export function travelSideLanes(road: CatalogRoad): readonly DrivableLane[] {
  const side = road.topology.rule === 'RHT' ? 'right' : 'left'
  return entrySegment(road)
    .drivableLanes.filter((l) => l.side === side)
    .slice()
    .sort((a, b) => Math.abs(Number(a.laneId)) - Math.abs(Number(b.laneId)))
}

/**
 * Human-/LLM-readable placement guidance for a road, derived entirely from its
 * discovered topology. The authoring prompt embeds this so the model places
 * entities on lanes that actually exist and sets `roadNetwork.logicFile`
 * correctly — the precondition for the cross-file gate to pass and for the viewer
 * to render what was validated.
 */
export function describeRoadForPrompt(road: CatalogRoad): string {
  const entry = entrySegment(road)
  const lanes = travelSideLanes(road)
  const laneList = lanes.map((l) => l.laneId).join(', ')
  const rule = road.topology.rule === 'RHT' ? 'right-hand traffic' : 'left-hand traffic'
  const inner = lanes[0]?.laneId
  const outer = lanes[lanes.length - 1]?.laneId
  const successor = entry.successorRoadId ? ` It continues into road ${entry.successorRoadId}.` : ''
  return [
    `The scenario runs on the fixed road network \`${road.logicFile}\` (${rule}).`,
    `Set \`roadNetwork.logicFile\` to \`${road.logicFile}\`.`,
    `Place every entity on road id ${entry.id} (length ${Math.floor(entry.length)} m).${successor}`,
    `The drivable travel-side lanes are: ${laneList}` +
      (inner !== undefined && outer !== undefined && inner !== outer
        ? ` (${inner} is the inner lane, ${outer} the outer lane).`
        : '.'),
    `Use \`s\` within [0, ${Math.floor(entry.length)}] and only these lane ids — do not invent other road or lane ids.`,
  ].join(' ')
}
