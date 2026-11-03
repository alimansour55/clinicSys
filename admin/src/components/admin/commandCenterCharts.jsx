import { useId, useState } from 'react'
import { useLanguage } from '../../i18n'

/** Sparkline for a figure's trend. One series in the brand hue, the last point marked. */
export function Sparkline({ values, label }) {
  const width = 120
  const height = 32
  if (!values.length) return null
  const max = Math.max(...values, 1)
  const x = (index) => (values.length === 1 ? width : (index / (values.length - 1)) * width)
  const y = (value) => height - 3 - (value / max) * (height - 6)
  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`-2 0 ${width + 4} ${height}`} role='img' aria-label={label} className='h-8 w-full max-w-32 rtl:-scale-x-100' preserveAspectRatio='none'>
      <polyline points={points} fill='none' stroke='var(--color-primary)' strokeWidth='2' strokeLinejoin='round' strokeLinecap='round' vectorEffect='non-scaling-stroke' />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r='2.5' fill='var(--color-primary)' stroke='var(--color-surface)' strokeWidth='1.5' />
    </svg>
  )
}

const shortDate = (key, language) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })
}

/**
 * Daily bars for one measure. Hover or focus shows the day. Follows reading direction, so
 * the newest day is at the inline end in both languages. A table sits behind it for screen readers.
 */
export function DailyBars({ series, field, formatValue = String, label }) {
  const { language, t } = useLanguage()
  const [active, setActive] = useState(null)
  const max = Math.max(...series.map((day) => day[field]), 1)
  const titleId = useId()
  const shown = active !== null ? series[active] : null
  const total = series.reduce((sum, day) => sum + day[field], 0)

  return (
    <figure>
      <figcaption id={titleId} className='mb-2 flex min-h-5 items-baseline justify-between gap-3 text-caption text-ink-3'>
        <span>{shown ? shortDate(shown.date, language) : t('Last 30 days')}</span>
        <span className='font-semibold tabular-nums text-ink'>{formatValue(shown ? shown[field] : total)}</span>
      </figcaption>
      <div aria-hidden='true' className='flex h-32 items-stretch gap-0.5 border-b border-line-strong' onMouseLeave={() => setActive(null)}>
        {series.map((day, index) => (
          <div
            key={day.date}
            onMouseEnter={() => setActive(index)}
            className={`flex min-w-0 flex-1 items-end rounded-t-[4px] ${active === index ? 'bg-primary-soft' : ''}`}
          >
            <div
              className={`w-full rounded-t-[4px] ${day[field] > 0 ? 'bg-primary' : ''}`}
              style={{ height: day[field] > 0 ? `max(${(day[field] / max) * 100}%, 3px)` : 0 }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden='true' className='mt-1 flex justify-between text-caption text-ink-3'>
        <span>{series[0] && shortDate(series[0].date, language)}</span>
        <span>{series.length > 0 && shortDate(series[series.length - 1].date, language)}</span>
      </div>
      {/* A table ignores the 1px width of sr-only, so the wrapper carries it */}
      <div className='sr-only'>
        <table>
          <caption>{label}</caption>
          <tbody>
            {series.map((day) => (
              <tr key={day.date}>
                <th scope='row'>{day.date}</th>
                <td>{formatValue(day[field])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

const WEEKDAY_ORDER = [6, 0, 1, 2, 3, 4, 5]

/** Sunday-based weekday names in the current language, starting from a known Sunday. */
const weekdayName = (weekday, language) =>
  new Date(2024, 0, 7 + weekday).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short' })

const hourName = (hour, language) =>
  new Date(2024, 0, 1, hour).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-GB', { hour: 'numeric', hour12: true })

/** Visits by weekday and hour. One hue, light to dark, and the count in the cell's title and the table. */
export function BusyHeatmap({ cells, label }) {
  const { language, t, localizeDigits } = useLanguage()
  const [active, setActive] = useState(null)
  const hours = cells.map((cell) => cell.hour)
  const from = Math.min(...hours, 9)
  const to = Math.max(...hours, 20)
  const hourList = Array.from({ length: to - from + 1 }, (_, index) => from + index)
  const max = Math.max(...cells.map((cell) => cell.count), 1)
  const countAt = (weekday, hour) => cells.find((cell) => cell.weekday === weekday && cell.hour === hour)?.count || 0

  return (
    <figure>
      <figcaption className='mb-2 min-h-5 text-caption text-ink-3'>
        {active ? `${weekdayName(active.weekday, language)} ${hourName(active.hour, language)}: ${localizeDigits(active.count)}` : t('Visits by day and hour, last 90 days')}
      </figcaption>
      <div className='overflow-x-auto'>
        <div aria-hidden='true' className='min-w-[30rem]' onMouseLeave={() => setActive(null)}>
          <div className='grid gap-0.5' style={{ gridTemplateColumns: `3rem repeat(${hourList.length}, minmax(0, 1fr))` }}>
            <span />
            {hourList.map((hour) => (
              <span key={hour} className='truncate pb-1 text-center text-[0.625rem] text-ink-3'>
                {hour % 2 === 0 ? hourName(hour, language) : ''}
              </span>
            ))}
            {WEEKDAY_ORDER.map((weekday) => (
              <div key={weekday} className='contents'>
                <span className='flex items-center text-caption text-ink-3'>{weekdayName(weekday, language)}</span>
                {hourList.map((hour) => {
                  const count = countAt(weekday, hour)
                  return (
                    <span
                      key={hour}
                      title={String(count)}
                      onMouseEnter={() => setActive({ weekday, hour, count })}
                      className='h-6 rounded-[4px] bg-surface-sunken'
                      style={count ? { backgroundColor: 'var(--color-primary)', opacity: 0.2 + 0.8 * (count / max) } : undefined}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className='sr-only'>
        <table>
          <caption>{label}</caption>
          <tbody>
            {cells.map((cell) => (
              <tr key={`${cell.weekday}-${cell.hour}`}>
                <th scope='row'>{`${weekdayName(cell.weekday, language)} ${hourName(cell.hour, language)}`}</th>
                <td>{cell.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

/** A part of a whole as a thin bar with its label and number in ink, so nothing depends on colour. */
export function ShareRows({ rows, formatLabel }) {
  const { localizeDigits } = useLanguage()
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1
  return (
    <ul className='space-y-2.5'>
      {rows.map((row) => (
        <li key={row.key}>
          <div className='flex justify-between gap-3 text-body-sm'>
            <span className='truncate text-ink-2'>{formatLabel(row.key)}</span>
            <span className='shrink-0 font-semibold tabular-nums text-ink'>{localizeDigits(row.count)}</span>
          </div>
          <div className='mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken'>
            <div className='h-full rounded-full bg-primary' style={{ width: `${(row.count / total) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
