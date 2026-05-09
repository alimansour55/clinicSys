import React, { useContext } from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { CalendarDays, UserRound } from 'lucide-react'

const Banner = () => {

   const navigate = useNavigate()
   const { token, t } = useContext(AppContext)

  return (
    <div className='flex bg-primary rounded-lg px-6 sm:px-10 md:px-14 lg:px-12 my-10 md:my-20 mx-3 md:mx-10'>
      
      {/* -------- Left Side -------- */}
      <div className='flex-1 py-8 sm:py-10 md:py-16 lg:py-24 lg:pl-5'>
        <div className='text-s sm:text-2xl md:text-3xl lg:text-5xl font-semibold text-white leading-tight'>
            <p>{t('Book Appointment')}</p>
            <p className='mt-2 sm:mt-4'>{t('With 100+ Trusted Doctors')}</p>
        </div>
        <div className='flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6'>
          {token ? (
            <>
              <button 
                onClick={() => {navigate('/my-appointments'); scrollTo(0,0)}} 
                className='flex items-center justify-center gap-2 bg-white text-xs sm:text-base text-gray-600 px-5 sm:px-8 py-2 sm:py-3 rounded-full cursor-pointer hover:scale-105 transition-all duration-300 font-medium shadow-md active:scale-95'
              >
                <CalendarDays className='w-4 h-4' />
                {t('My appointments')}
              </button>
              <button 
                onClick={() => {navigate('/my-profile'); scrollTo(0,0)}} 
                className='flex items-center justify-center gap-2 border border-white/70 text-xs sm:text-base text-white px-5 sm:px-8 py-2 sm:py-3 rounded-full cursor-pointer hover:bg-white hover:text-primary transition-all duration-300 font-medium active:scale-95'
              >
                <UserRound className='w-4 h-4' />
                {t('My profile')}
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => {navigate('/login?mode=login'); scrollTo(0,0)}} 
                className='bg-white text-xs sm:text-base text-gray-600 px-5 sm:px-8 py-2 sm:py-3 rounded-full cursor-pointer hover:scale-105 transition-all duration-300 font-medium shadow-md active:scale-95'
              >
                {t('Sign in')}
              </button>
              <button 
                onClick={() => {navigate('/login?mode=signup'); scrollTo(0,0)}} 
                className='border border-white/70 text-xs sm:text-base text-white px-5 sm:px-8 py-2 sm:py-3 rounded-full cursor-pointer hover:bg-white hover:text-primary transition-all duration-300 font-medium active:scale-95'
              >
                {t('Create account')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* -------- Right Side -------- */}
      <div className='w-[50%] sm:w-[45%] md:w-1/2 lg:w-[370px] relative'>
        <img 
          className='w-full absolute bottom-0 right-0 max-w-[110px] xs:max-w-[240px] sm:max-w-[200px] md:max-w-md' src={assets.appointment_img} alt="" />
      </div>

    </div>
  )
}

export default Banner
