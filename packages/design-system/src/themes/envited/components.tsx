import type {
  AlertProps,
  ButtonProps,
  CardProps,
  HeadingProps,
  PillProps,
  Size,
  SpinnerProps,
  Variant,
} from '../../types'

/** Join truthy class fragments. */
function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded font-medium transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 ' +
  'disabled:cursor-not-allowed'

const BUTTON_VARIANT: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
  secondary:
    'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 focus-visible:ring-gray-400',
  ghost: 'bg-transparent text-gray-600 hover:text-blue-600 hover:bg-gray-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
}

const BUTTON_SIZE: Record<Size, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  ariaLabel,
  className,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}
    >
      {children}
    </button>
  )
}

const PILL_CLASS = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'

export function Pill({ children, tone = 'neutral', title, className }: PillProps) {
  return (
    <span
      title={title}
      style={{ backgroundColor: `var(--ds-tone-${tone}-bg)`, color: `var(--ds-tone-${tone}-fg)` }}
      className={cx(PILL_CLASS, className)}
    >
      {children}
    </span>
  )
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cx('rounded-lg border border-gray-200 bg-white p-4', className)}>
      {children}
    </div>
  )
}

export function Alert({ children, tone = 'info', title, role, className }: AlertProps) {
  return (
    <div
      role={role}
      style={{
        backgroundColor: `var(--ds-tone-${tone}-bg-subtle)`,
        borderColor: `var(--ds-tone-${tone}-border)`,
        color: `var(--ds-tone-${tone}-fg)`,
      }}
      className={cx('rounded-lg border px-4 py-3 text-sm', className)}
    >
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  )
}

const SPINNER_SIZE: Record<Size, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
}

export function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cx(
        'inline-block animate-spin rounded-full border-gray-300 border-t-blue-600',
        SPINNER_SIZE[size],
        className
      )}
    />
  )
}

const HEADING_LEVEL: Record<number, string> = {
  1: 'text-2xl font-bold text-gray-900',
  2: 'text-xl font-semibold text-gray-900',
  3: 'text-lg font-semibold text-gray-800',
  4: 'text-sm font-semibold uppercase tracking-wide text-gray-500',
}

export function Heading({ children, level = 2, className }: HeadingProps) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4'
  return <Tag className={cx(HEADING_LEVEL[level], className)}>{children}</Tag>
}
