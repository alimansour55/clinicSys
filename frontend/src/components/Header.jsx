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
    <div className='flex flex-col md:flex-row flex-wrap rounded-lg px-6 md:px-10 lg:px-20' style={{ backgroundColor }}>
      
      {/* -------- Left Side -------- */}
      <div className='md:w-1/2 flex flex-col items-start justify-center gap-4 py-10 m-auto md:py-[10vw] md:mb-[-30px]'>
         <p className='text-3xl md:text-4xl lg:text-5xl text-white font-semibold leading-tight md:leading-tight lg:leading-tight'>
            {t(title)}
         </p>
         <div className='flex flex-col md:flex-row items-center gap-3 text-white text-sm font-semi' >
            {showGroupImage && <img className='w-28' src={groupImage} alt="" />}
            <p>{t(subtitle)}</p>
         </div>
         <div className='flex flex-col sm:flex-row gap-3 w-full sm:w-auto'>
           {showBookButton && (
            <button onClick={() => navigate('/doctors')} className='flex items-center justify-center gap-2 bg-white px-8 py-3 rounded-full text-gray-600 text-sm m-auto md:m-0 hover:scale-105 transition-all duration-300 cursor-pointer'>
              {t(bookButtonText)} <img  className='w-3' src={assets.arrow_icon} alt="" />
            </button>
           )}
           {token && showAppointmentsButton && (
            <button onClick={() => navigate('/my-appointments')} className='flex items-center justify-center gap-2 bg-primary-dark/20 border border-white/50 px-8 py-3 rounded-full text-white text-sm m-auto md:m-0 hover:bg-white hover:text-primary transition-all duration-300 cursor-pointer'>
              <CalendarDays className='w-4 h-4' />
              {t(appointmentsButtonText)}
            </button>
           )}
         </div>
      </div>


      {/* -------- Right Side -------- */}
      <div className='md:w-1/2 relative'>
         <img className='w-full md:absolute bottom-0 h-auto rounded-lg' src={heroImage} alt="" />
      </div>
    </div>
  )
}

export default Header
