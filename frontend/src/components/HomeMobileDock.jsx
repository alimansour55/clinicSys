import React, { useContext } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, Home, Phone, Stethoscope } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'

const HomeMobileDock = () => {
  const { token } = useContext(AppContext)
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLanguage()

  const items = [
    { id: 'home', to: '/', icon: Home, label: 'HOME' },
    { id: 'doctors', to: '/doctors', icon: Stethoscope, label: 'ALL DOCTORS' },
    ...(token ? [{ id: 'appointments', to: '/my-appointments', icon: CalendarDays, label: 'My Appointments' }] : []),
    { id: 'contact', to: '/contact', icon: Phone, label: 'CONTACT' },
  ]

  const scrollHomeToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    document.getElementById('home-hero')?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }

  const handleNavigate = (to) => {
    if (to === '/') {
      if (location.pathname !== '/') {
        navigate('/')
        requestAnimationFrame(() => requestAnimationFrame(scrollHomeToTop))
      } else {
        scrollHomeToTop()
      }
      return
    }
    navigate(to)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  return (
    <nav
      aria-label={t('Home shortcuts')}
      className='mt-8 border-t border-gray-100 pt-6 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden'
    >
      <div className={`grid gap-2 ${items.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {items.map(({ id, to, icon: Icon, label }) => (
          <button
            key={id}
            type='button'
            onClick={() => handleNavigate(to)}
            className='flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-teal-100 bg-gradient-to-b from-white to-teal-50/40 px-2 py-3.5 text-center shadow-sm transition active:border-primary active:bg-teal-50'
          >
            <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary'>
              <Icon className='h-5 w-5' strokeWidth={2} />
            </span>
            <span className='text-[11px] font-semibold leading-tight text-gray-800'>{t(label)}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

export default HomeMobileDock
