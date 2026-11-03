import React, { useContext, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { patientFooterLogoClassName } from '../utils/brandingLogo'
import { resolveClinicSectionLabel } from '../utils/chatbotOpeningSuggestions'
import BrandLogo from './BrandLogo'
import { DEFAULT_FOOTER_COPYRIGHT, footerContactEmail } from '../utils/publicSiteDefaults'
import { siteField } from './discovery/siteCopy'
import { fill } from './discovery/format'

/** Calm ALL-CAPS Latin CMS labels (e.g. "ALL DOCTORS" → "All doctors") without touching other scripts. */
const humanizeNavLabel = (label) => {
  const s = String(label || '').trim()
  if (!s || /[a-z]/.test(s) || !/[A-Z]/.test(s) || s !== s.toUpperCase()) return s
  return s.charAt(0) + s.slice(1).toLowerCase()
}

const Footer = () => {
  const { token, t, tc, language, siteSettings, doctors, placeTranslationOverrides, localizeDigits } = useContext(AppContext)
  const footer = siteSettings?.footer || {}
  /* Stored English and Arabic first; footers saved before the bilingual form fall back to t(). */
  const text = (field) => siteField({ t, tc }, footer, field)
  const description = text('description')
  const phoneNumber = footer.phoneNumber || '+20 101 881 1142'
  const email = footerContactEmail(footer)
  // Stored defaults (any year) get a translated line; text an admin wrote is kept as is
  const copyrightSource = String(footer.i18n?.copyrightText?.en || footer.copyrightText || '').trim()
  const isDefaultCopyright = !copyrightSource || copyrightSource === DEFAULT_FOOTER_COPYRIGHT || /^copyright\s*(\d{4})?\s*©\s*clinivo\s*-\s*all rights reserved\.?$/i.test(copyrightSource)
  const customCopyright = isDefaultCopyright ? '' : text('copyrightText')

  const siteLinks = [
    { label: text('homeLabel') || t('Home'), path: '/', show: footer.showHomeLink !== false },
    { label: text('doctorsLabel') || t('All doctors'), path: '/doctors', show: footer.showDoctorsLink !== false },
    { label: text('aboutLabel') || t('About'), path: '/about', show: footer.showAboutLink !== false },
    { label: text('contactLabel') || t('Contact us'), path: '/contact', show: footer.showContactLink !== false },
    ...(token && footer.showPatientLinks !== false
      ? [
          { label: text('appointmentsLabel') || t('My appointments'), path: '/my-appointments', show: true },
          { label: text('profileLabel') || t('My profile'), path: '/my-profile', show: true },
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
              {description || t('Book real open times with doctors at the clinic, by phone, by video or at home, in English or Arabic.')}
            </p>
          </div>

          <nav aria-labelledby='footer-site' className='lg:col-span-2'>
            <h2 id='footer-site' className={heading}>{humanizeNavLabel(text('companyTitle') || t('Company'))}</h2>
            <ul>
              {siteLinks.map((item) => (
                <li key={item.path}><Link to={item.path} className={link}>{humanizeNavLabel(item.label)}</Link></li>
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
            <h2 className={heading}>{humanizeNavLabel(text('contactTitle') || t('Get in touch'))}</h2>
            <ul className='space-y-2'>
              <li>
                <a href={`tel:${phoneNumber.replace(/[^\d+]/g, '')}`} className='flex items-center gap-3 text-body-sm text-ink transition hover:text-brand'>
                  <span className='flex size-9 items-center justify-center rounded-control bg-primary-soft text-brand'><Phone aria-hidden='true' className='size-4' /></span>
                  <span>
                    <span className='sr-only'>{humanizeNavLabel(text('phoneLabel') || t('Phone'))}: </span>
                    <bdi dir='ltr'>{phoneNumber}</bdi>
                  </span>
                </a>
              </li>
              {email && (
                <li>
                  <a href={`mailto:${email}`} className='flex items-center gap-3 text-body-sm text-ink transition hover:text-brand'>
                    <span className='flex size-9 items-center justify-center rounded-control bg-primary-soft text-brand'><Mail aria-hidden='true' className='size-4' /></span>
                    <span className='break-all'>
                      <span className='sr-only'>{humanizeNavLabel(text('emailLabel') || t('Email'))}: </span>
                      <bdi dir='ltr'>{email}</bdi>
                    </span>
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <p className='mt-12 border-t border-line pt-6 text-center text-caption text-ink-3'>{customCopyright || fill(t('© {{year}} Clinivo. All rights reserved.'), { year: localizeDigits(String(new Date().getFullYear())) })}</p>
      </div>
    </footer>
  )
}

export default Footer
