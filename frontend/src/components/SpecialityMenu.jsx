import React, { useContext, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Stethoscope } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { specialityData } from '../assets/assets'
import { resolveClinicSectionLabel } from '../utils/chatbotOpeningSuggestions'
import { formatDoctorCountLabel } from '../utils/arabicMedicalUi'
import { doctorBelongsToClinicSection } from '../utils/doctorClinicPlaces'
import { ClinicChipSkeleton } from './DoctorCatalogSkeleton'
import { openingsFor, VISIT_MODES } from './discovery/doctorInsights'
import { MODE_META } from './discovery/modes'
import { fill, formatOpening, optimizedImage } from './discovery/format'
import { siteField } from './discovery/siteCopy'

const iconFor = (name) => specialityData.find((item) => item.speciality.toLowerCase() === String(name).toLowerCase())?.image

/** Specialities that really have doctors, with their soonest opening, then the ways to be seen. */
const SpecialityMenu = ({ catalog }) => {
  const { t, tc, language, siteSettings, localizeDigits, placeTranslationOverrides } = useContext(AppContext)
  const { rows, stats, loading, now } = catalog

  const specialities = useMemo(() => {
    const names = [...new Set(rows.map((row) => row.speciality).filter(Boolean))]
    return names
      .map((name) => {
        const members = rows.filter((row) => doctorBelongsToClinicSection(row.doctor, name))
        const next = members.map((row) => openingsFor(row, '')?.next).filter(Boolean).sort((a, b) => a - b)[0] || null
        return { name, count: members.length, next }
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [rows])

  const cards = siteSettings?.homeServiceCards || {}
  /* Stored English and Arabic first; cards saved before the bilingual form fall back to t(). */
  const text = (field) => siteField({ t, tc }, cards, field)
  const ways = [
    { key: 'clinic', title: t('Clinic visit'), text: t('See the doctor in person at one of their branches.'), show: true },
    {
      key: 'tele',
      modes: ['tele', 'voice'],
      title: text('teleconsultationTitle') || t('Teleconsultation'),
      text: text('teleconsultationDescription') || t('Schedule a voice or video call with a specialist doctor.'),
      image: cards.teleconsultationImage,
      button: text('teleconsultationButtonText'),
      show: cards.showTeleconsultation !== false,
    },
    {
      key: 'home',
      title: text('homeVisitTitle') || t('Home Visit'),
      text: text('homeVisitDescription') || t('Book a doctor visit at your home in supported Cairo and Giza areas.'),
      image: cards.homeVisitImage,
      button: text('homeVisitButtonText'),
      show: cards.showHomeVisit !== false,
    },
  ].filter((way) => way.show)

  return (
    <section id='speciality' aria-labelledby='speciality-title' className='scroll-mt-28 py-section'>
      <div className='mx-auto w-full max-w-7xl px-gutter'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <h2 id='speciality-title' className='font-display text-display text-ink'>{t('Find by Speciality')}</h2>
            <p className='mt-2 max-w-xl text-body text-ink-2'>{t('Each speciality shows how many doctors you can book and the soonest real opening.')}</p>
          </div>
          <Link to='/doctors' className='inline-flex items-center gap-1 text-body-sm font-semibold text-brand hover:underline'>
            {t('All doctors')}
            <ArrowRight aria-hidden='true' className='size-4 rtl:-scale-x-100' />
          </Link>
        </div>

        <ul className='mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6'>
          {loading ? (
            <ClinicChipSkeleton count={6} />
          ) : (
            specialities.map(({ name, count, next }, index) => {
              const icon = iconFor(name)
              return (
                <li key={name} className='animate-rise' style={{ animationDelay: `${index * 50}ms` }}>
                  <Link
                    to={`/doctors/${encodeURIComponent(name)}`}
                    className='group flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-e1 transition duration-(--duration-base) ease-standard hover:-translate-y-0.5 hover:border-primary hover:shadow-e2'
                  >
                    <span className='flex size-12 items-center justify-center rounded-full bg-primary-soft transition group-hover:scale-105'>
                      {icon ? <img src={icon} alt='' width={32} height={32} className='size-8' /> : <Stethoscope aria-hidden='true' className='size-6 text-brand' />}
                    </span>
                    <span className='text-subtitle font-semibold text-ink'>{resolveClinicSectionLabel(name, language, t, tc, placeTranslationOverrides)}</span>
                    <span className='mt-auto text-caption text-ink-2'>
                      {formatDoctorCountLabel(count, language, localizeDigits)}
                      {next && (
                        <span className='mt-0.5 block font-medium text-success-ink'>{fill(t('Next: {{when}}'), { when: formatOpening(next, language, t, new Date(now)) })}</span>
                      )}
                    </span>
                  </Link>
                </li>
              )
            })
          )}
        </ul>

        {ways.length > 0 && (
          <div className='mt-section'>
            <h2 className='font-display text-title-lg text-ink'>{t('Ways to be seen')}</h2>
            <ul className={`mt-6 grid gap-4 ${ways.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              {ways.map((way) => {
                const modes = way.modes || [way.key]
                const count = Math.max(...modes.map((m) => stats.modes[m] || 0))
                const Icon = MODE_META[way.key].icon
                const body = (
                  <>
                    <span className='flex size-12 items-center justify-center overflow-hidden rounded-control bg-primary-soft text-brand'>
                      {way.image ? <img src={optimizedImage(way.image, 96)} alt='' className='size-full object-cover' loading='lazy' /> : <Icon aria-hidden='true' className='size-6' />}
                    </span>
                    <span className='text-subtitle font-semibold text-ink'>{way.title}</span>
                    <span className='text-body-sm text-ink-2'>{way.text}</span>
                    <span className='mt-auto flex items-center justify-between gap-3 pt-2 text-body-sm'>
                      <span className={count ? 'text-ink-2' : 'text-ink-3'}>
                        {loading ? '' : count ? fill(t('Offered by {{doctors}}'), { doctors: formatDoctorCountLabel(count, language, localizeDigits) }) : t('No doctor offers this yet')}
                      </span>
                      {count > 0 && (
                        <span className='inline-flex items-center gap-1 font-semibold text-brand'>
                          {way.button || t('Choose')}
                          <ArrowRight aria-hidden='true' className='size-4 rtl:-scale-x-100' />
                        </span>
                      )}
                    </span>
                  </>
                )
                const className = 'flex h-full flex-col gap-2 rounded-card border border-line bg-surface p-5 shadow-e1'
                return (
                  <li key={way.key}>
                    {count > 0 ? (
                      <Link to={way.key === 'clinic' ? '/doctors?consultation=clinic' : `/doctors?consultation=${way.key}`} className={`${className} transition hover:border-primary hover:shadow-e2`}>
                        {body}
                      </Link>
                    ) : (
                      <div className={`${className} opacity-80`}>{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
            {stats.modes && VISIT_MODES.every((m) => !stats.modes[m]) && !loading && (
              <p className='mt-4 text-body-sm text-ink-3'>{t('Doctors are setting up their schedules. Check back soon.')}</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default SpecialityMenu
