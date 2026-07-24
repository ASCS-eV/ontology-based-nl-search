/**
 * three.js renderer for an esmini scenario, deliberately framework-agnostic so
 * the React island (ScenarioViewer) only wires lifecycle/DOM concerns to it.
 *
 * Design for a safe endless-loop preview:
 *  - the static road geometry is built into meshes ONCE (it never changes);
 *  - each animation tick advances the scenario by the real elapsed dt and moves
 *    per-entity meshes — no per-frame allocation of geometry;
 *  - `advance()` (in the facade) resets the run when it ends, so the loop plays
 *    forever;
 *  - every GPU resource created here is tracked and freed in `dispose()`, and
 *    the RAF loop is always cancelled — a mounted/unmounted viewer must not leak
 *    WebGL contexts or keep stepping the WASM engine in the background.
 *
 * All coordinate math lives in scenario-geometry.ts (unit-tested); this file is
 * exercised by the apps/e2e Playwright test in a real browser.
 */
import type {
  EsminiScenario,
  ObjectState,
  RoadGeometry,
} from '@ontology-search/scenario-viewer-wasm'
import * as THREE from 'three'

import {
  boundsOf,
  headingToThreeRotationY,
  objectsCentroidThree,
  roadThreePoints,
  worldToThree,
} from './scenario-geometry'

export interface ScenarioRendererOptions {
  /** Invoked if the WebGL context is lost; the caller should show a fallback. */
  readonly onContextLost?: () => void
}

/** Largest simulation step applied per frame, so a paused/backgrounded tab that
 * resumes doesn't teleport entities by a huge dt. */
const MAX_STEP_S = 0.1

/** Fixed chase offset (three.js metres): behind (−x), above (+y) and to the side. */
const CAMERA_OFFSET = new THREE.Vector3(-35, 40, 45)

export class ScenarioRenderer {
  readonly #canvas: HTMLCanvasElement
  readonly #renderer: THREE.WebGLRenderer
  readonly #scene: THREE.Scene
  readonly #camera: THREE.PerspectiveCamera
  readonly #vehicles = new Map<number, THREE.Mesh>()
  readonly #disposables = new Set<THREE.BufferGeometry | THREE.Material>()
  readonly #target = new THREE.Vector3()
  readonly #onContextLost?: () => void

  #scenario: EsminiScenario | null = null
  #raf = 0
  #lastTs = 0
  #disposed = false

  constructor(canvas: HTMLCanvasElement, options: ScenarioRendererOptions = {}) {
    this.#canvas = canvas
    this.#onContextLost = options.onContextLost

    this.#renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.#renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2))

    this.#scene = new THREE.Scene()
    this.#scene.background = new THREE.Color(0xeaeef3)

    this.#camera = new THREE.PerspectiveCamera(50, 1, 0.1, 6000)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x555a63, 1.1)
    const dir = new THREE.DirectionalLight(0xffffff, 1.4)
    dir.position.set(-0.4, 1, 0.6)
    this.#scene.add(hemi, dir)

    canvas.addEventListener('webglcontextlost', this.#handleContextLost)
    this.resize()
  }

  #handleContextLost = (event: Event): void => {
    event.preventDefault()
    this.pause()
    this.#onContextLost?.()
  }

  /** Build the road meshes, cache the scenario, and frame the camera. */
  load(road: RoadGeometry, scenario: EsminiScenario): void {
    this.#scenario = scenario
    this.#buildRoad(road)
    this.#frameCamera(road)
  }

  #buildRoad(road: RoadGeometry): void {
    const surfaceMat = new THREE.MeshStandardMaterial({
      color: 0x3a3f47,
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    })
    this.#disposables.add(surfaceMat)

    for (const surface of road.laneSurfaces) {
      const geom = this.#ribbonGeometry(surface.leftBoundary, surface.rightBoundary)
      if (!geom) continue
      this.#disposables.add(geom)
      this.#scene.add(new THREE.Mesh(geom, surfaceMat))
    }

    const whiteMat = new THREE.LineBasicMaterial({ color: 0xf4f6f8 })
    const yellowMat = new THREE.LineBasicMaterial({ color: 0xf2c14e })
    this.#disposables.add(whiteMat)
    this.#disposables.add(yellowMat)

