import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronRight, LayoutGrid, Menu, X } from 'lucide-react'
import { useLanguage } from '../i18n'

const drawerLinkClass = (isActive) =>
  `flex w-full min-h-[48px] items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition active:scale-[0.99] ${
    isActive
      ? 'bg-primary text-white shadow-sm'
      : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
  }`

const StaffMobileNav = ({
  links,
  findActiveLink,
  navSummary,
  roleLabel,
  drawerAriaLabel,
}) => {
  const { t, isRtl } = useLanguage()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const activeLink = useMemo(
    () => (findActiveLink ? findActiveLink(pathname, links) : links.find((l) => l.path === pathname)),
    [pathname, links, findActiveLink],
  )
  const ActiveIcon = activeLink?.icon

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen])

  const initial = (navSummary?.name || roleLabel || '?').trim().charAt(0).toUpperCase() || '?'
  const drawerSide = isRtl ? 'left-0 border-r' : 'right-0 border-l'
  const subtitle = navSummary?.speciality || navSummary?.email || ''

  return (
    <>
      <div
        className='sticky top-0 z-30 border-b border-gray-200 bg-white/95 px-3 py-2.5 backdrop-blur sm:px-4 md:hidden'
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))' }}
      >
        <div className='flex items-center gap-3'>
          <button
            type='button'
            onClick={() => setMenuOpen((open) => !open)}
            className='inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition active:bg-gray-50'
            aria-expanded={menuOpen}
            aria-controls='staff-mobile-nav-drawer'
            aria-label={t('Menu')}
          >
            {menuOpen ? <X className='h-5 w-5 text-primary' /> : <Menu className='h-5 w-5 text-primary' />}
            <span>{menuOpen ? t('Close') : t('Menu')}</span>
          </button>

          <div className='flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-primary/15 bg-gradient-to-r from-[#F2F3FF] to-white px-3 py-2'>
            <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm'>
              {ActiveIcon ? <ActiveIcon className='h-5 w-5' /> : <LayoutGrid className='h-5 w-5' />}
            </span>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-bold text-gray-900'>{activeLink?.label || roleLabel}</p>
              {subtitle ? <p className='truncate text-xs text-gray-500'>{subtitle}</p> : null}
            </div>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div
          className='fixed inset-0 z-[55] md:hidden'
          role='dialog'
          aria-modal='true'
          aria-label={drawerAriaLabel || roleLabel}
        >
          <div
            className='absolute inset-0 bg-gray-950/50 backdrop-blur-[2px]'
            onClick={() => setMenuOpen(false)}
            role='presentation'
          />

          <aside
            id='staff-mobile-nav-drawer'
            className={`absolute top-0 ${drawerSide} bottom-0 flex h-full w-[min(100vw-1rem,22rem)] max-w-sm flex-col overflow-hidden bg-white shadow-2xl`}
          >
            <div className='border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]'>
              <div className='flex items-start justify-between gap-3'>
                <div className='mt-1 flex min-w-0 flex-1 items-center gap-3'>
                  <span className='relative flex h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 ring-2 ring-white shadow-sm'>
                    {navSummary?.image ? (
                      <img src={navSummary.image} alt='' className='h-full w-full object-cover' />
                    ) : (
                      <span className='flex h-full w-full items-center justify-center text-sm font-bold text-white'>
                        {initial}
                      </span>
                    )}
                  </span>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-bold text-gray-900'>{navSummary?.name || roleLabel}</p>
                    {subtitle ? (
                      <p className='truncate text-xs text-gray-500'>{subtitle}</p>
                    ) : null}
                  </div>
                </div>
                <button
                  type='button'
                  onClick={() => setMenuOpen(false)}
                  className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm active:bg-gray-50'
                  aria-label={t('Close')}
                >
                  <X className='h-5 w-5' />
                </button>
              </div>
            </div>

            <nav className='flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]'>
              <ul className='space-y-0.5'>
                {links.map((link) => {
                  const LinkIcon = link.icon
                  return (
                    <li key={link.path}>
                      <NavLink
                        to={link.path}
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) => drawerLinkClass(isActive)}
                      >
                        <span className='flex min-w-0 items-center gap-3'>
                          {LinkIcon ? <LinkIcon className='h-4 w-4 shrink-0' /> : null}
                          <span className='truncate'>{link.label}</span>
                        </span>
                        <ChevronRight className='h-4 w-4 shrink-0 opacity-60' />
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}

export default StaffMobileNav
