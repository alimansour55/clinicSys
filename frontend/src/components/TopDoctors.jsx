import React, { useContext, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { RatingBadge } from './DoctorRating'
import PromoOfferBadge from './PromoOfferBadge'
import { MapPin } from 'lucide-react'
import { formatLocationLine } from '../utils/placeTranslations'
import { isDoctorBookableForPatients, isDoctorComingSoon } from '../utils/doctorBooking'

const sortDoctorsForTopSection = (list = []) =>
  [...list].sort((a, b) => {
    const completedA = Number(a.completedBookingsCount ?? 0)
    const completedB = Number(b.completedBookingsCount ?? 0)
    if (completedB !== completedA) return completedB - completedA
    const ratingA = Number(a.ratingSummary?.averageRating ?? 0)
    const ratingB = Number(b.ratingSummary?.averageRating ?? 0)
    if (ratingB !== ratingA) return ratingB - ratingA
    const countA = Number(a.ratingSummary?.ratingCount ?? 0)
    const countB = Number(b.ratingSummary?.ratingCount ?? 0)
    return countB - countA
  })

const TopDoctors = () => {

   const navigate = useNavigate()
   const { doctors, t, tc, currencySymbol, language, displayPersonName, placeTranslationOverrides } = useContext(AppContext)
   const topDoctors = useMemo(
     () => sortDoctorsForTopSection(doctors).slice(0, 4),
     [doctors]
   )
   const getDoctorLocationRaw = (doctor) => {
     const locations = doctor.locations?.length
       ? doctor.locations
       : (doctor.clinics || []).map((clinic) => clinic.name || clinic)
     return locations.filter(Boolean).join(', ') || [doctor.address?.line1, doctor.address?.line2].filter(Boolean).join(', ')
   }
   const getDoctorLocationDisplay = (doctor) => {
     const raw = getDoctorLocationRaw(doctor)
     return raw ? formatLocationLine(raw, language, t, placeTranslationOverrides) : t('Clinic location')
   }

  return (
    <section id='top-doctors' className='flex scroll-mt-28 flex-col items-center gap-3 py-10 sm:py-12 text-gray-800'>
      
      {/* Header */}
      <div className="max-w-6xl mx-auto text-center mb-5 md:mb-7 px-4">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2.5">
          {t('Top Doctors to Book')}
        </h1>
        <p className="text-gray-600 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
          {t('Simply browse through our extensive list of trusted doctors')}
        </p>
      </div>

      {/* Mobile: 2×2 (max 4). Desktop: up to 4 in a wider row */}
      <div className='mx-auto grid w-full max-w-lg grid-cols-2 gap-3 px-3 sm:max-w-3xl sm:gap-4 sm:px-0 lg:max-w-5xl lg:grid-cols-4'>
        {topDoctors.map((item) => (
            <button
              type='button'
              key={item._id}
              disabled={isDoctorComingSoon(item)}
              onClick={() => {
                if (isDoctorComingSoon(item)) return
                navigate(`/appointment/${item._id}`)
                scrollTo(0, 0)
              }}
              className='group min-h-0 overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition disabled:cursor-default disabled:opacity-95 hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg'
            >
               <div className='relative mx-2 mt-2 h-[120px] overflow-hidden rounded-lg bg-blue-50 sm:mx-3 sm:mt-3 sm:h-[146px]'>
                 <img className='h-full w-full object-cover transition duration-300 group-hover:scale-105' src={item.image} alt="" />
                 <RatingBadge summary={item.ratingSummary} className='absolute left-2 top-2' />
                 <PromoOfferBadge doctor={item} currencySymbol={currencySymbol} className='absolute bottom-2 left-2' />
               </div>
              
               <div className='px-2.5 py-2 sm:px-3 sm:py-2.5'>
                <div className={`flex items-center gap-1.5 text-xs ${isDoctorComingSoon(item) ? 'text-amber-600' : isDoctorBookableForPatients(item) ? 'text-green-500' : 'text-gray-500'}`}>
                  <p className={`h-1.5 w-1.5 rounded-full ${isDoctorComingSoon(item) ? 'bg-amber-500' : isDoctorBookableForPatients(item) ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <p>{isDoctorComingSoon(item) ? t('Coming Soon') : isDoctorBookableForPatients(item) ? t('Available') : t('Not Available')}</p>
                </div>
                 <p className='truncate text-sm font-bold text-gray-800 mt-1.5'>{displayPersonName(item.name)}</p>
                 <p className='mt-1 truncate text-sm text-gray-600'>{tc(item.speciality)}</p>
                 <p className='mt-2 flex items-center gap-1.5 truncate text-sm text-gray-600'>
                   <MapPin className='h-4 w-4 shrink-0 text-blue-500' />
                   <span className='truncate'>{getDoctorLocationDisplay(item)}</span>
                 </p>
               </div>
            </button>
        ))}
      </div>

      {/* Responsive Button */}
      <button
        type='button'
        onClick={() => { navigate('/doctors'); scrollTo(0, 0) }}
        className='mt-5 rounded-full bg-blue-50 px-8 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-blue-100 sm:mt-8 sm:px-12 sm:py-3 sm:text-base'
      >
        {t('View More Doctors')}
      </button>
    </section>
  )
}

export default TopDoctors
