import React, { useContext, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CreditCard,
  HeartPulse,
  Home,
  Info,
  Languages,
  LogOut,
  Menu,
  Phone,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react'
import { LanguageToggle, useLanguage } from '../i18n'
import { ThemeToggle } from './ui/ThemeToggle'
import { Skeleton } from './ui'
import PatientNotificationBell from './PatientNotificationBell'
import { patientDrawerLogoClassName, patientHeaderLogoClassName } from '../utils/brandingLogo'
import { resolveLogoAltText } from '../utils/siteSettingsBranding'
import BrandLogo from './BrandLogo'

const publicLinks = [
  { to: '/', label: 'nav.home', icon: Home },
  { to: '/doctors', label: 'nav.doctors', icon: Stethoscope },
  { to: '/about', label: 'nav.about', icon: Info },
  { to: '/contact', label: 'nav.contact', icon: Phone },
]

const accountLinks = [
  { to: '/my-profile', label: 'My Profile', icon: UserRound },
  { to: '/medical-history', label: 'Medical History', icon: HeartPulse },
  { to: '/insurance', label: 'Insurance', icon: CreditCard },
]

/* Close a popup on Escape or on a press outside it */
function useDismiss(open, close, ref) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && close()
    const onPointer = (event) => ref.current && !ref.current.contains(event.target) && close()
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, close, ref])
}

