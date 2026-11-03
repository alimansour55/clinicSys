import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, Languages, MessageSquareText, Star } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { Button } from '../components/ui'
import { useDoctorCatalog } from '../components/discovery/useDoctorCatalog'
import { usePageMeta } from '../components/discovery/usePageMeta'
import { MODE_META } from '../components/discovery/modes'
import { VISIT_MODES } from '../components/discovery/doctorInsights'

const About = () => {
  const { t, language, localizeDigits } = useContext(AppContext)
  const { stats, loading } = useDoctorCatalog()

  usePageMeta({
    title: t('About Clinivo'),
    description: t('Clinivo is a bilingual clinic booking site. Find a doctor, see their real open times and book a clinic visit, call or home visit.'),
    path: '/about',
    language,
  })

  /* Every figure is counted from the live doctor list. */
  const figures = [
    { value: stats.doctors, label: t('Doctors listed') },
    { value: stats.specialities, label: t('Specialities') },
    { value: stats.areas, label: t('Areas with a clinic') },
    { value: VISIT_MODES.filter((m) => stats.modes[m]).length, label: t('Ways to be seen') },
  ]

  const steps = [
    { icon: MessageSquareText, title: t('Say what you need'), text: t('Type a symptom, a speciality, an area or a doctor’s name, in English or Arabic.') },
    { icon: CalendarCheck, title: t('Pick a real time'), text: t('Every time you see comes from the doctor’s published schedule, so it is free when you book it.') },
    { icon: Star, title: t('Visit, then rate'), text: t('After a completed visit you can rate the doctor. Only those ratings are shown.') },
  ]

  return (
    <div className='mx-auto w-full max-w-7xl px-gutter pb-section'>
      <header className='max-w-3xl pt-10 sm:pt-16'>
        <p className='text-caption font-semibold uppercase tracking-wide text-brand'>{t('About Clinivo')}</p>
        <h1 className='mt-3 font-display text-display-xl text-ink text-balance'>{t('Booking a doctor should feel calm.')}</h1>
        <p className='mt-5 text-subtitle font-normal text-ink-2'>
          {t('Clinivo helps patients find the right doctor and book a time that is really open, at the clinic, by phone, by video or at home. Everything works in English and in Arabic, from search to booking.')}
        </p>
      </header>

      <section aria-label={t('Clinivo in numbers')} className='mt-12'>
        <dl className='grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4'>
          {figures.map(({ value, label }) => (
            <div key={label} className='rounded-card border border-line bg-surface p-5 shadow-e1'>
              <dt className='text-body-sm text-ink-2'>{label}</dt>
              <dd className='mt-2 font-display text-display text-ink tabular-nums'>{loading ? '–' : localizeDigits(String(value))}</dd>
            </div>
          ))}
        </dl>
        <p className='mt-3 text-caption text-ink-3'>{t('Counted live from the doctors currently listed.')}</p>
      </section>

      <section aria-labelledby='how-title' className='mt-section'>
        <h2 id='how-title' className='font-display text-display text-ink'>{t('How it works')}</h2>
        <ol className='mt-8 grid gap-4 md:grid-cols-3'>
          {steps.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className='relative rounded-card border border-line bg-surface p-6 shadow-e1'>
              <span className='font-display text-display text-primary-soft' aria-hidden='true'>{localizeDigits(String(index + 1))}</span>
              <Icon aria-hidden='true' className='absolute end-6 top-6 size-6 text-brand' />
              <h3 className='mt-2 text-subtitle font-semibold text-ink'>{title}</h3>
              <p className='mt-2 text-body-sm text-ink-2'>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby='ways-title' className='mt-section grid gap-8 lg:grid-cols-2 lg:items-center'>
        <div>
          <h2 id='ways-title' className='font-display text-display text-ink'>{t('Seen your way')}</h2>
          <p className='mt-4 text-body text-ink-2'>{t('Each doctor chooses which kinds of visit they offer. The doctors page shows only what is really available.')}</p>
          <p className='mt-4 flex items-center gap-2 text-body-sm text-ink-2'>
            <Languages aria-hidden='true' className='size-4 text-brand' />
            {t('Switch between English and Arabic at any time from the top bar.')}
          </p>
        </div>
        <ul className='grid grid-cols-2 gap-3'>
          {VISIT_MODES.map((m) => {
            const { icon: Icon, label } = MODE_META[m]
            const offered = stats.modes[m] > 0
            return (
              <li key={m} className={`flex items-center gap-3 rounded-card border border-line p-4 ${offered ? 'bg-surface shadow-e1' : 'bg-surface-sunken text-ink-3'}`}>
                <Icon aria-hidden='true' className={`size-5 ${offered ? 'text-brand' : ''}`} />
                <span className='text-body-sm font-semibold'>{t(label)}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <div className='mt-section flex flex-wrap items-center gap-4 rounded-sheet rounded-se-signature bg-primary-soft p-8'>
        <p className='flex-1 font-display text-title-lg text-ink'>{t('Ready to find your doctor?')}</p>
        <Button as={Link} to='/doctors' size='lg' trailingIcon={<ArrowRight aria-hidden='true' className='size-5 rtl:-scale-x-100' />}>
          {t('Find a doctor')}
        </Button>
      </div>
    </div>
  )
}

export default About
