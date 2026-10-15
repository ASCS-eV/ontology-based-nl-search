import { describe, expect, it } from 'vitest'

import { referencedDomainsOnlyShareConstraints } from '../compiler-helpers-domains.js'

/**
 * Regression: a referencing parent and a referenced child that carry only the
 * SAME constraints (e.g. a shared vocabulary leaf reachable from both) are
 * peers, not a JOIN — the JOIN path emitted only the parent's arm.
 */
describe('referencedDomainsOnlyShareConstraints', () => {
  const refs = new Map([['parent', new Set(['child'])]])

  it('is true when every constrained child key is also on the parent', () => {
    expect(
      referencedDomainsOnlyShareConstraints(
        ['parent', 'child'],
        refs,
        { parent: { A: 'x', B: 'y' }, child: { A: 'x' } },
        { child: {} }
      )
    ).toBe(true)
  })

  it('is false when the child has an exclusive constraint', () => {
    expect(
      referencedDomainsOnlyShareConstraints(
        ['parent', 'child'],
        refs,
        { parent: { A: 'x' }, child: { A: 'x' } },
        { child: { len: { min: 1 } } }
      )
    ).toBe(false)
  })

  it('is false when the child carries no constraints (JOIN path is kept)', () => {
    expect(
      referencedDomainsOnlyShareConstraints(['parent', 'child'], refs, { parent: { A: 'x' } }, {})
    ).toBe(false)
  })

  it('ignores references to domains that are not requested', () => {
    expect(
      referencedDomainsOnlyShareConstraints(['parent'], refs, { parent: { A: 'x' } }, {})
    ).toBe(false)
  })
})
