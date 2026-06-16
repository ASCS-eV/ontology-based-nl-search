import type { ComponentType } from 'react'

import type {
  AlertProps,
  ButtonProps,
  CardProps,
  HeadingProps,
  PillProps,
  SpinnerProps,
} from './types'

/** A footer/nav link. */
export interface BrandLink {
  label: string
  href: string
  /** Opens in a new tab when true. */
  external?: boolean
}

/** A logo image reference. */
export interface BrandLogo {
  /** Path served by the app (e.g. `/logos/foo.png`). */
  src: string
  alt: string
  /** Optional link the logo navigates to (opens in a new tab). */
  href?: string
}

/**
 * Identity/branding a design system supplies — pure data, no component logic.
 * Lets Header/Footer/document title be themed without touching components.
 */
export interface BrandConfig {
  /** Stable id, e.g. `envited-x`. */
  id: string
  /** Human-readable name (shown in a design-system switcher). */
  name: string
  /** Document title and header tagline. */
  appTitle: string
  /** Short tagline beside the header logo. */
  appTagline: string
  /**
   * Value applied to `<html data-theme>`; design systems ship CSS that
   * overrides Tailwind color variables under `[data-theme='<theme>']` to
   * re-skin parts of the UI that aren't built from primitives yet.
   */
  theme: string
  /** Header logo. */
  headerLogo: BrandLogo
  /** Optional supplementary logos rendered in the footer. */
  footerLogos: BrandLogo[]
  /** Footer navigation links. */
  links: BrandLink[]
  /** Footer legal/copyright line. */
  copyright: string
  /** Optional EU/funding disclaimer shown in the footer. */
  disclaimer?: string
}

/** The component contract every design system must implement. */
export interface DesignSystemComponents {
  Button: ComponentType<ButtonProps>
  Pill: ComponentType<PillProps>
  Card: ComponentType<CardProps>
  Alert: ComponentType<AlertProps>
  Spinner: ComponentType<SpinnerProps>
  Heading: ComponentType<HeadingProps>
}

/** A complete, pluggable design system: branding + component implementations. */
export interface DesignSystem {
  brand: BrandConfig
  components: DesignSystemComponents
}
