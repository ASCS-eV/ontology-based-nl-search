/// <reference types="vite/client" />

declare module 'virtual:active-design-system' {
  /**
   * An OPTIONAL external design system, injected at build time by the
   * `active-design-system` Vite plugin from the `DESIGN_SYSTEM_MODULE` env var.
   * `null` when none is configured (the app then uses its bundled default).
   */
  const designSystem: import('@ontology-search/design-system').DesignSystem | null
  export default designSystem
}

interface ImportMetaEnv {
  /** Active design-system id; selects which registered system to use. */
  readonly VITE_DESIGN_SYSTEM?: string
}
