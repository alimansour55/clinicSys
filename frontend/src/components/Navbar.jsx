import React, { useContext, useState } from 'react'
import { assets } from '../assets/assets'
import { NavLink, useNavigate } from 'react-router-dom'
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

const Navbar = () => {
  const navigate = useNavigate()
  const { token, setToken, userData } = useContext(AppContext)
  const { t, isRtl } = useLanguage()
  const [showMenu, setShowMenu] = useState(false)

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

  return (
    <header dir='ltr' className='sticky top-0 z-40 mb-5 border-b border-teal-100/80 bg-white/95 backdrop-blur'>
      <div className='flex items-center justify-between gap-4 py-3'>
        <img
          onClick={() => navigate('/')}
          className='w-28 cursor-pointer sm:w-36 lg:w-44'
          src={assets.logo}
          alt='Logo'
        />

        <nav className='hidden items-center rounded-full border border-teal-100 bg-teal-50/50 p-1 text-sm font-medium text-gray-600 shadow-sm md:flex'>
          {publicLinks.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 transition ${
                  isActive ? 'bg-white text-primary shadow-sm' : 'hover:bg-white/80 hover:text-primary'
                }`
              }
            >
              {t(label)}
            </NavLink>
          ))}
        </nav>

        <div className='flex items-center gap-3'>
          {token && userData ? (
            <div className='hidden items-center gap-3 md:flex'>
              <button
                onClick={() => navigate('/my-appointments')}
                className='flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-primary-dark'
              >
                <CalendarDays className='h-4 w-4' />
                {t('My Appointments')}
              </button>

              <div className='rounded-full border border-teal-100 bg-white p-1 shadow-sm'>
                <LanguageToggle compact />
              </div>

              <div className='group relative'>
                <button className='flex items-center gap-2 rounded-full border border-teal-100 bg-white px-2 py-1.5 shadow-sm transition hover:border-primary/40 hover:bg-teal-50'>
                  <img className='h-9 w-9 rounded-full border-2 border-teal-100 object-cover' src={userData.image} alt='Profile' />
                  <div className='hidden max-w-28 text-left lg:block'>
                    <p className='truncate text-sm font-semibold text-gray-900'>{userData.name || t('User')}</p>
                    <p className='text-xs text-gray-500'>{t('Account')}</p>
                  </div>
                  <ChevronDown className='h-4 w-4 text-gray-500' />
                </button>

                <div className='absolute right-0 top-full hidden pt-3 group-hover:block'>
                  <div className='w-64 rounded-xl border border-teal-100 bg-white p-2 text-gray-700 shadow-xl'>
                    {accountLinks.map(({ to, label, icon: Icon }) => (
                      <button
                        key={to}
                        onClick={() => navigate(to)}
                        className='flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-teal-50 hover:text-primary'
                      >
                        <Icon className='h-4 w-4' />
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
          ) : (
            <div className='hidden items-center gap-3 md:flex'>
              <div className='rounded-full border border-teal-100 bg-white p-1 shadow-sm'>
                <LanguageToggle compact />
              </div>
              <button
                onClick={() => navigate('/login?mode=login')}
                className='rounded-full border border-primary px-5 py-2 font-semibold text-primary transition hover:bg-primary hover:text-white'
              >
                {t('Sign in')}
              </button>
              <button
                onClick={() => navigate('/login?mode=signup')}
                className='rounded-full bg-primary px-5 py-2 font-semibold text-white shadow-sm transition hover:bg-primary-dark'
              >
                {t('Create Account')}
              </button>
            </div>
          )}

          <button
            onClick={() => setShowMenu(true)}
            className='rounded-full border border-teal-100 bg-teal-50 p-2 text-primary md:hidden'
            aria-label='Open menu'
          >
            <Menu className='h-5 w-5' />
          </button>
        </div>
      </div>

      <div className={`${showMenu ? 'fixed inset-0' : 'hidden'} z-50 md:hidden`}>
        <div className='fixed inset-0 bg-gray-950/35' onClick={() => setShowMenu(false)}></div>

        <aside
          className={`fixed top-0 ${isRtl ? 'left-0' : 'right-0'} z-50 h-full w-4/5 max-w-sm transform overflow-y-auto bg-white shadow-2xl transition-transform duration-300 ${
            showMenu ? 'translate-x-0' : isRtl ? '-translate-x-full' : 'translate-x-full'
          }`}
        >
          <div className='flex items-center justify-between border-b border-teal-100 px-5 py-5'>
            <img className='w-28 cursor-pointer sm:w-36' src={assets.logo} alt='Logo' onClick={() => closeAndNavigate('/')} />
            <button onClick={() => setShowMenu(false)} className='rounded-full bg-gray-100 p-2 text-gray-600' aria-label='Close menu'>
              <X className='h-5 w-5' />
            </button>
          </div>

          {token && userData && (
            <div className='mx-5 mt-5 flex items-center gap-3 rounded-xl bg-teal-50 p-4'>
              <img className='h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm' src={userData.image} alt='Profile' />
              <div className='min-w-0'>
                <p className='truncate font-semibold text-gray-900'>{userData.name || t('User')}</p>
                <p className='truncate text-xs text-gray-500'>{userData.email}</p>
              </div>
            </div>
          )}

          <div className='px-5 py-5'>
            <p className='mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400'>{t('Browse')}</p>
            <ul className='flex flex-col gap-1'>
              {publicLinks.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={() => setShowMenu(false)}>
                  {({ isActive }) => (
                    <li className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition ${isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-teal-50 hover:text-primary'}`}>
                      <Icon className='h-4 w-4' />
                      {t(label)}
                    </li>
                  )}
                </NavLink>
              ))}
            </ul>

            {token && (
              <>
                <p className='mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-400'>{t('My Care')}</p>
                <ul className='flex flex-col gap-1'>
                  <NavLink to='/my-appointments' onClick={() => setShowMenu(false)}>
                    {({ isActive }) => (
                      <li className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition ${isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-teal-50 hover:text-primary'}`}>
                        <CalendarDays className='h-4 w-4' />
                        {t('My Appointments')}
                      </li>
                    )}
                  </NavLink>

                  {accountLinks.map(({ to, label, icon: Icon }) => (
                    <NavLink key={to} to={to} onClick={() => setShowMenu(false)}>
                      {({ isActive }) => (
                        <li className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition ${isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-teal-50 hover:text-primary'}`}>
                          <Icon className='h-4 w-4' />
                          {t(label)}
                        </li>
                      )}
                    </NavLink>
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

            {token && userData ? (
              <button
                onClick={() => {
                  setShowMenu(false)
                  logout()
                }}
                className='mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3 font-semibold text-white transition hover:bg-red-600'
              >
                <LogOut className='h-4 w-4' />
                {t('Logout')}
              </button>
            ) : (
              <div className='mt-6 space-y-3 border-t border-gray-100 pt-5'>
                <button
                  onClick={() => closeAndNavigate('/login?mode=login')}
                  className='w-full rounded-xl border border-primary py-3 font-semibold text-primary transition hover:bg-primary hover:text-white'
                >
                  {t('Sign in')}
                </button>
                <button
                  onClick={() => closeAndNavigate('/login?mode=signup')}
                  className='w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-sm transition hover:bg-primary-dark'
                >
                  {t('Create Account')}
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </header>
  )
}

export default Navbar
