import type { ReactNode } from 'react'

/** Visual emphasis for actions. */
export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

/** Size scale shared across primitives. */
export type Size = 'sm' | 'md' | 'lg'

/** Semantic status used by Pill and Alert. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  variant?: Variant
  size?: Size
  disabled?: boolean
  /** Accessible label when the button content is icon-only. */
  ariaLabel?: string
  /** Extra classes appended after the design-system classes. */
  className?: string
}

export interface PillProps {
  children: ReactNode
  tone?: Tone
  /** Native tooltip shown on hover (also helps tests target the pill). */
  title?: string
  className?: string
}

export interface CardProps {
  children: ReactNode
  className?: string
}

export interface AlertProps {
  children: ReactNode
  tone?: Tone
  title?: string
  /** ARIA role, e.g. "alert" for errors or "status" for passive notices. */
  role?: string
  className?: string
}

export interface SpinnerProps {
  size?: Size
  /** Accessible label announced to screen readers. */
  label?: string
  className?: string
}

export type HeadingLevel = 1 | 2 | 3 | 4

export interface HeadingProps {
  children: ReactNode
  level?: HeadingLevel
  className?: string
}
