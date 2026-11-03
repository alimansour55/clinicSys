import React, { useContext, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { DoctorCardSkeleton } from './DoctorCatalogSkeleton'
import DoctorCard from './discovery/DoctorCard'
import { openingsFor } from './discovery/doctorInsights'

const NEVER = Number.POSITIVE_INFINITY

/**
 * Four doctors worth meeting first. When patients have completed visits, the most booked
 * come first; until then the heading says what the order really is: soonest open times.
 */
const TopDoctors = ({ catalog }) => {
  const { t } = useContext(AppContext)
  const { rows, loading, now } = catalog
  const anyCompleted = rows.some((row) => row.completed > 0)

  const top = useMemo(() => {
    const next = (row) => openingsFor(row, '')?.next?.getTime() ?? NEVER
    return rows
      .filter((row) => !row.comingSoon)
      .sort((a, b) =>
        anyCompleted
          ? b.completed - a.completed || b.rating - a.rating || next(a) - next(b)
          : next(a) - next(b) || b.rating - a.rating,
      )
      .slice(0, 4)
  }, [rows, anyCompleted])

  if (!loading && top.length === 0) return null

  return (
    <section id='top-doctors' aria-labelledby='top-doctors-title' className='scroll-mt-28 bg-surface-sunken py-section'>
      <div className='mx-auto w-full max-w-7xl px-gutter'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <h2 id='top-doctors-title' className='font-display text-display text-ink'>
              {anyCompleted ? t('Most booked on Clinivo') : t('Doctors you can see soonest')}
            </h2>
            <p className='mt-2 max-w-xl text-body text-ink-2'>
              {anyCompleted ? t('Ordered by completed visits, then by patient ratings.') : t('Ordered by their next real opening.')}
            </p>
          </div>
          <Link to='/doctors' className='inline-flex items-center gap-1 text-body-sm font-semibold text-brand hover:underline'>
            {t('View More Doctors')}
            <ArrowRight aria-hidden='true' className='size-4 rtl:-scale-x-100' />
          </Link>
        </div>

        <div className='mt-8'>
          {loading ? (
            <DoctorCardSkeleton count={4} />
          ) : (
            <ul className='grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4'>
              {top.map((row) => (
                <li key={row.id}>
                  <DoctorCard row={row} now={now} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

export default TopDoctors
