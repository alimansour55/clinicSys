import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { Button } from './ui'
import HeroSearch from './discovery/HeroSearch'
import NextOpeningsBoard from './discovery/NextOpeningsBoard'
import { customColor, siteText } from './discovery/siteCopy'
import { fill, optimizedImage } from './discovery/format'
import { formatDoctorCountLabel } from '../utils/arabicMedicalUi'

/* A heartbeat that settles into a flat line of calendar days. Drawn once, purely decorative. */
const PulseLine = () => (
  <svg aria-hidden='true' viewBox='0 0 1200 120' preserveAspectRatio='none' className='pointer-events-none absolute inset-x-0 top-10 h-24 w-full text-brand opacity-[0.14] rtl:-scale-x-100 sm:top-16'>
    <path
      d='M0 70 H360 l18 -30 l16 62 l22 -96 l22 104 l16 -40 H620 h40 m40 0 h40 m40 0 h40 m40 0 h40 m40 0 H1200'
      fill='none'
      stroke='currentColor'
      strokeWidth='3'
      strokeLinecap='round'
      strokeLinejoin='round'
      pathLength='1'
      className='hero-pulse'
    />
    <style>{`.hero-pulse{stroke-dasharray:1;stroke-dashoffset:1;animation:hero-pulse 2.4s var(--ease-enter) .2s forwards}@keyframes hero-pulse{to{stroke-dashoffset:0}}@media (prefers-reduced-motion:reduce){.hero-pulse{stroke-dashoffset:0;animation:none}}`}</style>
  </svg>
)

const Header = ({ catalog }) => {
  const { token, t, siteSettings, language, localizeDigits } = useContext(AppContext)
  const { rows, catalogue, stats, loading, now } = catalog
  const hero = siteSettings?.homeHero || {}
  const customTitle = siteText(hero.title, stats.doctors || Infinity)
  const subtitle = siteText(hero.subtitle, stats.doctors || Infinity)
  const accent = customColor(hero.backgroundColor)
  const showBookButton = hero.showBookButton !== false
  const showAppointmentsButton = hero.showAppointmentsButton !== false
  const faces = rows.filter((row) => row.doctor.image).slice(0, 4)

  return (
    <section id='home-hero' aria-labelledby='hero-title' className='relative isolate scroll-mt-28 overflow-hidden'>
      {/* Mineral wash with a soft brand glow, or the admin's chosen colour */}
      <div
        aria-hidden='true'
        className='absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_85%_10%,var(--color-primary-soft),transparent_70%),radial-gradient(40rem_24rem_at_0%_100%,var(--color-accent-soft),transparent_70%)] rtl:-scale-x-100'
        style={accent ? { backgroundImage: `radial-gradient(60rem 30rem at 85% 10%, ${accent}33, transparent 70%)` } : undefined}
      />
      <PulseLine />

      <div className='mx-auto grid w-full max-w-7xl items-center gap-10 px-gutter pb-14 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-20 lg:pt-20'>
        <div className='animate-rise'>
          <p className='inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-caption font-semibold text-ink-2 shadow-e1 backdrop-blur'>
            <span className='size-1.5 rounded-full bg-accent' aria-hidden='true' />
            {stats.doctors > 0
              ? fill(t('{{doctors}} · {{specialities}} specialities · English and Arabic'), {
                  doctors: formatDoctorCountLabel(stats.doctors, language, localizeDigits),
                  specialities: localizeDigits(String(stats.specialities)),
                })
              : t('Clinic booking in English and Arabic')}
          </p>

          <h1 id='hero-title' className='mt-5 font-display text-display-xl text-ink text-balance'>
            {customTitle ? t(customTitle) : (
              <>
                {t('The right doctor,')}{' '}
                <em className='text-brand rtl:not-italic'>{t('and their next free time.')}</em>
              </>
            )}
          </h1>
          <p className='mt-5 max-w-xl text-subtitle font-normal text-ink-2'>
            {subtitle ? t(subtitle) : t('Tell us what is wrong in your own words, in English or Arabic. We match you with a speciality and show real open times at the clinic, by phone, by video or at home.')}
          </p>

          <div className='mt-8'>
            <HeroSearch rows={rows} catalogue={catalogue} />
          </div>

          <div className='mt-6 flex flex-wrap items-center gap-x-5 gap-y-3'>
            {hero.showGroupImage !== false && (hero.groupImage ? (
              <img src={optimizedImage(hero.groupImage, 240)} alt='' className='h-10 w-auto' loading='lazy' />
            ) : faces.length > 1 && (
              <span className='flex -space-x-2.5 rtl:space-x-reverse' aria-hidden='true'>
                {faces.map((row) => (
                  <img key={row.id} src={optimizedImage(row.doctor.image, 80)} alt='' width={36} height={36} className='size-9 rounded-full border-2 border-surface bg-primary-soft object-cover object-top' />
                ))}
              </span>
            ))}
            {showBookButton && (
              <Link to='/doctors' className='inline-flex items-center gap-1.5 text-body-sm font-semibold text-brand hover:underline'>
                {t(siteText(hero.bookButtonText) || 'Browse all doctors')}
                <ArrowRight aria-hidden='true' className='size-4 rtl:-scale-x-100' />
              </Link>
            )}
            {token && showAppointmentsButton && (
              <Button as={Link} to='/my-appointments' variant='secondary' size='sm' leadingIcon={<CalendarDays aria-hidden='true' className='size-4' />}>
                {t(hero.appointmentsButtonText || 'My appointments')}
              </Button>
            )}
          </div>
        </div>

        <div className='relative animate-rise [animation-delay:120ms]'>
          {hero.heroImage && (
            <img
              src={optimizedImage(hero.heroImage, 900)}
              alt=''
              className='mb-[-3rem] ms-auto w-4/5 rounded-card object-cover shadow-e2 lg:mb-[-4rem]'
              fetchPriority='high'
            />
          )}
          <NextOpeningsBoard rows={rows} stats={stats} now={now} loading={loading} />
        </div>
      </div>
    </section>
  )
}

export default Header
