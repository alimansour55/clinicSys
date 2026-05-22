import React, { useContext } from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Mail, Phone } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { patientFooterLogoClassName } from '../utils/brandingLogo'
import { DEFAULT_APP_DISPLAY_NAME } from '../utils/appDisplayName'
import { DEFAULT_FOOTER_COPYRIGHT, DEFAULT_FOOTER_DESCRIPTION } from '../utils/publicSiteDefaults'

/** Calm ALL-CAPS Latin CMS labels (e.g. "ALL DOCTORS" → "All doctors") without touching other scripts. */
const humanizeNavLabel = (label) => {
  const s = String(label || '').trim()
  if (!s) return s
  if (/[a-z]/.test(s)) return s
  if (!/[A-Z]/.test(s)) return s
  if (s !== s.toUpperCase()) return s
  return s
    .toLowerCase()
    .split(/(\s+)/)
    .map((part) => (/\s+/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('')
}

const Footer = () => {
  const navigate = useNavigate()
  const { token, t, siteSettings } = useContext(AppContext)
  const footer = siteSettings?.footer || {}
  const headerLogoSrc = siteSettings?.branding?.headerLogoUrl || assets.logo
  const logoAltText = siteSettings?.branding?.altText || `${DEFAULT_APP_DISPLAY_NAME} logo`
  const logoImgClassName = patientFooterLogoClassName
  const description = footer.description || DEFAULT_FOOTER_DESCRIPTION
  const companyTitle = footer.companyTitle || 'Company'
  const contactTitle = footer.contactTitle || 'Get in touch'
  const phoneLabel = footer.phoneLabel || 'Phone'
  const phoneNumber = footer.phoneNumber || '+92 343 2705821'
  const emailLabel = footer.emailLabel || 'Email'
  const email = footer.email || 'marqum987@gmail.com'
  const copyrightText = footer.copyrightText || DEFAULT_FOOTER_COPYRIGHT
  const footerLinks = [
    { label: footer.homeLabel || 'Home', path: '/', show: footer.showHomeLink !== false },
    { label: footer.aboutLabel || 'About', path: '/about', show: footer.showAboutLink !== false },
    { label: footer.doctorsLabel || 'All doctors', path: '/doctors', show: footer.showDoctorsLink !== false },
    { label: footer.contactLabel || 'Contact us', path: '/contact', show: footer.showContactLink !== false }
  ]
  const patientLinks = [
    { label: footer.appointmentsLabel || 'My appointments', path: '/my-appointments' },
    { label: footer.profileLabel || 'My profile', path: '/my-profile' }
  ]
  const showPatientLinks = token && footer.showPatientLinks !== false
  const showPrivacyLink = footer.showPrivacyLink !== false

  const goTo = (path) => {
    navigate(path)
    scrollTo(0, 0)
  }

  const sectionHeadingClass =
    'text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500'

  const NavButton = ({ children, onClick }) => (
    <button
      type='button'
      onClick={onClick}
      className='group flex w-full items-center justify-between gap-2 rounded-lg py-2.5 pl-3 pr-2 text-left text-[15px] text-slate-700 transition-colors hover:bg-white/80 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40'
    >
      <span>{children}</span>
      <ArrowUpRight className='h-3.5 w-3.5 shrink-0 text-slate-300 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary/70 group-hover:opacity-100' aria-hidden />
    </button>
  )

  return (
    <footer
      className='relative mt-12 border-t border-teal-100/70 bg-gradient-to-b from-slate-50 via-white to-slate-50/80 md:mt-20'
      role='contentinfo'
    >
      <div
        className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-200/50 to-transparent'
        aria-hidden
      />
      <div className='mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pb-12 sm:pt-14 lg:px-8 lg:pb-14 lg:pt-16'>
        <div className='grid gap-12 lg:grid-cols-12 lg:gap-10 xl:gap-14'>
          {/* Brand */}
          <div className='lg:col-span-5'>
            <div className='mb-6 inline-block rounded-2xl bg-white/60 p-3 shadow-sm ring-1 ring-slate-200/60 backdrop-blur-sm'>
              <img
                className={`${logoImgClassName} cursor-pointer transition-opacity hover:opacity-90`}
                src={headerLogoSrc}
                alt={logoAltText}
                onClick={() => goTo('/')}
              />
            </div>
            <p className='max-w-md text-[15px] leading-[1.65] text-slate-600'>
              {t(description)}
            </p>
          </div>

          {/* Navigation */}
          <nav className='lg:col-span-3' aria-label={humanizeNavLabel(t(companyTitle))}>
            <h2 className={`${sectionHeadingClass} mb-4`}>{humanizeNavLabel(t(companyTitle))}</h2>
            <ul className='space-y-0.5 rounded-2xl border border-slate-200/70 bg-white/40 p-2 shadow-sm ring-1 ring-slate-100/80 backdrop-blur-sm'>
              {footerLinks
                .filter((link) => link.show)
                .map((link) => (
                  <li key={link.path}>
                    <NavButton onClick={() => goTo(link.path)}>{humanizeNavLabel(t(link.label))}</NavButton>
                  </li>
                ))}
              {showPatientLinks &&
                patientLinks.map((link) => (
                  <li key={link.path}>
                    <NavButton onClick={() => goTo(link.path)}>{humanizeNavLabel(t(link.label))}</NavButton>
                  </li>
                ))}
              {showPrivacyLink && (
                <li>
                  <NavButton onClick={() => goTo('/')}>{humanizeNavLabel(t(footer.privacyLabel || 'Privacy Policy'))}</NavButton>
                </li>
              )}
            </ul>
          </nav>

          {/* Contact */}
          <div className='lg:col-span-4'>
            <h2 className={`${sectionHeadingClass} mb-4`}>{humanizeNavLabel(t(contactTitle))}</h2>
            <div className='flex flex-col gap-3'>
              <a
                href={`tel:${phoneNumber.replace(/\s/g, '')}`}
                className='group flex gap-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm ring-1 ring-slate-100/80 transition hover:border-teal-200/90 hover:shadow-md'
              >
                <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary/15'>
                  <Phone className='h-5 w-5' strokeWidth={2} aria-hidden />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block text-xs font-semibold uppercase tracking-wide text-slate-500'>{humanizeNavLabel(t(phoneLabel))}</span>
                  <span className='mt-1 block text-[15px] font-medium text-slate-900 transition group-hover:text-primary'>{phoneNumber}</span>
                </span>
              </a>
              <a
                href={`mailto:${email}`}
                className='group flex gap-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm ring-1 ring-slate-100/80 transition hover:border-teal-200/90 hover:shadow-md'
              >
                <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary/15'>
                  <Mail className='h-5 w-5' strokeWidth={2} aria-hidden />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block text-xs font-semibold uppercase tracking-wide text-slate-500'>{humanizeNavLabel(t(emailLabel))}</span>
                  <span className='mt-1 block break-all text-[15px] font-medium text-slate-900 transition group-hover:text-primary'>{email}</span>
                </span>
              </a>
            </div>
          </div>
        </div>

        <div className='mt-14 border-t border-slate-200/90 pt-8'>
          <p className='text-center text-[13px] leading-relaxed text-slate-500'>
            {t(copyrightText)}
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
