import { cx } from './cx'

const TONES = {
  neutral: 'bg-surface-sunken text-ink-2',
  brand: 'bg-primary-soft text-brand',
  accent: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
}

/** Status text, never colour alone. `dot` adds a marker that takes the tone's colour. */
export function Badge({ tone = 'neutral', dot = false, className, children, ...props }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden='true' className='size-1.5 rounded-full bg-current' />}
      {children}
    </span>
  )
}
