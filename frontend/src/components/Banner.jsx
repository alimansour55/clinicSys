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
    <div
      className='mx-3 my-10 flex min-h-[280px] rounded-lg px-6 sm:mx-10 sm:min-h-[300px] sm:px-10 md:my-20 md:min-h-[340px] md:px-14 lg:min-h-[380px] lg:px-12'
      style={{ backgroundColor }}
    >
      <div className='flex min-h-0 flex-1 flex-col justify-center py-8 sm:py-10 md:py-14 lg:py-16 lg:pl-5'>
        <div className='flex min-h-[7.5rem] flex-col justify-center sm:min-h-[8.5rem] md:min-h-[10rem] lg:min-h-[12rem]'>
          <div className='text-xl font-semibold leading-[1.15] text-white sm:text-2xl md:text-3xl lg:text-5xl'>
            {titleLines.map((line, index) => (
              <p key={`${line}-${index}`} className={index > 0 ? 'mt-2 sm:mt-3 md:mt-4' : ''}>
                {t(line)}
              </p>
            ))}
          </div>
        </div>
        <div className='mt-4 flex min-h-[3.25rem] flex-shrink-0 flex-col gap-3 sm:mt-6 sm:flex-row'>
          {token && (
            <>
              {showAppointmentsButton && (
                <button
                  type='button'
                  onClick={() => {
                    navigate('/my-appointments')
                    scrollTo(0, 0)
                  }}
                  className='flex min-h-[2.75rem] flex-shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-medium text-gray-600 shadow-md transition-all hover:scale-105 sm:min-h-[3rem] sm:px-8 sm:py-3 sm:text-base'
                >
                  <CalendarDays className='h-4 w-4 shrink-0' />
                  {t(appointmentsButtonText)}
                </button>
              )}
              {showProfileButton && (
                <button
                  type='button'
                  onClick={() => {
                    navigate('/my-profile')
                    scrollTo(0, 0)
                  }}
                  className='flex min-h-[2.75rem] flex-shrink-0 items-center justify-center gap-2 rounded-full border border-white/70 px-5 py-2 text-xs font-medium text-white transition-all hover:bg-white hover:text-primary sm:min-h-[3rem] sm:px-8 sm:py-3 sm:text-base'
                >
                  <UserRound className='h-4 w-4 shrink-0' />
                  {t(profileButtonText)}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {showImage && (
        <div className='relative flex w-[50%] min-h-[200px] shrink-0 items-end justify-end sm:w-[45%] sm:min-h-[220px] md:w-1/2 md:min-h-[260px] lg:w-[370px] lg:min-h-[300px]'>
          <img
            className='absolute bottom-0 right-0 h-auto max-h-[240px] w-full max-w-[110px] object-contain sm:max-h-[260px] sm:max-w-[200px] md:max-h-[300px] md:max-w-md'
            src={bannerImage}
            alt=''
          />
        </div>
      )}
    </div>
  )
}

export default Banner
