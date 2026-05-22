import React, { useContext, useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import {
  CalendarDays,
  ChevronDown,
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
import PatientNotificationBell from './PatientNotificationBell'
import { patientDrawerLogoClassName, patientHeaderLogoClassName } from '../utils/brandingLogo'
import { resolveLogoAltText } from '../utils/siteSettingsBranding'
import BrandLogo from './BrandLogo'

const Navbar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, setToken, userData, siteSettings, displayPersonName } = useContext(AppContext)
  const { t } = useLanguage()
  const [showMenu, setShowMenu] = useState(false)

  const logoAltText = resolveLogoAltText(siteSettings)

  const publicLinks = [
    { to: '/', label: 'HOME', icon: Home },
    { to: '/doctors', label: 'ALL DOCTORS', icon: Stethoscope },
    { to: '/about', label: 'ABOUT', icon: Info },
    { to: '/contact', label: 'CONTACT', icon: Phone },
  ]

  const accountLinks = [
    { to: '/my-profile', label: 'My Profile', icon: UserRound },
    { to: '/medical-history', label: 'Medical History', icon: HeartPulse },
    { to: '/insurance', label: 'Insurance', icon: CreditCard },
  ]

  const logout = () => {
    setToken(false)
    localStorage.removeItem('token')
    navigate('/')
  }

  const closeAndNavigate = (path) => {
    setShowMenu(false)
    navigate(path)
  }

  useEffect(() => {
    setShowMenu(false)
  }, [location.pathname])

  useEffect(() => {
    if (!showMenu) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [showMenu])

  const drawerLinkClass = (isActive) =>
    `flex w-full items-center gap-3 rounded-xl px-4 py-3 font-medium transition ${
      isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-teal-50 hover:text-primary'
    }`

  return (
    <header className='sticky top-0 z-50 border-b border-gray-200/90 bg-white shadow-sm'>
      <div className='flex min-h-[3.5rem] items-center gap-3 py-2 sm:min-h-[3.75rem] sm:gap-4'>
        <button
          type='button'
          onClick={() => navigate('/')}
          className='flex shrink-0 items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35'
          aria-label={logoAltText}
        >
          <BrandLogo siteSettings={siteSettings} imgClassName={patientHeaderLogoClassName} />
        </button>

        <nav aria-label='Primary' className='hidden min-w-0 flex-1 justify-center md:flex'>
          <div className='inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-teal-100/90 bg-teal-50/60 p-1 text-sm font-medium text-gray-700 shadow-sm'>
            {publicLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-3 py-2 transition sm:px-4 ${
                    isActive ? 'bg-white text-primary shadow-sm' : 'hover:bg-white/85 hover:text-primary'
                  }`
                }
              >
                {t(label)}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className='ml-auto flex shrink-0 items-center gap-2 sm:gap-3'>
          {token && userData ? (
            <>
              <div className='hidden items-center gap-2 md:flex md:gap-3'>
                <button
                  type='button'
                  onClick={() => navigate('/my-appointments')}
                  className='inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark sm:px-5 sm:py-2.5'
                >
                  <CalendarDays className='h-4 w-4 shrink-0' />
                  <span className='hidden sm:inline'>{t('My Appointments')}</span>
                  <span className='sm:hidden'>{t('APPOINTMENTS')}</span>
                </button>

                <div className='rounded-full border border-teal-100 bg-white p-1 shadow-sm'>
                  <LanguageToggle compact />
                </div>

                <PatientNotificationBell />

                <div className='group relative'>
                  <button
                    type='button'
                    className='flex max-w-[12rem] items-center gap-2 rounded-full border border-teal-100 bg-white px-2 py-1.5 text-left shadow-sm transition hover:border-primary/40 hover:bg-teal-50'
                  >
                    <img
                      className='h-9 w-9 shrink-0 rounded-full border-2 border-teal-100 object-cover'
                      src={userData.image}
                      alt=''
                    />
                    <div className='hidden min-w-0 flex-1 lg:block'>
                      <p className='truncate text-sm font-semibold text-gray-900'>
                        {displayPersonName(userData.name) || t('User')}
                      </p>
                      <p className='truncate text-xs text-gray-500'>{t('Account')}</p>
                    </div>
                    <ChevronDown className='h-4 w-4 shrink-0 text-gray-500' />
                  </button>

                  <div className='absolute right-0 top-full z-50 hidden pt-2 group-hover:block'>
                    <div className='w-64 rounded-xl border border-teal-100 bg-white p-2 text-gray-700 shadow-xl'>
                      {accountLinks.map(({ to, label, icon: Icon }) => (
                        <button
                          key={to}
                          type='button'
                          onClick={() => navigate(to)}
                          className='flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-teal-50 hover:text-primary'
                        >
                          <Icon className='h-4 w-4 shrink-0' />
                          {t(label)}
                        </button>
                      ))}

                      <div className='my-2 border-t border-gray-100 pt-2'>
                        <div className='mb-2 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400'>
                          <Languages className='h-3.5 w-3.5' />
                          {t('Language')}
                        </div>
                        <div className='px-3'>
                          <LanguageToggle />
                        </div>
                      </div>

                      <button
                        type='button'
                        onClick={logout}
                        className='flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50'
                      >
                        <LogOut className='h-4 w-4' />
                        {t('Logout')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className='flex items-center gap-1.5 md:hidden'>
                <div className='rounded-full border border-teal-100 bg-white p-0.5 shadow-sm'>
                  <LanguageToggle compact />
                </div>
                <PatientNotificationBell />
              </div>
            </>
          ) : (
            <div className='hidden items-center gap-2 md:flex md:gap-3'>
              <div className='rounded-full border border-teal-100 bg-white p-1 shadow-sm'>
                <LanguageToggle compact />
              </div>
              <button
                type='button'
                onClick={() => navigate('/login?mode=login')}
                className='rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white sm:px-5'
              >
                {t('Sign in')}
              </button>
              <button
                type='button'
                onClick={() => navigate('/login?mode=signup')}
                className='rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark sm:px-5'
              >
                {t('Create Account')}
              </button>
            </div>
          )}

          <button
            type='button'
            onClick={() => setShowMenu(true)}
            className='rounded-full border border-teal-100 bg-teal-50 p-2 text-primary md:hidden'
            aria-label={t('Menu')}
            aria-expanded={showMenu}
          >
            <Menu className='h-5 w-5' />
          </button>
        </div>
      </div>

      {showMenu ? (
        <div className='fixed inset-0 z-[60] md:hidden' role='dialog' aria-modal='true' aria-label={t('Menu')}>
          <div
            className='absolute inset-0 bg-gray-950/40'
            onClick={() => setShowMenu(false)}
            role='presentation'
          />

          <aside className='absolute top-0 right-0 bottom-0 flex h-full w-[min(100vw-2.5rem,20rem)] max-w-sm flex-col overflow-y-auto bg-white shadow-2xl'>
            <div className='flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3'>
              <button type='button' onClick={() => closeAndNavigate('/')} className='min-w-0 text-left'>
                <BrandLogo siteSettings={siteSettings} imgClassName={patientDrawerLogoClassName} />
              </button>
              <button
                type='button'
                onClick={() => setShowMenu(false)}
                className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600'
                aria-label='Close'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            {token && userData && (
              <div className='mx-4 mt-4 flex items-center gap-3 rounded-xl bg-teal-50 p-4'>
                <img className='h-12 w-12 shrink-0 rounded-full border-2 border-white object-cover shadow-sm' src={userData.image} alt='' />
                <div className='min-w-0'>
                  <p className='truncate font-semibold text-gray-900'>{displayPersonName(userData.name) || t('User')}</p>
                  <p className='truncate text-xs text-gray-500'>{userData.email}</p>
                </div>
              </div>
            )}

            <div className='flex-1 px-4 py-4'>
              <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400'>{t('Browse')}</p>
              <ul className='flex flex-col gap-1'>
                {publicLinks.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={to === '/'}
                      onClick={() => setShowMenu(false)}
                      className={({ isActive }) => drawerLinkClass(isActive)}
                    >
                      <Icon className='h-4 w-4 shrink-0' />
                      {t(label)}
                    </NavLink>
                  </li>
                ))}
              </ul>

              {token && (
                <>
                  <p className='mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-400'>{t('My Care')}</p>
                  <ul className='flex flex-col gap-1'>
                    <li>
                      <NavLink to='/my-appointments' onClick={() => setShowMenu(false)} className={({ isActive }) => drawerLinkClass(isActive)}>
                        <CalendarDays className='h-4 w-4 shrink-0' />
                        {t('My Appointments')}
                      </NavLink>
                    </li>
                    {accountLinks.map(({ to, label, icon: Icon }) => (
                      <li key={to}>
                        <NavLink to={to} onClick={() => setShowMenu(false)} className={({ isActive }) => drawerLinkClass(isActive)}>
                          <Icon className='h-4 w-4 shrink-0' />
                          {t(label)}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className='mt-6 rounded-xl border border-teal-100 bg-teal-50/50 p-4'>
                <div className='mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700'>
                  <Languages className='h-4 w-4 text-primary' />
                  {t('Language')}
                </div>
                <LanguageToggle />
              </div>

              {!token && (
                <div className='mt-6 space-y-3'>
                  <button
                    type='button'
                    onClick={() => closeAndNavigate('/login?mode=login')}
                    className='w-full rounded-xl border border-primary py-3 font-semibold text-primary transition hover:bg-primary hover:text-white'
                  >
                    {t('Sign in')}
                  </button>
                  <button
                    type='button'
                    onClick={() => closeAndNavigate('/login?mode=signup')}
                    className='w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-sm transition hover:bg-primary-dark'
                  >
                    {t('Create Account')}
                  </button>
                </div>
              )}

              {token && userData && (
                <button
                  type='button'
                  onClick={() => {
                    setShowMenu(false)
                    logout()
                  }}
                  className='mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3 font-semibold text-white transition hover:bg-red-600'
                >
                  <LogOut className='h-4 w-4' />
                  {t('Logout')}
                </button>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </header>
  )
}

export default Navbar
