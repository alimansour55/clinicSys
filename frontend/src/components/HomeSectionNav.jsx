import React from 'react'
import { useLanguage } from '../i18n'

const SECTIONS = [
  { id: 'speciality', labelKey: 'Clinic sections' },
  { id: 'top-doctors', labelKey: 'Top doctors' },
  { id: 'home-banner', labelKey: 'Offers' },
]

const HomeSectionNav = () => {
  const { t } = useLanguage()

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav
      aria-label={t('Quick links')}
      className='sticky top-[3.5rem] z-40 -mx-4 border-b border-gray-100 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur-sm sm:-mx-[10%] sm:px-[10%] md:hidden'
    >
      <p className='mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400'>{t('Quick links')}</p>
      <div className='flex flex-wrap gap-2'>
        {SECTIONS.map(({ id, labelKey }) => (
          <button
            key={id}
            type='button'
            onClick={() => scrollTo(id)}
            className='rounded-full border border-teal-100 bg-teal-50/80 px-3.5 py-1.5 text-xs font-semibold text-primary transition active:bg-primary active:text-white'
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </nav>
  )
}

export default HomeSectionNav
