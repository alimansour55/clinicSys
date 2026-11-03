import { cx } from './cx'

const VARIANTS = {
  raised: 'rounded-card border border-line bg-surface shadow-e1',
  flat: 'rounded-card border border-line bg-surface',
  sunken: 'rounded-card bg-surface-sunken',
  /* The Clinivo leaf: one large corner on the inline-end, so it mirrors in RTL */
  signature: 'rounded-card rounded-se-signature border border-line bg-surface shadow-e2',
}

/**
 * `interactive` only adds the hover lift. Make it a real control with `as={Link}` or `as='button'`.
 */
export function Card({ as: Component = 'div', variant = 'raised', interactive = false, className, children, ...props }) {
  return (
    <Component
      className={cx(
        VARIANTS[variant],
        interactive &&
          'cursor-pointer text-start transition duration-(--duration-base) ease-standard hover:-translate-y-0.5 hover:border-primary hover:shadow-e2',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

export function CardHeader({ title, description, action, className, children, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`
  return (
    <div className={cx('flex items-start justify-between gap-4 p-5 pb-0', className)}>
      <div className='min-w-0'>
        {title && <Heading className='text-title font-semibold text-ink'>{title}</Heading>}
        {description && <p className='mt-1 text-body-sm text-ink-3'>{description}</p>}
        {children}
      </div>
      {action && <div className='shrink-0'>{action}</div>}
    </div>
  )
}

export function CardBody({ className, children }) {
  return <div className={cx('p-5', className)}>{children}</div>
}

export function CardFooter({ className, children }) {
  return <div className={cx('flex items-center justify-end gap-3 border-t border-line p-5', className)}>{children}</div>
}
