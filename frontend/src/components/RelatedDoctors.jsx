import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'
import { RatingBadge } from './DoctorRating'
import PromoOfferBadge from './PromoOfferBadge'
import { isDoctorBookableForPatients, isDoctorComingSoon } from '../utils/doctorBooking'

const RelatedDoctors = ({speciality ,docId}) => {
  
  const { doctors, currencySymbol, t, tc, displayPersonName } = useContext(AppContext)
  const navigate = useNavigate()
  
  const [relDoc, setRelDocs] = useState([])

  useEffect(() => {
   if(doctors.length > 0 && speciality){
    const doctorsData = doctors.filter((doc) => doc.speciality === speciality && doc._id !== docId)
    setRelDocs(doctorsData)   
  }
  },[doctors,speciality,docId])

return (
    <div className='flex flex-col items-center gap-4 my-16 text-gray-800'>
      
      {/* Header */}
      <div className="max-w-6xl mx-auto text-center mb-6 md:mb-10 px-4">
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
          {t('Top Doctors to Book')}
        </h1>
        <p className="text-gray-600 text-xs sm:text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
          {t('Simply browse through our extensive list of trusted doctors')}
        </p>
      </div>

      {/* Doctors Grid */}
      <div className='w-full grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-5 gap-y-6 px-3 sm:px-0 max-w-6xl mx-auto'>
        {relDoc.slice(0,5).map((item,index) => (
            <button
              type="button"
              disabled={isDoctorComingSoon(item)}
              onClick={() => {
                navigate(`/appointment/${item._id}`)
                scrollTo(0, 0)
              }}
              className={`w-full border border-blue-200 rounded-xl overflow-hidden text-left transition-all duration-500 ${
                isDoctorComingSoon(item) ? 'cursor-default opacity-95' : 'cursor-pointer hover:translate-y-[-10px]'
              }`}
              key={index}
            >
                
              <div className='relative'>
                <img className='bg-blue-50 w-full h-40 sm:h-56 object-cover' src={item.image} alt="" />
                <RatingBadge summary={item.ratingSummary} className='absolute left-2 top-2' />
                <PromoOfferBadge doctor={item} currencySymbol={currencySymbol} className='absolute bottom-2 left-2' />
              </div>
               
               
               <div className='p-3 sm:p-4'>
                 
                 <div className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm ${isDoctorComingSoon(item) ? 'text-amber-600' : isDoctorBookableForPatients(item) ? 'text-green-500' : 'text-gray-500'}`}>
                    <p className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isDoctorComingSoon(item) ? 'bg-amber-500' : isDoctorBookableForPatients(item) ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <p>{isDoctorComingSoon(item) ? t('Coming Soon') : isDoctorBookableForPatients(item) ? t('Available') : t('Not Available')}</p>
                 </div>
                 
                 <p className='text-gray-900 text-sm sm:text-lg font-medium mt-2 line-clamp-2'>{displayPersonName(item.name)}</p>
                 
                 <p className='text-gray-600 text-xs sm:text-sm mt-1'>{tc(item.speciality)}</p>
               </div>
            </button>
        ))}
      </div>

      <button onClick={() => { navigate('/doctors'); scrollTo(0,0) }} className='bg-blue-50 text-gray-600 px-8 sm:px-12 py-2.5 sm:py-3 rounded-full mt-6 sm:mt-10 text-sm sm:text-base font-medium hover:bg-blue-100 transition-all '>
        {t('View More Doctors')}
      </button>
    </div>
  )
}

export default RelatedDoctors
