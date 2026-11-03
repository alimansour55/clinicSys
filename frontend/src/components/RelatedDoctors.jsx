import React, { useContext, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import DoctorCard from './discovery/DoctorCard'
import { useDoctorCatalog } from './discovery/useDoctorCatalog'
import { openingsFor } from './discovery/doctorInsights'

/** Other doctors in the same speciality, soonest opening first. Hidden when there are none. */
const RelatedDoctors = ({ speciality, docId }) => {
  const { t } = useContext(AppContext)
  const { rows, now } = useDoctorCatalog()

  const related = useMemo(() => {
    const next = (row) => openingsFor(row, '')?.next?.getTime() ?? Number.POSITIVE_INFINITY
    return rows
      .filter((row) => row.speciality === speciality && row.id !== String(docId) && !row.comingSoon)
      .sort((a, b) => next(a) - next(b))
      .slice(0, 4)
  }, [rows, speciality, docId])

  if (!speciality || related.length === 0) return null

  return (
    <section aria-labelledby='related-title' className='my-16'>
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div>
          <h2 id='related-title' className='font-display text-title-lg text-ink'>{t('Other doctors in this speciality')}</h2>
          <p className='mt-1 text-body-sm text-ink-2'>{t('Ordered by their next real opening.')}</p>
        </div>
        <Link to={`/doctors/${encodeURIComponent(speciality)}`} className='inline-flex items-center gap-1 text-body-sm font-semibold text-brand hover:underline'>
          {t('View More Doctors')}
          <ArrowRight aria-hidden='true' className='size-4 rtl:-scale-x-100' />
        </Link>
      </div>
      <ul className='mt-6 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4'>
        {related.map((row) => (
          <li key={row.id}>
            <DoctorCard row={row} now={now} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export default RelatedDoctors
