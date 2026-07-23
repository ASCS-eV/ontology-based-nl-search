import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'

import createOscEngine, { type OscEngineModule } from '../../wasm/osc-engine.mjs'
import { loadOscEngine } from '../engine.js'
import type { EngineTree, EngineVehicle, OscEngine } from '../types.js'

const cutIn = readFileSync(
  fileURLToPath(new URL('../__fixtures__/cut-in.xosc', import.meta.url)),
  'utf8'
)

const versions = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../versions.json', import.meta.url)), 'utf8')
) as {
  engine: string
  engineCommit: string
  oscVersions: string[]
  xsd: string
}

describe('loadOscEngine', () => {
  let engine: OscEngine
  let raw: OscEngineModule

  beforeAll(async () => {
    engine = await loadOscEngine()
    raw = await createOscEngine()
  })

  describe('describe()', () => {
    it('reports the engine, OSC version and pinned commit', () => {
      const info = engine.describe()
      expect(info.engine).toContain('openscenario.api.test')
      expect(info.oscVersions).toContain('1.3')
      expect(info.xsd).toBe('1.3.0')
      expect(info.engineCommit).toBe('292d0be84530145f7a09ae5a2a7f9bd63db7e3f3')
    })

    it('cannot drift from versions.json (single source of truth)', () => {
      // describe() is generated at build time from versions.json, so the WASM
      // payload must deep-equal the neutral pin. Guards against a stale rebuild.
      expect(engine.describe()).toEqual({
        engine: versions.engine,
        engineCommit: versions.engineCommit,
        oscVersions: versions.oscVersions,
        xsd: versions.xsd,
      })
    })
  })

  describe('validate()', () => {
    it('accepts a valid OpenSCENARIO 1.3 scenario', () => {
      const result = engine.validate(cutIn)
      expect(result.ok).toBe(true)
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    })

    it('rejects an invalid enum value with a precise, located diagnostic', () => {
      const bad = cutIn.replace('dynamicsShape="step"', 'dynamicsShape="bogus"')
      const result = engine.validate(bad)
      expect(result.ok).toBe(false)
      const err = result.diagnostics.find((d) => d.severity === 'error')
      expect(err).toBeDefined()
      expect(err?.message).toContain('bogus')
      expect(err?.line).toBeGreaterThan(0)
      expect(err?.col).toBeGreaterThan(0)
      // The internal MEMFS path must never leak into the message.
      expect(err?.message).not.toContain('/work/')
    })

    it('rejects a non-numeric value where a double is required', () => {
      const bad = cutIn.replace('value="54.8254917969"', 'value="notanumber"')
      const result = engine.validate(bad)
      expect(result.ok).toBe(false)
      expect(
        result.diagnostics.some((d) => d.severity === 'error' && /double|number/i.test(d.message))
      ).toBe(true)
    })

    it('reports a fatal diagnostic for malformed XML rather than throwing', () => {
      const result = engine.validate('<OpenSCENARIO><not-closed>')
      expect(result.ok).toBe(false)
      expect(result.diagnostics.length).toBeGreaterThan(0)
    })

    it('is deterministic across repeated validations', () => {
      const a = engine.validate(cutIn)
      const b = engine.validate(cutIn)
      expect(a).toEqual(b)
    })

    it('writes companion files alongside the scenario and cleans them up', () => {
      // A self-contained scenario is unaffected by extra companion files, but
      // the nested-path write exercises the catalog-staging branch and its
      // best-effort cleanup — a second call must still be deterministic.
      const files = {
        'Catalogs/Vehicles/VehicleCatalog.xosc':
          '<?xml version="1.0"?>\n<OpenSCENARIO><Catalog name="Vehicles"/></OpenSCENARIO>\n',
      }
      const withFiles = engine.validate(cutIn, files)
      const plain = engine.validate(cutIn)
      expect(withFiles).toEqual(plain)
    })
  })

  // Engine-level regression guards for the author/writer path (PoC-4 exit
  // criterion 3). These call the raw embind surface directly.
  describe('writer determinism (engine guard)', () => {
    it('re-serializes a parsed scenario byte-identically across runs', () => {
      raw.FS.writeFile('/rt.xosc', cutIn)
      const first = raw.roundtripExport('/rt.xosc')
      const second = raw.roundtripExport('/rt.xosc')
      expect(first.startsWith('<?xml')).toBe(true)
      expect(first).toBe(second)
      raw.FS.unlink('/rt.xosc')
    })

    it('authors a well-formed scenario from scratch, deterministically', () => {
      const a = raw.authorMinimal()
      const b = raw.authorMinimal()
      expect(a.startsWith('<?xml')).toBe(true)
      expect(a).toContain('<FileHeader')
      expect(a).toBe(b)
    })

    it('produces a from-scratch document that re-parses without fatal errors', () => {
      const authored = raw.authorMinimal()
      raw.FS.writeFile('/authored.xosc', authored)
      const parsed = JSON.parse(raw.validate('/authored.xosc')) as { fatal?: string }
      expect(parsed.fatal).toBeUndefined()
      raw.FS.unlink('/authored.xosc')
    })
  })

  // The full IR→writer facade (task 04): a resolved engine tree → a complete,
  // schema-valid cut-in .xosc, gated by the same checker.
  describe('author() — full cut-in from an engine tree', () => {
    const car = (name: string): EngineVehicle => ({
      name,
      vehicleCategory: 'car',
      performance: { maxSpeed: 69.444, maxAcceleration: 10, maxDeceleration: 10 },
      boundingBox: {
        center: { x: 1.4, y: 0, z: 0.9 },
        dimensions: { width: 2, length: 4.5, height: 1.8 },
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
    })

    const cutInTree = (): EngineTree => ({
      fileHeader: {
        author: 'test',
        description: 'cut-in',
        revMajor: 1,
        revMinor: 3,
        date: '2020-02-21T10:00:00',
      },
      parameters: [{ name: 'owner', parameterType: 'string', value: 'A2' }],
      roadNetwork: { logicFile: 'Databases/AB_RQ31_Straight.xodr' },
      entities: [
        { name: 'Ego', vehicle: car('HAF') },
        { name: 'A1', vehicle: car('Default_Car') },
        { name: 'A2', vehicle: car('Default_Car') },
      ],
      init: [
        {
          entityRef: 'Ego',
          speed: 27.778,
          teleport: { lane: { roadId: '1', laneId: '-3', s: 1000, offset: 0.5 } },
        },
        {
          entityRef: 'A1',
          speed: 27.778,
          teleport: { relativeLane: { entityRef: 'Ego', dLane: 0, ds: 84 } },
        },
        {
          entityRef: 'A2',
          speed: 30.556,
          teleport: { relativeLane: { entityRef: 'Ego', dLane: 1, ds: -100 } },
        },
      ],
      maneuver: {
        actorRef: 'A2',
        startTime: 2,
        laneChange: {
          targetLaneOffset: 0,
          dynamics: { dynamicsShape: 'cubic', dynamicsDimension: 'distance', value: 54.8 },
          relativeTarget: { entityRef: 'Ego', value: 0 },
        },
      },
      stopTime: 30,
    })

    it('emits a schema-valid cut-in that passes the checker', () => {
      const xosc = engine.author(cutInTree())
      expect(xosc.startsWith('<?xml')).toBe(true)
      const result = engine.validate(xosc)
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
      expect(result.ok).toBe(true)
    })

    it('is deterministic — the same tree yields a byte-identical document', () => {
      expect(engine.author(cutInTree())).toBe(engine.author(cutInTree()))
    })

    it('faithfully emits values so the range gate has teeth (maxSteering > PI)', () => {
      const tree = cutInTree()
      const tampered: EngineTree = {
        ...tree,
        entities: [
          {
            name: 'Ego',
            vehicle: {
              ...car('HAF'),
              axles: {
                front: {
                  maxSteering: 10,
                  wheelDiameter: 0.6,
                  trackWidth: 1.8,
                  positionX: 2.8,
                  positionZ: 0.3,
                },
              },
            },
          },
          ...tree.entities!.slice(1),
        ],
      }
      const result = engine.validate(engine.author(tampered))
      expect(result.ok).toBe(false)
      expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true)
    })
  })
})
