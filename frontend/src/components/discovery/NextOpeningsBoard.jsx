import React, { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MapPin } from 'lucide-react'
import { AppContext } from '../../context/AppContext'
import { formatLocationLine } from '../../utils/placeTranslations'
import { upcomingOpenings, VISIT_MODES } from './doctorInsights'
import { doctorHref, MODE_META } from './modes'
import { fill, optimizedImage } from './format'
import { Skeleton, SkeletonGroup } from '../ui'

const dayLabel = (date, now, language, t) => {
  const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((start(date) - start(now)) / 86400000)
  if (days === 0) return t('Today')
  if (days === 1) return t('Tomorrow')
  return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * A live board of the soonest real open times across all doctors, like a departures
 * board at a station. Every row is a slot the doctor's own schedule offers right now.
 */
export default function NextOpeningsBoard({ rows, stats, now, loading }) {
  const { t, language, doctorText, placeTranslationOverrides, localizeDigits } = useContext(AppContext)
  const [mode, setMode] = useState('')
  const modes = VISIT_MODES.filter((m) => stats.modes[m] > 0)
  const items = upcomingOpenings(rows, mode, 5)
  const current = new Date(now)
  const clock = current.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <section
      aria-labelledby='openings-title'
      className='relative overflow-hidden rounded-card rounded-se-signature border border-line bg-surface p-4 shadow-e3 sm:p-6'
    >
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 id='openings-title' className='text-title font-semibold text-ink'>{t('Next open times')}</h2>
          <p className='mt-1 flex items-center gap-2 text-caption text-ink-2'>
            <span className='relative flex size-2' aria-hidden='true'>
              <span className='absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60' />
              <span className='relative inline-flex size-2 rounded-full bg-success' />
            </span>
            {t('Live from the doctors’ own schedules')}
          </p>
        </div>
        <p className='shrink-0 rounded-control bg-surface-sunken px-2.5 py-1 text-caption font-semibold tabular-nums text-ink-2' aria-label={fill(t('Checked at {{time}}'), { time: clock })}>
          {clock}
        </p>
      </div>

      {modes.length > 1 && (
        <div role='group' aria-label={t('Visit type')} className='mt-4 flex gap-1.5 overflow-x-auto [scrollbar-width:none]'>
          {['', ...modes].map((m) => {
            const active = mode === m
            const Icon = m ? MODE_META[m].icon : null
            return (
              <button
                key={m || 'all'}
                type='button'
                aria-pressed={active}
                onClick={() => setMode(m)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-body-sm font-medium transition duration-(--duration-fast) ${
                  active ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-ink-2 hover:text-ink'
                }`}
              >
                {Icon && <Icon aria-hidden='true' className='size-3.5' />}
                {m ? t(MODE_META[m].label) : t('All')}
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <SkeletonGroup className='mt-4 space-y-3'>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className='h-14 w-full' />)}
        </SkeletonGroup>
      ) : items.length === 0 ? (
        <p className='mt-6 rounded-control bg-surface-sunken p-4 text-body-sm text-ink-2'>{t('No open times in the next two weeks. New times appear here as soon as doctors publish them.')}</p>
      ) : (
        <ol key={mode} className='mt-4 divide-y divide-line'>
          {items.map(({ row, openings }, index) => {
            const doctor = row.doctor
            const rowMode = mode || (row.modes.clinic?.next?.getTime() === openings.next.getTime() ? 'clinic' : VISIT_MODES.find((m) => row.modes[m]?.next?.getTime() === openings.next.getTime()))
            const place = row.places.find((p) => p.raw === openings.nextPlace) || row.places[0]
            const time = openings.next.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })
            const ModeIcon = MODE_META[rowMode]?.icon
            return (
              <li key={row.id} className='animate-rise' style={{ animationDelay: `${index * 70}ms` }}>
                <Link to={doctorHref(row, rowMode)} className='group -mx-2 flex items-center gap-3 rounded-control px-2 py-3 transition hover:bg-surface-sunken'>
                  <img src={optimizedImage(doctor.image, 96)} alt='' width={44} height={44} loading='lazy' decoding='async' className='size-11 shrink-0 rounded-full bg-primary-soft object-cover object-top' />
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate text-body-sm font-semibold text-ink'>{doctorText(doctor, 'name')}</span>
                    <span className='flex min-w-0 items-center gap-1 text-caption text-ink-2'>
                      <span className='truncate'>{doctorText(doctor, 'speciality')}</span>
                      {place && rowMode !== 'home' && (
                        <>
                          <MapPin aria-hidden='true' className='ms-1 size-3 shrink-0' />
                          <span className='truncate'>{formatLocationLine(place.main, language, t, placeTranslationOverrides)}</span>
                        </>
                      )}
                    </span>
                  </span>
                  <span className='shrink-0 text-end'>
                    <span className='block text-caption font-medium text-ink-2'>{dayLabel(openings.next, current, language, t)}</span>
                    <span className='mt-0.5 inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-body-sm font-semibold tabular-nums text-brand'>
                      {ModeIcon && <ModeIcon aria-hidden='true' className='size-3.5' />}
                      {time}
                    </span>
                    {ModeIcon && <span className='sr-only'>{t(MODE_META[rowMode].label)}</span>}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}

      <div className='mt-4 flex items-center justify-between gap-3 border-t border-line pt-4'>
        <p className='text-caption text-ink-3'>
          {stats.openThisWeek > 0
            ? fill(t('{{n}} open times in the next 7 days'), { n: localizeDigits(String(stats.openThisWeek)) })
            : t('Times update as doctors publish them')}
        </p>
        <Link to={mode ? `/doctors?consultation=${mode}&sort=soonest` : '/doctors?sort=soonest'} className='inline-flex shrink-0 items-center gap-1 text-body-sm font-semibold text-brand hover:underline'>
          {t('See all')}
          <ArrowRight aria-hidden='true' className='size-4 rtl:-scale-x-100' />
        </Link>
      </div>
    </section>
  )
}
