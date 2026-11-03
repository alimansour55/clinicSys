import { createContext, useContext, useId, useState } from 'react'
import { cx } from './cx'

const TabsContext = createContext(null)

/** Controlled with `value` + `onChange`, or uncontrolled with `defaultValue`. */
export function Tabs({ value, defaultValue, onChange, className, children }) {
  const baseId = useId()
  const [internal, setInternal] = useState(defaultValue)
  const active = value ?? internal
  const select = (next) => {
    if (value === undefined) setInternal(next)
    onChange?.(next)
  }
  return (
    <TabsContext.Provider value={{ active, select, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

/** `label` is required: it names the tab group for screen readers. */
export function TabList({ label, className, children }) {
  const onKeyDown = (event) => {
    const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]:not([disabled])')]
    const index = tabs.indexOf(document.activeElement)
    if (index < 0) return
    const isRtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const forward = isRtl ? 'ArrowLeft' : 'ArrowRight'
    const backward = isRtl ? 'ArrowRight' : 'ArrowLeft'
    let next
    if (event.key === forward) next = tabs[(index + 1) % tabs.length]
    else if (event.key === backward) next = tabs[(index - 1 + tabs.length) % tabs.length]
    else if (event.key === 'Home') next = tabs[0]
    else if (event.key === 'End') next = tabs[tabs.length - 1]
    if (!next) return
    event.preventDefault()
    next.focus()
    next.click()
  }
  return (
    <div
      role='tablist'
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx('inline-flex max-w-full gap-1 overflow-x-auto rounded-control bg-surface-sunken p-1', className)}
    >
      {children}
    </div>
  )
}

export function Tab({ value, disabled = false, className, children }) {
  const { active, select, baseId } = useContext(TabsContext)
  const selected = active === value
  return (
    <button
      type='button'
      role='tab'
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => select(value)}
      className={cx(
        'min-h-9 shrink-0 cursor-pointer rounded-[calc(var(--radius-control)-0.25rem)] px-4 text-body-sm font-semibold whitespace-nowrap',
        'transition duration-(--duration-fast) ease-standard disabled:cursor-not-allowed disabled:opacity-50',
        selected ? 'bg-surface-raised text-brand shadow-e1' : 'text-ink-2 hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Only the active panel is mounted, so its data can load when it opens. */
export function TabPanel({ value, className, children }) {
  const { active, baseId } = useContext(TabsContext)
  if (active !== value) return null
  return (
    <div
      role='tabpanel'
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      className={cx('animate-fade', className)}
    >
      {children}
    </div>
  )
}
