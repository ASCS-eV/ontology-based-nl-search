import { describe, expect, it } from 'vitest'

import type { DesignSystem } from '../registry'
import { resolveDesignSystem } from '../resolve'

function fakeSystem(id: string): DesignSystem {
  return {
    brand: {
      id,
      name: id,
      appTitle: id,
      appTagline: '',
      theme: id,
      headerLogo: { src: '', alt: '' },
      footerLogos: [],
      links: [],
      copyright: '',
    },
    components: {} as DesignSystem['components'],
  }
}

const registry = { envited: fakeSystem('envited'), external: fakeSystem('external') }

describe('resolveDesignSystem', () => {
  it('returns the requested system when registered', () => {
    expect(resolveDesignSystem('external', registry, 'envited').brand.id).toBe('external')
  })

  it('falls back when the requested system is not installed', () => {
    expect(resolveDesignSystem('missing', registry, 'envited').brand.id).toBe('envited')
  })

  it('falls back when no system is requested', () => {
    expect(resolveDesignSystem(undefined, registry, 'envited').brand.id).toBe('envited')
  })

  it('throws when the fallback itself is missing', () => {
    expect(() =>
      resolveDesignSystem('external', { external: fakeSystem('external') }, 'envited')
    ).toThrow(/missing the required fallback 'envited'/)
  })
})
