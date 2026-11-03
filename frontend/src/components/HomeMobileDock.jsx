import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Home, Phone, Stethoscope } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'

/** Large shortcuts at the end of the home page on phones, where the top menu is out of reach. */
const HomeMobileDock = () => {
  const { token } = useContext(AppContext)
  const { t } = useLanguage()

  const items = [
    { id: 'top', to: '/#home-hero', icon: Home, label: 'Back to top' },
    { id: 'doctors', to: '/doctors', icon: Stethoscope, label: 'nav.doctors' },
    ...(token ? [{ id: 'appointments', to: '/my-appointments', icon: CalendarDays, label: 'My Appointments' }] : []),
    { id: 'contact', to: '/contact', icon: Phone, label: 'nav.contact' },
  ]

  return (
    <nav aria-label={t('Home shortcuts')} className='mx-auto w-full max-w-7xl px-gutter pb-4 md:hidden'>
      <ul className={`grid gap-2 ${items.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {items.map(({ id, to, icon: Icon, label }) => (
          <li key={id}>
            <Link
              to={to}
              onClick={id === 'top' ? (event) => {
                event.preventDefault()
                window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
              } : undefined}
              className='flex h-full flex-col items-center justify-center gap-1.5 rounded-card border border-line bg-surface px-2 py-3.5 text-center shadow-e1 transition active:bg-primary-soft'
            >
              <span className='flex size-10 items-center justify-center rounded-control bg-primary-soft text-brand'>
                <Icon aria-hidden='true' className='size-5' />
              </span>
              <span className='text-caption font-semibold text-ink'>{t(label)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default HomeMobileDock
