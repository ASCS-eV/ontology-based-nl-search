import { describe, expect, it } from 'vitest'

import versionsJson from '../../versions.json' with { type: 'json' }
import { VIEWER_ENGINE_VERSIONS } from '../versions.js'

describe('VIEWER_ENGINE_VERSIONS', () => {
  it('is the single source of truth read straight from versions.json', () => {
    expect(VIEWER_ENGINE_VERSIONS).toEqual(versionsJson)
  })

  it('pins a full 40-char esmini commit SHA', () => {
    expect(VIEWER_ENGINE_VERSIONS.engineCommit).toMatch(/^[0-9a-f]{40}$/)
  })

  it('records the single-file, web-targeted build we ship', () => {
    expect(VIEWER_ENGINE_VERSIONS.engine).toBe('esmini')
    expect(VIEWER_ENGINE_VERSIONS.singleFile).toBe(true)
    expect(VIEWER_ENGINE_VERSIONS.emscripten).toBe('6.0.3')
  })
})