const Navbar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, setToken, userData, siteSettings, displayPersonName } = useContext(AppContext)
  const { t } = useLanguage()
  const [showMenu, setShowMenu] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const accountRef = useRef(null)
  const drawerRef = useRef(null)
  const closeButtonRef = useRef(null)
  const menuButtonRef = useRef(null)

  const logoAltText = resolveLogoAltText(siteSettings)
  const closeAccount = React.useCallback(() => setShowAccount(false), [])
  const closeMenu = React.useCallback(() => setShowMenu(false), [])
  useDismiss(showAccount, closeAccount, accountRef)
  useDismiss(showMenu, closeMenu, drawerRef)

  const logout = () => {
    setToken(false)
    localStorage.removeItem('token')
    navigate('/')
  }

  useEffect(() => {
    setShowMenu(false)
    setShowAccount(false)
  }, [location.pathname])

  useEffect(() => {
    if (!showMenu) return undefined
    const prev = document.body.style.overflow
    const opener = menuButtonRef.current
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = prev
      opener?.focus()
    }
  }, [showMenu])

  const drawerLinkClass = ({ isActive }) =>
    `flex w-full items-center justify-between gap-3 rounded-control px-4 py-3.5 text-body font-medium transition ${
      isActive ? 'bg-primary text-on-primary shadow-e1' : 'bg-surface-sunken text-ink active:bg-primary-soft'
    }`

  const signedIn = Boolean(token && userData)
  const loadingUser = Boolean(token && !userData)

  return (
    <header className='sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-md supports-[backdrop-filter]:bg-surface/80'>
      <div className='mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3 px-gutter py-2 sm:gap-4'>
        <Link to='/' className='flex shrink-0 items-center rounded-control' aria-label={logoAltText}>
          <BrandLogo siteSettings={siteSettings} imgClassName={patientHeaderLogoClassName} />
        </Link>

        <nav aria-label={t('Main')} className='hidden min-w-0 flex-1 justify-center md:flex'>
          <ul className='inline-flex items-center gap-1 rounded-full border border-line bg-surface-sunken p-1 text-body-sm font-medium'>
            {publicLinks.map(({ to, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `block whitespace-nowrap rounded-full px-4 py-2 transition duration-(--duration-fast) ${
                      isActive ? 'bg-surface text-brand shadow-e1' : 'text-ink-2 hover:text-ink'
                    }`
                  }
                >
                  {t(label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className='ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2'>
          <span className='hidden md:contents'>
            <LanguageToggle compact />
            <ThemeToggle />
          </span>

          {signedIn && (
            <>
              <PatientNotificationBell />
              <Link
                to='/my-appointments'
                className='hidden min-h-10 items-center gap-2 rounded-control bg-primary px-4 text-body-sm font-semibold text-on-primary shadow-e1 transition hover:bg-primary-dark lg:inline-flex'
              >
                <CalendarDays aria-hidden='true' className='size-4' />
                {t('My Appointments')}
              </Link>
              <div ref={accountRef} className='relative hidden md:block'>
                <button
                  type='button'
                  onClick={() => setShowAccount((open) => !open)}
                  aria-expanded={showAccount}
                  aria-haspopup='true'
                  aria-controls='account-menu'
                  className='flex max-w-48 items-center gap-2 rounded-full border border-line bg-surface p-1 pe-2 text-start transition hover:border-primary'
                >
                  <img className='size-8 shrink-0 rounded-full object-cover' src={userData.image} alt='' />
                  <span className='hidden min-w-0 flex-1 truncate text-body-sm font-semibold text-ink xl:block'>
                    {displayPersonName(userData.name) || t('User')}
                  </span>
                  <ChevronDown aria-hidden='true' className={`size-4 shrink-0 text-ink-3 transition ${showAccount ? 'rotate-180' : ''}`} />
                  <span className='sr-only'>{t('Account')}</span>
                </button>
                {showAccount && (
                  <div id='account-menu' className='absolute end-0 top-full z-50 mt-2 w-64 animate-rise rounded-card border border-line bg-surface-raised p-2 shadow-e2'>
                    <p className='truncate px-3 pb-2 pt-1 text-caption text-ink-3'>{userData.email}</p>
                    <ul>
                      {[{ to: '/my-appointments', label: 'My Appointments', icon: CalendarDays }, ...accountLinks].map(({ to, label, icon: Icon }) => (
                        <li key={to}>
                          <Link to={to} className='flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-body-sm text-ink transition hover:bg-primary-soft hover:text-brand'>
                            <Icon aria-hidden='true' className='size-4 shrink-0' />
                            {t(label)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <button
                      type='button'
                      onClick={logout}
                      className='mt-1 flex w-full items-center gap-3 rounded-control border-t border-line px-3 py-2.5 text-start text-body-sm text-danger-ink transition hover:bg-danger-soft'
                    >
                      <LogOut aria-hidden='true' className='size-4' />
                      {t('Logout')}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {loadingUser && <Skeleton circle className='hidden size-10 md:block' />}

          {!token && (
            <span className='hidden items-center gap-2 md:flex'>
              <Link to='/login?mode=login' className='inline-flex min-h-10 items-center rounded-control px-3 text-body-sm font-semibold text-brand transition hover:bg-primary-soft'>
                {t('Sign in')}
              </Link>
              <Link to='/login?mode=signup' className='inline-flex min-h-10 items-center rounded-control bg-primary px-4 text-body-sm font-semibold text-on-primary shadow-e1 transition hover:bg-primary-dark'>
                {t('Create Account')}
              </Link>
            </span>
          )}

          <span className='md:hidden'>
            <LanguageToggle compact />
          </span>
          <button
            ref={menuButtonRef}
            type='button'
            onClick={() => setShowMenu(true)}
            className='inline-flex size-10 items-center justify-center rounded-control border border-line bg-surface text-ink transition active:bg-primary-soft md:hidden'
            aria-label={t('Menu')}
            aria-expanded={showMenu}
            aria-controls='site-drawer'
          >
            <Menu aria-hidden='true' className='size-5' />
          </button>
        </div>
      </div>

      {showMenu && (
        <div className='fixed inset-0 z-[60] md:hidden' role='dialog' aria-modal='true' aria-label={t('Menu')}>
          <div className='absolute inset-0 animate-fade bg-(--color-scrim)' aria-hidden='true' />
          <aside
            id='site-drawer'
            ref={drawerRef}
            className='absolute inset-y-0 end-0 flex w-[min(100vw-2.5rem,22rem)] animate-fade flex-col overflow-hidden bg-surface shadow-e3'
          >
            <div className='border-b border-line bg-primary-soft px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]'>
              <div className='flex items-center justify-between gap-3'>
                <Link to='/' className='min-w-0' aria-label={logoAltText}>
                  <BrandLogo siteSettings={siteSettings} imgClassName={patientDrawerLogoClassName} />
                </Link>
                <button
                  ref={closeButtonRef}
                  type='button'
                  onClick={closeMenu}
                  className='flex size-10 shrink-0 items-center justify-center rounded-control border border-line bg-surface text-ink-2'
                  aria-label={t('Close')}
                >
                  <X aria-hidden='true' className='size-5' />
                </button>
              </div>
              {signedIn ? (
                <div className='mt-4 flex items-center gap-3 rounded-card bg-surface p-3 shadow-e1'>
                  <img className='size-12 shrink-0 rounded-full object-cover' src={userData.image} alt='' />
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-body-sm font-semibold text-ink'>{displayPersonName(userData.name) || t('User')}</p>
                    <p className='truncate text-caption text-ink-2'>{userData.email}</p>
                  </div>
                </div>
              ) : (
                <p className='mt-3 text-body-sm text-ink-2'>{t('Menu welcome guest')}</p>
              )}
            </div>

            <div className='flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]'>
              <nav aria-label={t('Main')}>
                <ul className='flex flex-col gap-1.5'>
                  {publicLinks.map(({ to, label, icon: Icon }) => (
                    <li key={to}>
                      <NavLink to={to} end={to === '/'} className={drawerLinkClass} onClick={closeMenu}>
                        <span className='flex items-center gap-3'>
                          <Icon aria-hidden='true' className='size-4 shrink-0' />
                          {t(label)}
                        </span>
                        <ChevronRight aria-hidden='true' className='size-4 shrink-0 opacity-60 rtl:-scale-x-100' />
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              {token && (
                <>
                  <p className='mb-2 mt-6 text-caption font-semibold uppercase tracking-wide text-ink-3'>{t('My Care')}</p>
                  <ul className='flex flex-col gap-1.5'>
                    {[{ to: '/my-appointments', label: 'My Appointments', icon: CalendarDays }, ...accountLinks].map(({ to, label, icon: Icon }) => (
                      <li key={to}>
                        <NavLink to={to} className={drawerLinkClass} onClick={closeMenu}>
                          <span className='flex items-center gap-3'>
                            <Icon aria-hidden='true' className='size-4 shrink-0' />
                            {t(label)}
                          </span>
                          <ChevronRight aria-hidden='true' className='size-4 shrink-0 opacity-60 rtl:-scale-x-100' />
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className='mt-6 rounded-card border border-line bg-surface-sunken p-4'>
                <p className='mb-3 flex items-center gap-2 text-body-sm font-semibold text-ink'>
                  <Languages aria-hidden='true' className='size-4 text-brand' />
                  {t('Language')}
                </p>
                <div className='flex items-center justify-between gap-3'>
                  <LanguageToggle />
                  <ThemeToggle />
                </div>
              </div>

              {!token && (
                <div className='mt-6 grid gap-3'>
                  <Link to='/login?mode=login' className='flex min-h-12 items-center justify-center rounded-control border border-primary font-semibold text-brand'>
                    {t('Sign in')}
                  </Link>
                  <Link to='/login?mode=signup' className='flex min-h-12 items-center justify-center rounded-control bg-primary font-semibold text-on-primary shadow-e1'>
                    {t('Create Account')}
                  </Link>
                </div>
              )}

              {signedIn && (
                <button
                  type='button'
                  onClick={() => {
                    closeMenu()
                    logout()
                  }}
                  className='mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-danger-soft text-body-sm font-semibold text-danger-ink'
                >
                  <LogOut aria-hidden='true' className='size-4' />
                  {t('Logout')}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </header>
  )
}

export default Navbar
