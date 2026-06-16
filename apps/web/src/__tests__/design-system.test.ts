/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'

import { activeDesignSystem } from '../design-system'

// With no DESIGN_SYSTEM_MODULE configured, the shared `active-design-system`
// plugin resolves the virtual module to `null`, so the app uses its default.
describe('activeDesignSystem', () => {
  it('defaults to ENVITED-X when no external design system is configured', () => {
    expect(activeDesignSystem.brand.id).toBe('envited-x')
    expect(activeDesignSystem.components.Button).toBeTypeOf('function')
  })
})
