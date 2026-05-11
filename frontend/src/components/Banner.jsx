import React, { useContext } from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { CalendarDays, UserRound } from 'lucide-react'

const Banner = () => {

   const navigate = useNavigate()
   const { token, t, siteSettings } = useContext(AppContext)
   const banner = siteSettings?.homeBanner || {}
   const title = banner.title || [banner.titleLineOne, banner.titleLineTwo].filter(Boolean).join('\n') || 'Book Appointment\nWith 100+ Trusted Doctors'
   const titleLines = title.split('\n').filter(Boolean)
   const bannerImage = banner.bannerImage || assets.appointment_img
   const backgroundColor = banner.backgroundColor || '#169b8a'
   const showImage = banner.showImage !== false
   const showAppointmentsButton = banner.showAppointmentsButton !== false
   const appointmentsButtonText = banner.appointmentsButtonText || 'My appointments'
   const showProfileButton = banner.showProfileButton !== false
   const profileButtonText = banner.profileButtonText || 'My profile'

  return (
    <div className='flex rounded-lg px-6 sm:px-10 md:px-14 lg:px-12 my-10 md:my-20 mx-3 md:mx-10' style={{ backgroundColor }}>
      
      {/* -------- Left Side -------- */}
      <div className='flex-1 py-8 sm:py-10 md:py-16 lg:py-24 lg:pl-5'>
        <div className='text-s sm:text-2xl md:text-3xl lg:text-5xl font-semibold text-white leading-tight'>
            {titleLines.map((line, index) => (
              <p key={`${line}-${index}`} className={index > 0 ? 'mt-2 sm:mt-4' : ''}>{t(line)}</p>
            ))}
        </div>
        <div className='flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6'>
          {token && (
            <>
              {showAppointmentsButton && <button 
                onClick={() => {navigate('/my-appointments'); scrollTo(0,0)}} 
                className='flex items-center justify-center gap-2 bg-white text-xs sm:text-base text-gray-600 px-5 sm:px-8 py-2 sm:py-3 rounded-full cursor-pointer hover:scale-105 transition-all duration-300 font-medium shadow-md active:scale-95'
              >
                <CalendarDays className='w-4 h-4' />
                {t(appointmentsButtonText)}
              </button>}
              {showProfileButton && <button 
                onClick={() => {navigate('/my-profile'); scrollTo(0,0)}} 
                className='flex items-center justify-center gap-2 border border-white/70 text-xs sm:text-base text-white px-5 sm:px-8 py-2 sm:py-3 rounded-full cursor-pointer hover:bg-white hover:text-primary transition-all duration-300 font-medium active:scale-95'
              >
                <UserRound className='w-4 h-4' />
                {t(profileButtonText)}
              </button>}
            </>
          )}
        </div>
      </div>

      {/* -------- Right Side -------- */}
      {showImage && <div className='w-[50%] sm:w-[45%] md:w-1/2 lg:w-[370px] relative'>
        <img 
          className='w-full absolute bottom-0 right-0 max-w-[110px] xs:max-w-[240px] sm:max-w-[200px] md:max-w-md' src={bannerImage} alt="" />
      </div>}

    </div>
  )
}

export default Banner