    for (const mark of road.roadMarks) {
      if (mark.points.length < 2) continue
      const positions = new Float32Array(mark.points.length * 3)
      mark.points.forEach((p, i) => {
        const t = worldToThree(p.x, p.y, p.z)
        positions[i * 3] = t.x
        positions[i * 3 + 1] = t.y + 0.02 // lift lines just above the surface
        positions[i * 3 + 2] = t.z
      })
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      this.#disposables.add(geom)
      const mat = mark.color.toLowerCase().includes('yellow') ? yellowMat : whiteMat
      this.#scene.add(new THREE.Line(geom, mat))
    }
  }

  /** A triangle-strip ribbon between two boundary polylines (drivable surface). */
  #ribbonGeometry(
    left: RoadGeometry['laneSurfaces'][number]['leftBoundary'],
    right: RoadGeometry['laneSurfaces'][number]['rightBoundary']
  ): THREE.BufferGeometry | null {
    const n = Math.min(left.length, right.length)
    if (n < 2) return null
    const positions = new Float32Array(n * 2 * 3)
    for (let i = 0; i < n; i++) {
      const l = worldToThree(left[i]!.x, left[i]!.y, left[i]!.z)
      const r = worldToThree(right[i]!.x, right[i]!.y, right[i]!.z)
      positions[i * 6] = l.x
      positions[i * 6 + 1] = l.y
      positions[i * 6 + 2] = l.z
      positions[i * 6 + 3] = r.x
      positions[i * 6 + 4] = r.y
      positions[i * 6 + 5] = r.z
    }
    const indices: number[] = []
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2
      const b = i * 2 + 1
      const c = i * 2 + 2
      const d = i * 2 + 3
      indices.push(a, b, d, a, d, c)
    }
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setIndex(indices)
    geom.computeVertexNormals()
    return geom
  }

  #frameCamera(road: RoadGeometry): void {
    const bounds = boundsOf(roadThreePoints(road))
    this.#target.set(bounds.center.x, bounds.center.y, bounds.center.z)
    this.#camera.position.set(
      bounds.center.x + CAMERA_OFFSET.x,
      bounds.center.y + CAMERA_OFFSET.y,
      bounds.center.z + CAMERA_OFFSET.z
    )
    this.#camera.lookAt(this.#target)
  }

  #ensureVehicle(o: ObjectState): THREE.Mesh {
    const existing = this.#vehicles.get(o.id)
    if (existing) return existing
    const geom = new THREE.BoxGeometry(
      Math.max(o.length, 0.5),
      Math.max(o.height, 0.5),
      Math.max(o.width, 0.5)
    )
    const mat = new THREE.MeshStandardMaterial({
      color: o.name === 'Ego' ? 0x2563eb : 0xf97316,
      roughness: 0.5,
      metalness: 0.1,
    })
    this.#disposables.add(geom)
    this.#disposables.add(mat)
    const mesh = new THREE.Mesh(geom, mat)
    this.#vehicles.set(o.id, mesh)
    this.#scene.add(mesh)
    return mesh
  }

  #updateObjects(objects: readonly ObjectState[]): void {
    for (const o of objects) {
      const mesh = this.#ensureVehicle(o)
      const pos = worldToThree(o.x, o.y, o.z)
      mesh.position.set(pos.x, pos.y + o.height / 2, pos.z)
      mesh.rotation.set(0, headingToThreeRotationY(o.h), 0)
    }
  }

  #updateCamera(objects: readonly ObjectState[]): void {
    if (objects.length === 0) return
    const c = objectsCentroidThree(objects)
    this.#target.set(c.x, c.y, c.z)
    this.#camera.position.set(c.x + CAMERA_OFFSET.x, c.y + CAMERA_OFFSET.y, c.z + CAMERA_OFFSET.z)
    this.#camera.lookAt(this.#target)
  }

  /** Step the scenario by `dt` seconds (clamped) and draw one frame. */
  #renderStep(dt: number): void {
    if (this.#disposed || !this.#scenario) return
    const frame = this.#scenario.advance(Math.min(Math.max(dt, 0), MAX_STEP_S))
    this.#updateObjects(frame.objects)
    this.#updateCamera(frame.objects)
    this.#renderer.render(this.#scene, this.#camera)
  }

  /** Draw a single frame without starting the loop (used for reduced-motion). */
  renderOnce(): void {
    this.#renderStep(0)
  }

  /** Start the endless-loop animation. Idempotent. */
  play(): void {
    if (this.#disposed || this.#raf !== 0) return
    this.#lastTs = 0
    const tick = (ts: number): void => {
      if (this.#disposed) return
      const dt = this.#lastTs === 0 ? 0 : (ts - this.#lastTs) / 1000
      this.#lastTs = ts
      this.#renderStep(dt)
      this.#raf = requestAnimationFrame(tick)
    }
    this.#raf = requestAnimationFrame(tick)
  }

  /** Stop the animation loop. Idempotent; keeps all resources for a later play(). */
  pause(): void {
    if (this.#raf !== 0) {
      cancelAnimationFrame(this.#raf)
      this.#raf = 0
    }
  }

  /** Match the drawing buffer + camera aspect to the canvas's CSS size. */
  resize(): void {
    if (this.#disposed) return
    const width = this.#canvas.clientWidth || 1
    const height = this.#canvas.clientHeight || 1
    this.#renderer.setSize(width, height, false)
    this.#camera.aspect = width / height
    this.#camera.updateProjectionMatrix()
    if (this.#raf === 0) this.#renderer.render(this.#scene, this.#camera)
  }

  /** Free every GPU resource and stop the loop. Idempotent; safe after unmount. */
  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.pause()
    this.#canvas.removeEventListener('webglcontextlost', this.#handleContextLost)
    for (const resource of this.#disposables) resource.dispose()
    this.#disposables.clear()
    this.#vehicles.clear()
    this.#renderer.dispose()
    this.#scenario = null
  }
}
