import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutGrid, Menu, Search, X } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { findActiveAdminLink, getAdminSections } from '../../config/adminNav'
import { IconButton } from '../ui'
import { openCommandPalette } from './CommandPalette'

/** The admin menu on a phone: one bar under the header, and a drawer that covers the page only when asked. */
export default function AdminMobileNav() {
  const { t } = useLanguage()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const sections = useMemo(() => getAdminSections(t), [t])
  const active = findActiveAdminLink(pathname, sections)
  const ActiveIcon = active?.icon || LayoutGrid

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <div className='sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface px-3 py-2 md:hidden'>
        <button
          type='button'
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls='admin-mobile-drawer'
          className='flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-control border border-line bg-surface-raised px-3 text-start'
        >
          <Menu aria-hidden='true' className='size-5 shrink-0 text-brand' />
          <ActiveIcon aria-hidden='true' className='size-4 shrink-0 text-ink-3' />
          <span className='truncate text-body-sm font-semibold text-ink'>{active?.label || t('Menu')}</span>
        </button>
        <IconButton label={t('Search everything')} variant='secondary' onClick={openCommandPalette}>
          <Search aria-hidden='true' className='size-5' />
        </IconButton>
      </div>

      {/* In a portal, because the scrolling page is a stacking context below the navbar */}
      {open && createPortal(
        <div className='fixed inset-0 z-[55] md:hidden' role='dialog' aria-modal='true' aria-label={t('Admin navigation')}>
          <div className='absolute inset-0 bg-(--color-scrim) animate-fade' onClick={() => setOpen(false)} role='presentation' />
          <aside
            id='admin-mobile-drawer'
            className='absolute inset-y-0 start-0 flex w-[min(100vw-3rem,20rem)] flex-col border-e border-line bg-surface shadow-e3'
          >
            <div className='flex items-center justify-between gap-2 border-b border-line px-4 py-3'>
              <p className='font-display text-title text-ink'>{t('Menu')}</p>
              <IconButton label={t('Close')} variant='ghost' onClick={() => setOpen(false)}>
                <X aria-hidden='true' className='size-5' />
              </IconButton>
            </div>
            <nav className='flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]'>
              {sections.map((section) => (
                <div key={section.title}>
                  <p className='mb-1 px-2 text-caption font-semibold text-ink-3'>{section.title}</p>
                  <ul className='space-y-0.5'>
                    {section.links.map((link) => {
                      const isActive = active?.path === link.path
                      const LinkIcon = link.icon
                      return (
                        <li key={link.path}>
                          <NavLink
                            to={link.path}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => setOpen(false)}
                            className={`flex min-h-11 items-center gap-3 rounded-control px-3 text-body-sm font-medium ${
                              isActive ? 'bg-primary text-on-primary' : 'text-ink-2 hover:bg-surface-sunken'
                            }`}
                          >
                            <LinkIcon aria-hidden='true' className='size-4 shrink-0' />
                            <span className='truncate'>{link.label}</span>
                          </NavLink>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
        </div>,
        document.body
      )}
    </>
  )
}
