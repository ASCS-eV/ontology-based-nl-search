/**
 * Pure coordinate math for the scenario viewer, kept free of three.js and the
 * WASM engine so it is unit-testable in jsdom (WebGL is not).
 *
 * esmini/OpenDRIVE use a right-handed ground frame: x east, y north, z up,
 * distances in metres, headings in radians (CCW from +x). three.js is also
 * right-handed but with +y up. We map:
 *
 *   three.x =  world.x      (east)
 *   three.y =  world.z      (up)
 *   three.z = -world.y      (north → -z)
 *
 * A heading `h` (rotation about world +z) becomes a rotation about three +y by
 * the same angle: rotating three's basis about +y by `h` sends local +X to
 * (cos h, 0, -sin h), which is exactly the mapped heading vector (cos h, sin h).
 * So a mesh whose forward axis is local +X is oriented with `rotation.y = h`.
 */

/** A minimal 3-vector, decoupled from three.js so this module has no deps. */
export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Anything carrying world-frame coordinates (RoadPoint / ObjectState). */
interface WorldPoint {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Map a world-frame point to the three.js frame (see module docstring). */
export function worldToThree(x: number, y: number, z: number): Vec3 {
  return { x, y: z, z: -y }
}

/** The three.js Y-rotation (radians) that orients a +X-forward mesh to heading `h`. */
export function headingToThreeRotationY(h: number): number {
  return h
}

/** Axis-aligned bounds plus derived centre/size, all in the three.js frame. */
export interface Bounds {
  readonly min: Vec3
  readonly max: Vec3
  readonly center: Vec3
  readonly size: Vec3
}

/**
 * Compute the bounding box of a set of three-frame points. Returns a zero box
 * centred at the origin for an empty input so callers never divide by an
 * undefined extent.
 */
export function boundsOf(points: readonly Vec3[]): Bounds {
  if (points.length === 0) {
    const zero = { x: 0, y: 0, z: 0 }
    return { min: zero, max: zero, center: zero, size: zero }
  }
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.z < minZ) minZ = p.z
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
    if (p.z > maxZ) maxZ = p.z
  }
  const min = { x: minX, y: minY, z: minZ }
  const max = { x: maxX, y: maxY, z: maxZ }
  return {
    min,
    max,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
  }
}

/** A polyline as an array of world points (RoadMark / LaneCenter `points`). */
interface Polyline {
  readonly points: readonly WorldPoint[]
}

/** A lane surface bounded by two world-frame polylines. */
interface Boundaries {
  readonly leftBoundary: readonly WorldPoint[]
  readonly rightBoundary: readonly WorldPoint[]
}

/** The subset of RoadGeometry this module reads (structurally typed). */
export interface RoadLike {
  readonly laneSurfaces: readonly Boundaries[]
  readonly roadMarks: readonly Polyline[]
  readonly laneCenters: readonly Polyline[]
}

/**
 * Flatten every road polyline vertex into three-frame points — used to frame the
 * camera over the drivable extent.
 */
export function roadThreePoints(road: RoadLike): Vec3[] {
  const out: Vec3[] = []
  const push = (p: WorldPoint) => out.push(worldToThree(p.x, p.y, p.z))
  for (const s of road.laneSurfaces) {
    s.leftBoundary.forEach(push)
    s.rightBoundary.forEach(push)
  }
  for (const m of road.roadMarks) m.points.forEach(push)
  for (const c of road.laneCenters) c.points.forEach(push)
  return out
}

/** Centroid of a set of object world positions, mapped to the three.js frame. */
export function objectsCentroidThree(objects: readonly WorldPoint[]): Vec3 {
  if (objects.length === 0) return { x: 0, y: 0, z: 0 }
  let sx = 0
  let sy = 0
  let sz = 0
  for (const o of objects) {
    const t = worldToThree(o.x, o.y, o.z)
    sx += t.x
    sy += t.y
    sz += t.z
  }
  return { x: sx / objects.length, y: sy / objects.length, z: sz / objects.length }
}
