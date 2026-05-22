import React, { useContext, useEffect, useRef, useState } from 'react'
import { assets } from '../assets/assets'
import { AdminContext } from '../context/AdminContext'
import { Link, useNavigate } from 'react-router-dom'
import { DoctorContext } from '../context/DoctorContext'
import { ReceptionistContext } from '../context/ReceptionistContext'
import { LanguageToggle, useLanguage } from '../i18n'
import { ChevronDown, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import NotificationBell from './NotificationBell'
import { staffHeaderLogoClassName } from '../utils/brandingLogo'
import { DEFAULT_APP_DISPLAY_NAME } from '../utils/appDisplayName'

const Navbar = () => {
  const { aToken, setAToken, siteSettings, adminNavSummary } = useContext(AdminContext)
  const { dToken, setDToken, doctorNavSummary, setProfileData } = useContext(DoctorContext)
  const { rToken, setRToken, receptionistNavSummary } = useContext(ReceptionistContext)
  const { t } = useLanguage()

  const navigate = useNavigate()
  const [receptionistMenuOpen, setReceptionistMenuOpen] = useState(false)
  const receptionistMenuRef = useRef(null)
  const [doctorMenuOpen, setDoctorMenuOpen] = useState(false)
  const doctorMenuRef = useRef(null)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const adminMenuRef = useRef(null)

  useEffect(() => {
    if (!adminMenuOpen) return undefined
    const handlePointerDown = (event) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
        setAdminMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [adminMenuOpen])

  useEffect(() => {
    if (!doctorMenuOpen) return undefined
    const handlePointerDown = (event) => {
      if (doctorMenuRef.current && !doctorMenuRef.current.contains(event.target)) {
        setDoctorMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [doctorMenuOpen])

  const logout = () => {
    navigate('/')
    setReceptionistMenuOpen(false)
    setDoctorMenuOpen(false)
    setAdminMenuOpen(false)
    if (aToken) {
      setAToken('')
      localStorage.removeItem('aToken')
    }
    if (dToken) {
      setDToken('')
      setProfileData(false)
      localStorage.removeItem('dToken')
    }
    if (rToken) {
      setRToken('')
      localStorage.removeItem('rToken')
    }
  }

  const receptionistInitial = (receptionistNavSummary?.name || '?').trim().charAt(0).toUpperCase() || '?'
  const doctorInitial = (doctorNavSummary?.name || '?').trim().charAt(0).toUpperCase() || '?'
  const adminInitial = (adminNavSummary?.name || 'A').trim().charAt(0).toUpperCase() || 'A'

  const headerLogoSrc = siteSettings?.branding?.headerLogoUrl || assets.site_default_logo
  const logoAltText = siteSettings?.branding?.altText || DEFAULT_APP_DISPLAY_NAME
  const logoImgClassName = staffHeaderLogoClassName

  const goHomeFromLogo = () => {
    if (aToken) navigate('/admin-dashboard')
    else if (dToken) navigate('/doctor-dashboard')
    else if (rToken) navigate('/receptionist-dashboard')
  }

  return (
    <div dir='ltr' className='fixed top-0 left-0 right-0 z-50 flex h-[4.5rem] justify-between items-center border-b bg-white px-4 py-2 shadow-sm md:px-6'>
      <div className='flex items-center gap-2 md:gap-3 min-w-0'>
        <button
          type='button'
          onClick={goHomeFromLogo}
          className='flex shrink-0 cursor-pointer items-center justify-start border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded'
          aria-label={logoAltText}
        >
          <img
            className={logoImgClassName}
            src={headerLogoSrc}
            alt={logoAltText}
          />
        </button>
        <p className='border px-2 sm:px-2.5 py-0.5 rounded-full border-gray-500 text-gray-600 text-[10px] sm:text-xs md:text-sm font-medium whitespace-nowrap shrink-0'>
          {aToken ? t('Admin') : dToken ? t('Doctor') : t('Receptionist')}
        </p>
      </div>

      <div className='flex items-center gap-2 sm:gap-3 shrink-0'>
        <LanguageToggle compact />

        <NotificationBell />

        {rToken && (
          <div className='relative' ref={receptionistMenuRef}>
            <button
              type='button'
              onClick={() => setReceptionistMenuOpen((o) => !o)}
              className='flex items-center gap-1.5 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-2 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30'
              aria-expanded={receptionistMenuOpen}
              aria-haspopup='menu'
            >
              <span className='relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary/90 to-primary ring-2 ring-white'>
                {receptionistNavSummary?.image ? (
                  <img src={receptionistNavSummary.image} alt='' className='h-full w-full object-cover' />
                ) : (
                  <span className='flex h-full w-full items-center justify-center text-sm font-bold text-white'>{receptionistInitial}</span>
                )}
              </span>
              <ChevronDown className={`hidden h-4 w-4 text-gray-600 transition sm:block ${receptionistMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {receptionistMenuOpen && (
              <div
                role='menu'
                className='absolute right-0 top-full z-[60] mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5'
              >
                <div className='border-b border-gray-100 px-3 py-2.5'>
                  <p className='truncate text-sm font-semibold text-gray-900'>{receptionistNavSummary?.name || t('Receptionist')}</p>
                  <p className='truncate text-xs text-gray-500'>{t('Receptionist')}</p>
                </div>
                <Link
                  role='menuitem'
                  to='/receptionist-profile'
                  onClick={() => setReceptionistMenuOpen(false)}
                  className='flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50'
                >
                  <UserRound className='h-4 w-4 text-primary shrink-0' />
                  {t('My Profile')}
                </Link>
                <button
                  type='button'
                  role='menuitem'
                  onClick={logout}
                  className='flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50'
                >
                  <LogOut className='h-4 w-4 shrink-0' />
                  {t('Logout')}
                </button>
              </div>
            )}
          </div>
        )}

        {dToken && !rToken && (
          <div className='relative' ref={doctorMenuRef}>
            <button
              type='button'
              onClick={() => setDoctorMenuOpen((o) => !o)}
              className='flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/25'
              aria-expanded={doctorMenuOpen}
              aria-haspopup='menu'
              aria-label={t('My Profile')}
            >
              <span className='relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 ring-2 ring-white'>
                {doctorNavSummary?.image ? (
                  <img src={doctorNavSummary.image} alt='' className='h-full w-full object-cover' />
                ) : (
                  <span className='flex h-full w-full items-center justify-center text-sm font-bold text-white'>{doctorInitial}</span>
                )}
              </span>
              <ChevronDown className={`hidden h-4 w-4 text-slate-600 transition sm:block ${doctorMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {doctorMenuOpen && (
              <div
                role='menu'
                className='absolute right-0 top-full z-[60] mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5'
              >
                <div className='border-b border-slate-100 px-3 py-2.5'>
                  <p className='truncate text-sm font-semibold text-slate-900'>{doctorNavSummary?.name || t('Doctor')}</p>
                  <p className='truncate text-xs text-slate-500'>{doctorNavSummary?.speciality || t('Doctor')}</p>
                </div>
                <Link
                  role='menuitem'
                  to='/doctor-profile'
                  onClick={() => setDoctorMenuOpen(false)}
                  className='flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50'
                >
                  <UserRound className='h-4 w-4 shrink-0 text-indigo-600' />
                  {t('My Profile')}
                </Link>
                <button
                  type='button'
                  role='menuitem'
                  onClick={logout}
                  className='flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50'
                >
                  <LogOut className='h-4 w-4 shrink-0' />
                  {t('Logout')}
                </button>
              </div>
            )}
          </div>
        )}

        {aToken && !dToken && !rToken && (
          <div className='relative' ref={adminMenuRef}>
            <button
              type='button'
              onClick={() => setAdminMenuOpen((o) => !o)}
              className='flex items-center gap-1.5 rounded-full border border-blue-200 bg-white py-1 pl-1 pr-2 shadow-sm transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-primary/30'
              aria-expanded={adminMenuOpen}
              aria-haspopup='menu'
              aria-label={t('My account')}
            >
              <span className='relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 ring-2 ring-white'>
                {adminNavSummary?.image ? (
                  <img src={adminNavSummary.image} alt='' className='h-full w-full object-cover' />
                ) : (
                  <span className='flex h-full w-full items-center justify-center text-sm font-bold text-white'>{adminInitial}</span>
                )}
              </span>
              <ChevronDown className={`hidden h-4 w-4 text-gray-600 transition sm:block ${adminMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {adminMenuOpen && (
              <div
                role='menu'
                className='absolute right-0 top-full z-[60] mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5'
              >
                <div className='border-b border-gray-100 px-3 py-2.5'>
                  <p className='truncate text-sm font-semibold text-gray-900'>{adminNavSummary?.name || t('Admin')}</p>
                  <p className='truncate text-xs text-gray-500'>{adminNavSummary?.email || t('Administrator account')}</p>
                  {adminNavSummary?.jobTitle && (
                    <p className='truncate text-xs text-gray-400'>{adminNavSummary.jobTitle}</p>
                  )}
                </div>
                <Link
                  role='menuitem'
                  to='/admin-profile'
                  onClick={() => setAdminMenuOpen(false)}
                  className='flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50'
                >
                  <UserRound className='h-4 w-4 shrink-0 text-primary' />
                  {t('My Profile')}
                </Link>
                <Link
                  role='menuitem'
                  to='/security-settings'
                  onClick={() => setAdminMenuOpen(false)}
                  className='flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50'
                >
                  <ShieldCheck className='h-4 w-4 shrink-0 text-slate-500' />
                  {t('Security settings')}
                </Link>
                <button
                  type='button'
                  role='menuitem'
                  onClick={logout}
                  className='flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50'
                >
                  <LogOut className='h-4 w-4 shrink-0' />
                  {t('Logout')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Navbar
