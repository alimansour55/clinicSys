import React, { useContext, useId, useMemo } from 'react'
import { AppContext } from '../../context/AppContext'
import { fill } from './format'

const STEP = 50
const BINS = 12

/** A budget slider over a histogram of real visit fees, so the patient sees where prices sit. */
export default function PriceFilter({ prices, value, onChange }) {
  const { t, formatMoney } = useContext(AppContext)
  const id = useId()
  const { min, max, bins } = useMemo(() => {
    const known = prices.filter((p) => p > 0)
    if (!known.length) return { min: 0, max: 0, bins: [] }
    const lo = Math.floor(Math.min(...known) / STEP) * STEP
    const hi = Math.max(lo + STEP, Math.ceil(Math.max(...known) / STEP) * STEP)
    const width = (hi - lo) / BINS
    const counts = Array.from({ length: BINS }, (_, i) => ({ from: lo + i * width, count: 0 }))
    known.forEach((p) => {
      counts[Math.min(BINS - 1, Math.floor((p - lo) / width))].count += 1
    })
    return { min: lo, max: hi, bins: counts }
  }, [prices])

  if (!bins.length) return <p className='text-body-sm text-ink-3'>{t('No fees listed yet')}</p>

  const current = value == null ? max : Math.min(max, Math.max(min, value))
  const peak = Math.max(...bins.map((b) => b.count), 1)

  return (
    <div>
      <div className='flex items-baseline justify-between gap-2'>
        <label htmlFor={id} className='text-body-sm font-semibold text-ink'>
          {value == null ? t('Any price') : fill(t('Up to {{amount}}'), { amount: formatMoney(current) })}
        </label>
        {value != null && (
          <button type='button' onClick={() => onChange(null)} className='text-caption font-semibold text-brand hover:underline'>
            {t('Any price')}
          </button>
        )}
      </div>
      <div className='mt-3 flex h-12 items-end gap-0.5' aria-hidden='true'>
        {bins.map((bin) => (
          <span
            key={bin.from}
            className={`flex-1 rounded-t-sm transition-colors duration-(--duration-fast) ${bin.from < current ? 'bg-primary' : 'bg-line'}`}
            style={{ height: `${bin.count ? Math.max(12, (bin.count / peak) * 100) : 4}%` }}
          />
        ))}
      </div>
      <input
        id={id}
        type='range'
        min={min}
        max={max}
        step={STEP}
        value={current}
        onChange={(event) => {
          const next = Number(event.target.value)
          onChange(next >= max ? null : next)
        }}
        aria-valuetext={value == null ? t('Any price') : formatMoney(current)}
        className='mt-1 w-full accent-(--color-primary)'
      />
      <div className='flex justify-between text-caption text-ink-3'>
        <span>{formatMoney(min)}</span>
        <span>{formatMoney(max)}</span>
      </div>
    </div>
  )
}
