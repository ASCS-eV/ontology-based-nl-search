import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'

import createOscEngine, { type OscEngineModule } from '../../wasm/osc-engine.mjs'
import { loadOscEngine } from '../engine.js'
import type { OscEngine } from '../types.js'

const cutIn = readFileSync(
  fileURLToPath(new URL('../__fixtures__/cut-in.xosc', import.meta.url)),
  'utf8'
)

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
      expect(info.engineCommit).toBe('292d0be')
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
})
