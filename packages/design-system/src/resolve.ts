import type { DesignSystem } from './registry'

/** Maps a design-system id to its implementation. */
export type DesignSystemRegistry = Record<string, DesignSystem>

/**
 * Resolve the active design system by id.
 *
 * Brand-neutral: it knows nothing about any specific design system. The app
 * passes a registry (built from whichever implementations are installed) plus
 * the requested id (from config) and a guaranteed-present fallback id. When the
 * requested id isn't registered — e.g. an external, optionally-installed system
 * that this environment doesn't have — it falls back instead of crashing.
 */
export function resolveDesignSystem(
  requestedId: string | undefined,
  registry: DesignSystemRegistry,
  fallbackId: string
): DesignSystem {
  const fallback = registry[fallbackId]
  if (!fallback) {
    throw new Error(
      `Design-system registry is missing the required fallback '${fallbackId}' (have: ${
        Object.keys(registry).join(', ') || 'none'
      })`
    )
  }

  if (requestedId) {
    const requested = registry[requestedId]
    if (requested) return requested
  }

  return fallback
}
