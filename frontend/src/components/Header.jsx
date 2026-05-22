import React, { useContext } from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { CalendarDays } from 'lucide-react'

const Header = () => {
  const navigate = useNavigate()
  const { token, t, siteSettings } = useContext(AppContext)
  const hero = siteSettings?.homeHero || {}
  const title = hero.title || 'Book Appointment With Trusted Doctors'
  const subtitle = hero.subtitle || 'Simply browse through our extensive list of trusted doctors, schedule your appointment hassle-free.'
  const heroImage = hero.heroImage || assets.header_img
  const groupImage = hero.groupImage || assets.group_profiles
  const backgroundColor = hero.backgroundColor || '#169b8a'
  const showGroupImage = hero.showGroupImage !== false
  const showBookButton = hero.showBookButton !== false
  const showAppointmentsButton = hero.showAppointmentsButton !== false
  const bookButtonText = hero.bookButtonText || 'Book appointment'
  const appointmentsButtonText = hero.appointmentsButtonText || 'My appointments'

  return (
    <div
      className='relative z-0 mt-2 flex flex-col overflow-hidden rounded-lg md:flex-row md:flex-wrap'
      style={{ backgroundColor }}
    >
      <div className='flex w-full flex-col items-start justify-center gap-4 px-6 py-10 md:w-1/2 md:py-[10vw] md:pb-8'>
        <p className='text-3xl font-semibold leading-tight text-white md:text-4xl lg:text-5xl'>
          {t(title)}
        </p>
        <div className='flex flex-col items-start gap-3 text-sm font-medium text-white md:flex-row'>
          {showGroupImage && <img className='w-28' src={groupImage} alt='' />}
          <p>{t(subtitle)}</p>
        </div>
        <div className='flex w-full flex-col gap-3 sm:flex-row'>
          {showBookButton && (
            <button
              type='button'
              onClick={() => navigate('/doctors')}
              className='flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-gray-600 shadow-md transition hover:scale-105'
            >
              {t(bookButtonText)}
              <img className='h-3 w-3' src={assets.arrow_icon} alt='' />
            </button>
          )}
          {token && showAppointmentsButton && (
            <button
              type='button'
              onClick={() => navigate('/my-appointments')}
              className='flex items-center justify-center gap-2 rounded-full border border-white/50 bg-primary-dark/20 px-8 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-primary'
            >
              <CalendarDays className='h-4 w-4' />
              {t(appointmentsButtonText)}
            </button>
          )}
        </div>
      </div>

      <div className='relative flex min-h-[220px] w-full items-end justify-center md:min-h-0 md:w-1/2'>
        <img
          className='h-auto w-full max-h-[min(380px,45vh)] object-contain object-bottom md:max-h-[min(420px,50vh)] md:rounded-lg'
          src={heroImage}
          alt=''
        />
      </div>
    </div>
  )
}

export default Header
