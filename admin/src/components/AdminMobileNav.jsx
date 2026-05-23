import React, { useContext, useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, LayoutGrid, Menu, X } from 'lucide-react'
import { AdminContext } from '../context/AdminContext'
import { useLanguage } from '../i18n'
import { findActiveAdminLink, getAdminSections, isAdminPathActive } from '../config/adminNav'

const drawerLinkClass = (isActive) =>
  `flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition active:scale-[0.99] ${
    isActive
      ? 'bg-primary text-white shadow-sm'
      : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
  }`

const AdminMobileNav = () => {
  const { adminNavSummary } = useContext(AdminContext)
  const { t, isRtl } = useLanguage()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openSections, setOpenSections] = useState({})

  const sections = useMemo(() => getAdminSections(t), [t])
  const activeLink = useMemo(() => findActiveAdminLink(pathname, sections), [pathname, sections])
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

  useEffect(() => {
    if (!activeLink?.sectionTitle) return
    setOpenSections((previous) => ({
      ...previous,
      [activeLink.sectionTitle]: true
    }))
  }, [activeLink?.sectionTitle])

  const toggleSection = (title) => {
    setOpenSections((previous) => ({
      ...previous,
      [title]: !previous[title]
    }))
  }

  const isSectionOpen = (title) =>
    openSections[title] ??
    sections.some(
      (section) =>
        section.title === title &&
        section.links.some((link) => isAdminPathActive(pathname, link.path))
    )

  const adminInitial = (adminNavSummary?.name || 'A').trim().charAt(0).toUpperCase() || 'A'
  const drawerSide = isRtl ? 'left-0 border-r' : 'right-0 border-l'

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
            className='inline-flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition active:bg-gray-50'
            aria-expanded={menuOpen}
            aria-controls='admin-mobile-nav-drawer'
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
              <p className='truncate text-sm font-bold text-gray-900'>{activeLink?.label || t('Admin')}</p>
              {activeLink?.sectionTitle ? (
                <p className='truncate text-xs text-gray-500'>{activeLink.sectionTitle}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className='fixed inset-0 z-[55] md:hidden' role='dialog' aria-modal='true' aria-label={t('Admin navigation')}>
          <div
            className='absolute inset-0 bg-gray-950/50 backdrop-blur-[2px]'
            onClick={() => setMenuOpen(false)}
            role='presentation'
          />

          <aside
            id='admin-mobile-nav-drawer'
            className={`absolute top-0 ${drawerSide} bottom-0 flex h-full w-[min(100vw-1rem,22rem)] max-w-sm flex-col overflow-hidden bg-white shadow-2xl`}
          >
            <div className='border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]'>
              <div className='flex items-start justify-between gap-3'>
                <div className='mt-1 flex min-w-0 flex-1 items-center gap-3'>
                  <span className='relative flex h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 ring-2 ring-white shadow-sm'>
                    {adminNavSummary?.image ? (
                      <img src={adminNavSummary.image} alt='' className='h-full w-full object-cover' />
                    ) : (
                      <span className='flex h-full w-full items-center justify-center text-sm font-bold text-white'>
                        {adminInitial}
                      </span>
                    )}
                  </span>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-bold text-gray-900'>{adminNavSummary?.name || t('Admin')}</p>
                    <p className='truncate text-xs text-gray-500'>{adminNavSummary?.email || t('Administrator account')}</p>
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
              {sections.map((section) => {
                const SectionIcon = section.icon
                const sectionActive = section.links.some((link) => isAdminPathActive(pathname, link.path))
                const expanded = isSectionOpen(section.title)

                return (
                  <div key={section.title} className='mb-2'>
                    <button
                      type='button'
                      onClick={() => toggleSection(section.title)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                        sectionActive
                          ? 'bg-[#F2F3FF] text-primary'
                          : 'text-gray-800 hover:bg-gray-50 active:bg-gray-100'
                      }`}
                      aria-expanded={expanded}
                    >
                      <span className='flex min-w-0 items-center gap-2.5'>
                        <SectionIcon className='h-5 w-5 shrink-0' />
                        <span className='truncate text-sm font-semibold'>{section.title}</span>
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>

                    {expanded && (
                      <ul className='mt-1 space-y-0.5 pl-1'>
                        {section.links.map((link) => {
                          const LinkIcon = link.icon
                          return (
                            <li key={link.path}>
                              <NavLink
                                to={link.path}
                                onClick={() => setMenuOpen(false)}
                                className={() => drawerLinkClass(isAdminPathActive(pathname, link.path))}
                              >
                                <span className='flex min-w-0 items-center gap-3'>
                                  <LinkIcon className='h-4 w-4 shrink-0' />
                                  <span className='truncate'>{link.label}</span>
                                </span>
                                <ChevronRight className='h-4 w-4 shrink-0 opacity-60' />
                              </NavLink>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}

export default AdminMobileNav
