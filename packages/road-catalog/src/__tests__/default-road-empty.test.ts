import { describe, expect, it, vi } from 'vitest'

// Exercise the empty-catalog guard in defaultRoad() without a real empty build.
vi.mock('../road-data.generated.js', () => ({ ROADS: [] }))

describe('defaultRoad with an empty catalog', () => {
  it('throws a regenerate hint instead of returning undefined', async () => {
    const { defaultRoad } = await import('../index.js')
    expect(() => defaultRoad()).toThrow(/no roads generated/)
  })
})
