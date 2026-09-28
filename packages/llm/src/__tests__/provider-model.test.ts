/**
 * `getModel` builds a model of the configured provider for the requested id,
 * so the authoring agent can run `AUTHORING_AI_MODEL` on the Vercel-SDK
 * providers. Before, it always built `AI_MODEL`.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@ontology-search/core/config', () => ({
  getConfig: () => ({
    AI_PROVIDER: 'ollama',
    AI_MODEL: 'search-model',
    OLLAMA_BASE_URL: 'http://127.0.0.1:11434/v1',
  }),
}))

import { getModel } from '../provider.js'

describe('getModel', () => {
  it('builds AI_MODEL by default', () => {
    expect(getModel()).toMatchObject({ modelId: 'search-model' })
  })

  it('builds the requested model on the configured provider', () => {
    expect(getModel('authoring-model')).toMatchObject({ modelId: 'authoring-model' })
  })
})
