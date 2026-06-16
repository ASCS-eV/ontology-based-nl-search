import { useDesignSystem } from '../provider'
import type {
  AlertProps,
  ButtonProps,
  CardProps,
  HeadingProps,
  PillProps,
  SpinnerProps,
} from '../types'

/**
 * Stable primitive components the app imports. Each renders the active design
 * system's implementation from context, so swapping the provider's `system`
 * swaps every primitive's look-and-feel without touching call sites.
 */

export function Button(props: ButtonProps) {
  const Impl = useDesignSystem().components.Button
  return <Impl {...props} />
}

export function Pill(props: PillProps) {
  const Impl = useDesignSystem().components.Pill
  return <Impl {...props} />
}

export function Card(props: CardProps) {
  const Impl = useDesignSystem().components.Card
  return <Impl {...props} />
}

export function Alert(props: AlertProps) {
  const Impl = useDesignSystem().components.Alert
  return <Impl {...props} />
}

export function Spinner(props: SpinnerProps) {
  const Impl = useDesignSystem().components.Spinner
  return <Impl {...props} />
}

export function Heading(props: HeadingProps) {
  const Impl = useDesignSystem().components.Heading
  return <Impl {...props} />
}
