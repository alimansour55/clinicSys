import { useLanguage } from '../../i18n'
import { cx } from './cx'

const SHIMMER =
  'animate-shimmer bg-[linear-gradient(90deg,var(--color-surface-sunken)_30%,var(--color-line)_50%,var(--color-surface-sunken)_70%)] bg-[length:200%_100%]'

/** One placeholder shape. Size it with classes, for example className='h-4 w-32'. */
export function Skeleton({ circle = false, className }) {
  return (
    <span
      aria-hidden='true'
      className={cx('block', SHIMMER, circle ? 'rounded-full' : 'rounded-control', className)}
    />
  )
}

/** Wrap a group of Skeletons so screen readers hear one "Loading" instead of nothing. */
export function SkeletonGroup({ label, className, children }) {
  const { t } = useLanguage()
  return (
    <div role='status' aria-label={label ?? t('Loading')} aria-busy='true' className={className}>
      {children}
    </div>
  )
}
