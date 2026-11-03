import { useState } from 'react'
import { useLanguage } from '../../i18n'
import { formatIsoDate } from './hubLogic'

const WIDTH = 240
const HEIGHT = 56
const PAD = 6

/**
 * A single reading over time: one hue, a 2px line, an end marker, and hover or focus for each value.
 * Time always runs left to right, in Arabic as well, as it does on a medical chart.
 * The screen-reader summary and the dated title on each point mean colour and shape are never the only route in.
 */
export const TrendLine = ({ points, label, unit = '' }) => {
  const { t, language, localizeDigits } = useLanguage()
  const [active, setActive] = useState(null)
  if (points.length < 2) {
    return <p className='mt-2 text-caption text-ink-3'>{t('One more reading will show a trend.')}</p>
  }

  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (index) => PAD + (index / (points.length - 1)) * (WIDTH - PAD * 2)
  const y = (value) => (max === min ? HEIGHT / 2 : HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2))
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ')
  const describe = (point) => `${formatIsoDate(point.date, language)}: ${localizeDigits(String(point.value))} ${unit}`.trim()
  const last = points.length - 1
  const shown = active === null ? null : points[active]

  return (
    <figure className='mt-2'>
      <div dir='ltr' className='relative text-brand'>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className='h-14 w-full' role='img' aria-label={`${label}: ${describe(points[0])} → ${describe(points[last])}`} preserveAspectRatio='none'>
          <path d={line} fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' vectorEffect='non-scaling-stroke' />
          <circle cx={x(active ?? last)} cy={y(points[active ?? last].value)} r='4' fill='currentColor' stroke='var(--color-surface)' strokeWidth='2' />
          {points.map((point, index) => (
            <rect
              key={`${point.date}-${index}`}
              x={x(index) - (WIDTH / points.length) / 2}
              y='0'
              width={WIDTH / points.length}
              height={HEIGHT}
              fill='transparent'
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive(index)}
            >
              <title>{describe(point)}</title>
            </rect>
          ))}
        </svg>
      </div>
      <figcaption className='mt-1 min-h-5 text-caption text-ink-3' aria-live='polite'>
        {shown ? describe(shown) : `${formatIsoDate(points[0].date, language)} – ${formatIsoDate(points[last].date, language)}`}
      </figcaption>
    </figure>
  )
}
