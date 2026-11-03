import React, { useContext, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { patientFooterLogoClassName } from '../utils/brandingLogo'
import { resolveClinicSectionLabel } from '../utils/chatbotOpeningSuggestions'
import BrandLogo from './BrandLogo'
import { DEFAULT_FOOTER_COPYRIGHT } from '../utils/publicSiteDefaults'
import { siteText } from './discovery/siteCopy'

/** Calm ALL-CAPS Latin CMS labels (e.g. "ALL DOCTORS" → "All doctors") without touching other scripts. */
const humanizeNavLabel = (label) => {
  const s = String(label || '').trim()
  if (!s || /[a-z]/.test(s) || !/[A-Z]/.test(s) || s !== s.toUpperCase()) return s
  return s.charAt(0) + s.slice(1).toLowerCase()
}

const Footer = () => {
  const { token, t, tc, language, siteSettings, doctors, placeTranslationOverrides } = useContext(AppContext)
  const footer = siteSettings?.footer || {}
  const description = siteText(footer.description)
  const phoneNumber = footer.phoneNumber || '+20 101 881 1142'
  const email = footer.email || 'contact@clinivo.com'
  const copyrightText = footer.copyrightText || DEFAULT_FOOTER_COPYRIGHT

  const siteLinks = [
    { label: footer.homeLabel || 'Home', path: '/', show: footer.showHomeLink !== false },
    { label: footer.doctorsLabel || 'All doctors', path: '/doctors', show: footer.showDoctorsLink !== false },
    { label: footer.aboutLabel || 'About', path: '/about', show: footer.showAboutLink !== false },
    { label: footer.contactLabel || 'Contact us', path: '/contact', show: footer.showContactLink !== false },
    ...(token && footer.showPatientLinks !== false
      ? [
          { label: footer.appointmentsLabel || 'My appointments', path: '/my-appointments', show: true },
          { label: footer.profileLabel || 'My profile', path: '/my-profile', show: true },
        ]
      : []),
  ].filter((link) => link.show)

  // Specialities that really have doctors, so every link leads somewhere useful
  const specialities = useMemo(
    () => [...new Set((doctors || []).map((doctor) => doctor.speciality).filter(Boolean))].sort().slice(0, 8),
    [doctors],
  )

  const heading = 'mb-4 text-caption font-semibold uppercase tracking-wide text-ink-3'
  const link = 'inline-flex min-h-9 items-center text-body-sm text-ink-2 transition hover:text-brand'

  return (
    <footer className='border-t border-line bg-surface-sunken'>
      <div className='mx-auto w-full max-w-7xl px-gutter pb-28 pt-14 md:pb-12'>
        <div className='grid gap-10 sm:grid-cols-2 lg:grid-cols-12'>
          <div className='sm:col-span-2 lg:col-span-4'>
            <Link to='/' className='inline-block rounded-control'>
              <BrandLogo siteSettings={siteSettings} imgClassName={patientFooterLogoClassName} />
            </Link>
            <p className='mt-4 max-w-sm text-body-sm text-ink-2'>
              {description ? t(description) : t('Book real open times with doctors at the clinic, by phone, by video or at home, in English or Arabic.')}
            </p>
          </div>

          <nav aria-labelledby='footer-site' className='lg:col-span-2'>
            <h2 id='footer-site' className={heading}>{humanizeNavLabel(t(footer.companyTitle || 'Company'))}</h2>
            <ul>
              {siteLinks.map((item) => (
                <li key={item.path}><Link to={item.path} className={link}>{humanizeNavLabel(t(item.label))}</Link></li>
              ))}
            </ul>
          </nav>

          {specialities.length > 0 && (
            <nav aria-labelledby='footer-specialities' className='lg:col-span-3'>
              <h2 id='footer-specialities' className={heading}>{t('Specialities')}</h2>
              <ul>
                {specialities.map((name) => (
                  <li key={name}>
                    <Link to={`/doctors/${encodeURIComponent(name)}`} className={link}>
                      {resolveClinicSectionLabel(name, language, t, tc, placeTranslationOverrides)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div className='lg:col-span-3'>
            <h2 className={heading}>{humanizeNavLabel(t(footer.contactTitle || 'Get in touch'))}</h2>
            <ul className='space-y-2'>
              <li>
                <a href={`tel:${phoneNumber.replace(/[^\d+]/g, '')}`} className='flex items-center gap-3 text-body-sm text-ink transition hover:text-brand'>
                  <span className='flex size-9 items-center justify-center rounded-control bg-primary-soft text-brand'><Phone aria-hidden='true' className='size-4' /></span>
                  <span>
                    <span className='sr-only'>{humanizeNavLabel(t(footer.phoneLabel || 'Phone'))}: </span>
                    <bdi dir='ltr'>{phoneNumber}</bdi>
                  </span>
                </a>
              </li>
              <li>
                <a href={`mailto:${email}`} className='flex items-center gap-3 text-body-sm text-ink transition hover:text-brand'>
                  <span className='flex size-9 items-center justify-center rounded-control bg-primary-soft text-brand'><Mail aria-hidden='true' className='size-4' /></span>
                  <span className='break-all'>
                    <span className='sr-only'>{humanizeNavLabel(t(footer.emailLabel || 'Email'))}: </span>
                    <bdi dir='ltr'>{email}</bdi>
                  </span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className='mt-12 border-t border-line pt-6 text-center text-caption text-ink-3'>{t(copyrightText)}</p>
      </div>
    </footer>
  )
}

export default Footer
