import { describe, expect, it, vi } from 'vitest'

import type {
  EmscriptenFS,
  EsminiModule,
  OpenScenarioHandle,
  RawOpenScenarioConfig,
} from '../esmini-module.js'
import { loadScenario } from '../load-esmini.js'
import { HandleRegistry, MockHandle } from './mocks.js'

/** An in-memory FS that records writes and models Emscripten's EEXIST on mkdir. */
class MockFS implements EmscriptenFS {
  readonly files = new Map<string, string | Uint8Array>()
  readonly dirs = new Set<string>(['/'])

  writeFile(path: string, data: string | Uint8Array): void {
    this.files.set(path, data)
  }

  mkdir(path: string): void {
    if (this.dirs.has(path)) throw new Error(`EEXIST: ${path}`)
    this.dirs.add(path)
  }

  unlink(path: string): void {
    this.files.delete(path)
  }
}

function mockFactory() {
  const registry = new HandleRegistry()
  const fs = new MockFS()
  const construct = vi.fn(
    (_xoscPath: string, _config: RawOpenScenarioConfig): OpenScenarioHandle =>
      new MockHandle({ registry })
  )
  const module: EsminiModule = {
    FS: fs,
    OpenScenario: construct as unknown as EsminiModule['OpenScenario'],
  }
  const factory = vi.fn(async () => module)
  return { factory, fs, construct }
}

describe('loadScenario', () => {
  it('mounts the scenario at the default path and constructs the handle', async () => {
    const { factory, fs, construct } = mockFactory()
    const scenario = await loadScenario(factory, { xosc: '<OpenSCENARIO/>' })

    expect(fs.files.get('/scenario.xosc')).toBe('<OpenSCENARIO/>')
    expect(construct).toHaveBeenCalledWith('/scenario.xosc', {
      max_loop: 10000,
      min_time_step: 1 / 120,
      max_time_step: 1 / 25,
      dt: 0,
    })
    // The returned facade wraps a live handle.
    expect(scenario.objectCount()).toBe(1)
  })

  it('mounts companion road files under the MEMFS root by their referenced name', async () => {
    const { factory, fs } = mockFactory()
    await loadScenario(factory, {
      xosc: '<OpenSCENARIO/>',
      files: { 'german_highway_short.xodr': '<OpenDRIVE/>' },
    })
    expect(fs.files.get('/german_highway_short.xodr')).toBe('<OpenDRIVE/>')
  })

  it('creates intermediate directories for nested file references', async () => {
    const { factory, fs } = mockFactory()
    await loadScenario(factory, {
      xosc: '<OpenSCENARIO/>',
      files: { 'xodr/nested/road.xodr': '<OpenDRIVE/>' },
    })
    expect(fs.dirs.has('/xodr')).toBe(true)
    expect(fs.dirs.has('/xodr/nested')).toBe(true)
    expect(fs.files.get('/xodr/nested/road.xodr')).toBe('<OpenDRIVE/>')
  })

  it('honours a custom scenario path and config overrides', async () => {
    const { factory, fs, construct } = mockFactory()
    await loadScenario(factory, {
      xosc: '<OpenSCENARIO/>',
      scenarioPath: '/sim/cut-in.xosc',
      config: { dt: 0.04 },
    })
    expect(fs.files.get('/sim/cut-in.xosc')).toBe('<OpenSCENARIO/>')
    expect(fs.dirs.has('/sim')).toBe(true)
    expect(construct).toHaveBeenCalledWith(
      '/sim/cut-in.xosc',
      expect.objectContaining({ dt: 0.04 })
    )
  })
})
