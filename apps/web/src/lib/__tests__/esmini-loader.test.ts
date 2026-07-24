import type { EsminiFactory } from '@ontology-search/scenario-viewer-wasm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadEsminiFactory, resetEsminiFactoryForTests } from '../esmini-loader'

/** A stand-in module factory; the loader only forwards it, never calls it. */
function stubFactory(): EsminiFactory {
  return vi.fn() as unknown as EsminiFactory
}

/** The most recently appended <script>, so the test can drive its load/error. */
function lastScript(spy: { mock: { calls: unknown[][] } }): HTMLScriptElement {
  const node = spy.mock.calls.at(-1)?.[0]
  return node as unknown as HTMLScriptElement
}

describe('esmini-loader', () => {
  afterEach(() => {
    resetEsminiFactoryForTests()
    delete window.esmini
    document.head.querySelectorAll('script').forEach((s) => s.remove())
    vi.restoreAllMocks()
  })

  it('injects a script and resolves window.esmini on load', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild')
    const promise = loadEsminiFactory('/stub-esmini.js')

    const script = lastScript(appendSpy)
    expect(script.src).toContain('/stub-esmini.js')

    const factory = stubFactory()
    window.esmini = factory
    script.dispatchEvent(new Event('load'))

    await expect(promise).resolves.toBe(factory)
  })

  it('resolves immediately if window.esmini is already present', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild')
    const factory = stubFactory()
    window.esmini = factory

    await expect(loadEsminiFactory('/stub-esmini.js')).resolves.toBe(factory)
    expect(appendSpy).not.toHaveBeenCalled()
  })

  it('memoises the factory across calls (loads the script once)', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild')
    const p1 = loadEsminiFactory('/stub-esmini.js')
    const p2 = loadEsminiFactory('/stub-esmini.js')
    expect(p1).toBe(p2)
    expect(appendSpy).toHaveBeenCalledOnce()

    const factory = stubFactory()
    window.esmini = factory
    lastScript(appendSpy).dispatchEvent(new Event('load'))
    await expect(p1).resolves.toBe(factory)
  })

  it('rejects and clears the memo when the script fails to load', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild')
    const failing = loadEsminiFactory('/missing.js')
    lastScript(appendSpy).dispatchEvent(new Event('error'))
    await expect(failing).rejects.toThrow(/failed to load esmini\.js/i)

    // memo cleared → a retry starts a fresh load that can succeed
    const retry = loadEsminiFactory('/stub-esmini.js')
    const factory = stubFactory()
    window.esmini = factory
    lastScript(appendSpy).dispatchEvent(new Event('load'))
    await expect(retry).resolves.toBe(factory)
  })

  it('rejects if the script loads but never defines window.esmini', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild')
    const promise = loadEsminiFactory('/stub-esmini.js')
    lastScript(appendSpy).dispatchEvent(new Event('load'))
    await expect(promise).rejects.toThrow(/window\.esmini is undefined/i)
  })
})
