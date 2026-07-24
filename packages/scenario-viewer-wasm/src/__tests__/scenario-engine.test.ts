import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SCENARIO_CONFIG,
  EsminiScenario,
  ScenarioDisposedError,
  toRawConfig,
} from '../scenario-engine.js'
import { HandleRegistry, MockHandle, type MockHandleOptions, objectState } from './mocks.js'

function makeScenario(opts: Partial<MockHandleOptions> = {}) {
  const registry = new HandleRegistry()
  const handle = new MockHandle({ registry, ...opts })
  return { registry, handle, scenario: new EsminiScenario(handle) }
}

describe('toRawConfig', () => {
  it('uses esmini defaults when nothing is provided', () => {
    expect(toRawConfig()).toEqual({
      max_loop: DEFAULT_SCENARIO_CONFIG.maxLoop,
      min_time_step: DEFAULT_SCENARIO_CONFIG.minTimeStep,
      max_time_step: DEFAULT_SCENARIO_CONFIG.maxTimeStep,
      dt: DEFAULT_SCENARIO_CONFIG.dt,
    })
  })

  it('applies partial overrides on top of the defaults', () => {
    expect(toRawConfig({ dt: 0.02, maxLoop: 500 })).toEqual({
      max_loop: 500,
      min_time_step: DEFAULT_SCENARIO_CONFIG.minTimeStep,
      max_time_step: DEFAULT_SCENARIO_CONFIG.maxTimeStep,
      dt: 0.02,
    })
  })
})

describe('EsminiScenario delegation', () => {
  it('reports object count and simulation time from the handle', () => {
    const { scenario } = makeScenario({ objectCount: 3 })
    expect(scenario.objectCount()).toBe(3)
    expect(scenario.simulationTime()).toBe(0)
    scenario.stepFrame()
    expect(scenario.simulationTime()).toBe(0.05)
  })

  it('stepFrame returns a plain frame and leaks nothing', () => {
    const { registry, handle, scenario } = makeScenario({ states: [objectState({ name: 'Ego' })] })
    const frame = scenario.stepFrame(0.1)
    expect(frame.objects[0]?.name).toBe('Ego')
    expect(handle.stepCount).toBe(1)
    expect(registry.liveCount()).toBe(0)
  })

  it('reset delegates to the handle', () => {
    const { handle, scenario } = makeScenario()
    scenario.reset()
    expect(handle.resetCount).toBe(1)
  })

  it('isQuit reflects the handle', () => {
    const { scenario } = makeScenario({ quitSequence: [true] })
    expect(scenario.isQuit()).toBe(true)
  })
})

describe('EsminiScenario.roadGeometry caching', () => {
  it('parses the road geometry exactly once and caches it', () => {
    const { handle, scenario } = makeScenario()
    const first = scenario.roadGeometry()
    const second = scenario.roadGeometry()
    expect(second).toBe(first) // same cached object reference
    expect(handle.roadGeometryCount).toBe(1)
  })

  it('leaves no handles alive after parsing', () => {
    const { registry, scenario } = makeScenario()
    scenario.roadGeometry()
    expect(registry.liveCount()).toBe(0)
  })
})

describe('EsminiScenario.advance (endless loop)', () => {
  it('steps without resetting while the scenario is still running', () => {
    const { handle, scenario } = makeScenario({ quitSequence: [false] })
    scenario.advance()
    expect(handle.resetCount).toBe(0)
    expect(handle.stepCount).toBe(1)
  })

  it('restarts before stepping once the scenario has ended', () => {
    const { handle, scenario } = makeScenario({ quitSequence: [true] })
    scenario.advance()
    expect(handle.resetCount).toBe(1)
    expect(handle.stepCount).toBe(1)
  })

  it('loops forever: quit -> reset -> keep stepping, never leaking', () => {
    // is_quit: run, run, ended -> that advance resets, then keeps running.
    const { registry, handle, scenario } = makeScenario({
      quitSequence: [false, false, true, false],
    })
    for (let i = 0; i < 4; i += 1) scenario.advance()
    expect(handle.stepCount).toBe(4)
    expect(handle.resetCount).toBe(1)
    expect(registry.liveCount()).toBe(0)
  })
})

describe('EsminiScenario disposal (use-after-free guard)', () => {
  it('frees the native handle exactly once', () => {
    const { handle, scenario } = makeScenario()
    scenario.dispose()
    expect(handle.deleted).toBe(true)
  })

  it('is idempotent', () => {
    const { handle, scenario } = makeScenario()
    scenario.dispose()
    scenario.dispose()
    expect(handle.deleted).toBe(true) // no throw, no double-delete
  })

  it('throws ScenarioDisposedError on every method after disposal', () => {
    const { scenario } = makeScenario()
    scenario.dispose()
    expect(() => scenario.stepFrame()).toThrow(ScenarioDisposedError)
    expect(() => scenario.advance()).toThrow(ScenarioDisposedError)
    expect(() => scenario.reset()).toThrow(ScenarioDisposedError)
    expect(() => scenario.isQuit()).toThrow(ScenarioDisposedError)
    expect(() => scenario.roadGeometry()).toThrow(ScenarioDisposedError)
    expect(() => scenario.objectCount()).toThrow(ScenarioDisposedError)
    expect(() => scenario.simulationTime()).toThrow(ScenarioDisposedError)
  })
})
