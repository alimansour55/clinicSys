import { Moon, Sun } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { useTheme } from '../../utils/theme'
import { cx } from './cx'

export function ThemeToggle({ className }) {
  const { t } = useLanguage()
  const { isDark, toggle } = useTheme()
  const label = t('Dark mode')
  return (
    <button
      type='button'
      role='switch'
      aria-checked={isDark}
      aria-label={label}
      title={label}
      onClick={toggle}
      className={cx(
        'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-e1',
        'transition duration-(--duration-fast) ease-standard hover:border-primary hover:text-brand',
        className,
      )}
    >
      {isDark ? <Sun aria-hidden='true' className='size-4' /> : <Moon aria-hidden='true' className='size-4' />}
    </button>
  )
}
