import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cx } from './cx'

const VARIANTS = {
  primary: 'bg-primary text-on-primary shadow-e1 hover:bg-primary-dark hover:shadow-brand',
  accent: 'bg-accent text-on-accent shadow-e1 hover:brightness-95',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-primary hover:bg-primary-soft',
  ghost: 'text-ink-2 hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger text-on-status shadow-e1 hover:brightness-95',
}

const SIZES = {
  sm: 'min-h-9 gap-1.5 px-3 text-body-sm',
  md: 'min-h-11 gap-2 px-5 text-body-sm',
  lg: 'min-h-13 gap-2.5 px-7 text-body',
}

const ICON_SIZES = { sm: 'size-9', md: 'size-11', lg: 'size-13' }

const BASE =
  'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control font-semibold select-none ' +
  'transition duration-(--duration-fast) ease-standard active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50'

/**
 * Pass `as={Link}` (or `as='a'`) to render a link that looks like a button.
 * `loading` keeps the width and label, and blocks repeat presses.
 */
export const Button = forwardRef(function Button(
  {
    as: Component = 'button',
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    leadingIcon,
    trailingIcon,
    fullWidth = false,
    className,
    children,
    ...props
  },
  ref,
) {
  const isButton = Component === 'button'
  return (
    <Component
      ref={ref}
      type={isButton ? (props.type ?? 'button') : props.type}
      disabled={isButton ? disabled || loading : undefined}
      aria-disabled={!isButton && (disabled || loading) ? true : undefined}
      aria-busy={loading || undefined}
      className={cx(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading ? <Loader2 aria-hidden='true' className='size-4 animate-spin' /> : leadingIcon}
      {children}
      {trailingIcon}
    </Component>
  )
})

/** Square button holding only an icon. `label` is required: it is the accessible name. */
export const IconButton = forwardRef(function IconButton(
  { as: Component = 'button', label, variant = 'ghost', size = 'md', className, children, ...props },
  ref,
) {
  return (
    <Component
      ref={ref}
      type={Component === 'button' ? (props.type ?? 'button') : props.type}
      aria-label={label}
      title={label}
      className={cx(BASE, VARIANTS[variant], ICON_SIZES[size], className)}
      {...props}
    >
      {children}
    </Component>
  )
})
