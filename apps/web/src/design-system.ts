import {
  type DesignSystem,
  type DesignSystemRegistry,
  envitedDesignSystem,
  resolveDesignSystem,
} from '@ontology-search/design-system'
import externalDesignSystem from 'virtual:active-design-system'

/** The default, always-bundled design system. */
const DEFAULT_ID = 'envited-x'

function buildRegistry(): DesignSystemRegistry {
  const registry: DesignSystemRegistry = { [DEFAULT_ID]: envitedDesignSystem }
  // An optional external system (configured via DESIGN_SYSTEM_MODULE) registers
  // itself under its own brand id when present in this environment.
  if (externalDesignSystem) {
    registry[externalDesignSystem.brand.id] = externalDesignSystem
  }
  return registry
}

/**
 * The active design system, selected by `VITE_DESIGN_SYSTEM` and falling back
 * to ENVITED-X when the requested system isn't installed.
 */
export const activeDesignSystem: DesignSystem = resolveDesignSystem(
  import.meta.env.VITE_DESIGN_SYSTEM,
  buildRegistry(),
  DEFAULT_ID
)
