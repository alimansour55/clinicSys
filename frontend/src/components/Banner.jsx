import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, UserRound } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { Button } from './ui'
import { customColor, siteField, siteText, whiteTextReadable } from './discovery/siteCopy'
import { optimizedImage } from './discovery/format'

/** The closing call to action. Guests get a way in; signed-in patients get their shortcuts. */
const Banner = ({ catalog }) => {
  const { token, t, tc, siteSettings } = useContext(AppContext)
  const banner = siteSettings?.homeBanner || {}
  const doctorCount = catalog?.stats?.doctors || Infinity
  /* Stored bilingual text first, then the plain title, then the oldest two-line form. */
  const text = (field) => siteField({ t, tc }, banner, field, doctorCount)
  const title = siteField({ tc }, banner, 'title', doctorCount) ||
    (banner.title ? null : siteText([banner.titleLineOne, banner.titleLineTwo].filter(Boolean).join('\n'), doctorCount))
  const titleLines = title ? title.split('\n').filter(Boolean).map((line) => t(line)) : [t('Ready when you are.'), t('Pick a doctor and a time that suits you.')]
  const color = customColor(banner.backgroundColor)
  const darkText = color && !whiteTextReadable(color)
  const showAppointments = banner.showAppointmentsButton !== false
  const showProfile = banner.showProfileButton !== false

  return (
    <section id='home-banner' aria-labelledby='banner-title' className='scroll-mt-28 py-section'>
      <div className='mx-auto w-full max-w-7xl px-gutter'>
        <div
          className={`relative isolate flex flex-col overflow-hidden rounded-sheet rounded-se-signature px-6 py-10 sm:px-12 sm:py-14 md:flex-row md:items-center md:gap-10 ${
            color ? (darkText ? 'text-ink' : 'text-white') : 'bg-primary text-on-primary'
          }`}
          style={color ? { backgroundColor: color } : undefined}
        >
          <svg aria-hidden='true' viewBox='0 0 200 200' className='absolute -end-16 -top-16 -z-10 size-72 opacity-15'>
            <path d='M100 10 C150 10 190 50 190 100 C190 150 150 190 100 190 C100 120 80 100 10 100 C10 50 50 10 100 10Z' fill='currentColor' />
          </svg>
          <div className='flex-1'>
            <h2 id='banner-title' className='font-display text-display text-balance'>
              {titleLines.map((line, index) => (
                <span key={`${line}-${index}`} className='block'>{line}</span>
              ))}
            </h2>
            <div className='mt-8 flex flex-wrap gap-3'>
              {token ? (
                <>
                  {showAppointments && (
                    <Button as={Link} to='/my-appointments' variant='secondary' size='lg' leadingIcon={<CalendarDays aria-hidden='true' className='size-5' />}>
                      {text('appointmentsButtonText') || t('My appointments')}
                    </Button>
                  )}
                  {showProfile && (
                    <Link to='/my-profile' className='inline-flex min-h-13 items-center gap-2 rounded-control border border-current px-6 font-semibold opacity-90 transition hover:opacity-100'>
                      <UserRound aria-hidden='true' className='size-5' />
                      {text('profileButtonText') || t('My profile')}
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Button as={Link} to='/doctors' variant='secondary' size='lg' trailingIcon={<ArrowRight aria-hidden='true' className='size-5 rtl:-scale-x-100' />}>
                    {t('Find a doctor')}
                  </Button>
                  <Link to='/login?mode=signup' className='inline-flex min-h-13 items-center rounded-control border border-current px-6 font-semibold opacity-90 transition hover:opacity-100'>
                    {t('Create Account')}
                  </Link>
                </>
              )}
            </div>
          </div>
          {banner.showImage !== false && banner.bannerImage && (
            <img src={optimizedImage(banner.bannerImage, 600)} alt='' loading='lazy' decoding='async' className='mt-8 max-h-72 w-auto self-end object-contain md:mt-0' />
          )}
        </div>
      </div>
    </section>
  )
}

export default Banner
