import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, ExternalLink, Mail, MapPin, Phone, Stethoscope } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { usePageMeta } from '../components/discovery/usePageMeta'

const DEFAULT_CONTACT_PHONE = '+20 101 881 1142'
const DEFAULT_CONTACT_EMAIL = 'contact@clinivo.com'
/* Egypt's national ambulance number */
const EMERGENCY_NUMBER = '123'

const Contact = () => {
  const { siteSettings, token, t, language } = useContext(AppContext)
  const footer = siteSettings?.footer || {}
  const phoneNumber = footer.phoneNumber || DEFAULT_CONTACT_PHONE
  const email = footer.email || DEFAULT_CONTACT_EMAIL
  const address = `${t('Building 18, El Teseen Street')}, ${t('New Cairo, Cairo, Egypt')}`
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Building 18, El Teseen Street, New Cairo, Cairo, Egypt')}`

  usePageMeta({
    title: t('Contact us heading'),
    description: t('Call, email or visit Clinivo. For bookings, use the doctors page or your appointments.'),
    path: '/contact',
    language,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'MedicalOrganization',
      name: 'Clinivo',
      url: window.location.origin,
      telephone: phoneNumber.replace(/\s/g, ''),
      email,
      address: { '@type': 'PostalAddress', streetAddress: 'Building 18, El Teseen Street', addressLocality: 'New Cairo', addressRegion: 'Cairo', addressCountry: 'EG' },
    },
  })

  const cards = [
    { icon: Phone, title: t('Call us'), value: <bdi dir='ltr'>{phoneNumber}</bdi>, href: `tel:${phoneNumber.replace(/[^\d+]/g, '')}` },
    { icon: Mail, title: t('Email us'), value: <bdi dir='ltr'>{email}</bdi>, href: `mailto:${email}` },
    { icon: MapPin, title: t('Our Office'), value: address, href: mapUrl, external: true },
  ]

  return (
    <div className='mx-auto w-full max-w-7xl px-gutter pb-section'>
      <header className='max-w-2xl pt-10 sm:pt-16'>
        <h1 className='font-display text-display-xl text-ink'>{t('Contact us heading')}</h1>
        <p className='mt-4 text-subtitle font-normal text-ink-2'>{t('Questions about a booking, a doctor or your account? Reach us here.')}</p>
      </header>

      <ul className='mt-10 grid gap-4 md:grid-cols-3'>
        {cards.map(({ icon: Icon, title, value, href, external }) => (
          <li key={title}>
            <a
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className='group flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-6 shadow-e1 transition hover:border-primary hover:shadow-e2'
            >
              <span className='flex size-12 items-center justify-center rounded-control bg-primary-soft text-brand'>
                <Icon aria-hidden='true' className='size-6' />
              </span>
              <span className='text-body-sm font-semibold text-ink-2'>{title}</span>
              <span className='break-words text-subtitle font-semibold text-ink group-hover:text-brand'>{value}</span>
              {external && (
                <span className='mt-auto inline-flex items-center gap-1 text-body-sm text-brand'>
                  {t('Open in Maps')}
                  <ExternalLink aria-hidden='true' className='size-3.5' />
                  <span className='sr-only'>{t('(opens in a new tab)')}</span>
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>

      <section aria-labelledby='emergency-title' className='mt-8 flex gap-4 rounded-card border border-danger-soft bg-danger-soft p-6 text-danger-ink'>
        <AlertTriangle aria-hidden='true' className='size-6 shrink-0' />
        <div>
          <h2 id='emergency-title' className='text-subtitle font-semibold'>{t('In a medical emergency')}</h2>
          <p className='mt-1 text-body-sm'>
            {t('Clinivo is a booking service, not an emergency service. Call the ambulance on')}{' '}
            <a href={`tel:${EMERGENCY_NUMBER}`} className='font-bold underline'>{EMERGENCY_NUMBER}</a>{' '}
            {t('or go to the nearest emergency department.')}
          </p>
        </div>
      </section>

      <section aria-labelledby='self-serve-title' className='mt-section'>
        <h2 id='self-serve-title' className='font-display text-title-lg text-ink'>{t('Often faster than writing to us')}</h2>
        <ul className='mt-6 grid gap-4 sm:grid-cols-2'>
          <li>
            <Link to='/doctors' className='flex items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-e1 transition hover:border-primary'>
              <Stethoscope aria-hidden='true' className='size-6 text-brand' />
              <span>
                <span className='block text-subtitle font-semibold text-ink'>{t('Book a doctor')}</span>
                <span className='text-body-sm text-ink-2'>{t('See real open times and book in a few steps.')}</span>
              </span>
            </Link>
          </li>
          <li>
            <Link to={token ? '/my-appointments' : '/login?mode=login'} className='flex items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-e1 transition hover:border-primary'>
              <CalendarDays aria-hidden='true' className='size-6 text-brand' />
              <span>
                <span className='block text-subtitle font-semibold text-ink'>{t('Change or cancel a booking')}</span>
                <span className='text-body-sm text-ink-2'>{token ? t('Open your appointments.') : t('Sign in to see your appointments.')}</span>
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  )
}

export default Contact
