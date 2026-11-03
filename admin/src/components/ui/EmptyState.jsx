import { cx } from './cx'

/** `icon` is an element, for example icon={<CalendarDays />}. `action` is usually a Button. */
export function EmptyState({ icon, title, description, action, headingLevel = 3, className }) {
  const Heading = `h${headingLevel}`
  return (
    <div className={cx('flex flex-col items-center px-6 py-12 text-center', className)}>
      {icon && (
        <span
          aria-hidden='true'
          className='mb-5 flex size-16 items-center justify-center rounded-card rounded-se-signature bg-primary-soft text-brand ring-8 ring-primary-soft/40 [&>svg]:size-7'
        >
          {icon}
        </span>
      )}
      <Heading className='text-title font-semibold text-ink'>{title}</Heading>
      {description && <p className='mt-2 max-w-md text-body-sm text-ink-3'>{description}</p>}
      {action && <div className='mt-6'>{action}</div>}
    </div>
  )
}
