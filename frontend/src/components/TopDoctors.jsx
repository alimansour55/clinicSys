import React, { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { RatingBadge } from './DoctorRating'
import { MapPin } from 'lucide-react'

const TopDoctors = () => {

   const navigate = useNavigate()
   const { doctors, t, tc } = useContext(AppContext)
   const getDoctorLocation = (doctor) => {
     const locations = doctor.locations?.length
       ? doctor.locations
       : (doctor.clinics || []).map((clinic) => clinic.name || clinic)
     return locations.filter(Boolean).join(', ') || [doctor.address?.line1, doctor.address?.line2].filter(Boolean).join(', ')
   }

  return (
    <div className='flex flex-col items-center gap-4 py-16 text-gray-800'>
      
      {/* Header */}
      <div className="max-w-6xl mx-auto text-center mb-6 md:mb-10 px-4">
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
          {t('Top Doctors to Book')}
        </h1>
        <p className="text-gray-600 text-xs sm:text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
          {t('Simply browse through our extensive list of trusted doctors')}
        </p>
      </div>

      {/* Doctors Grid  */}
      <div className='w-full grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 gap-y-6 px-3 sm:px-0 max-w-6xl mx-auto'>
        {doctors.slice(0,8).map((item,index) => (
            <div 
              onClick={() => {navigate(`/appointment/${item._id}`); scrollTo(0, 0);}} 
              className='border border-blue-200 rounded-xl overflow-hidden cursor-pointer hover:translate-y-[-10px] transition-all duration-500' 
              key={index}
            >
               <div className='relative'>
                 <img className='bg-blue-50 w-full h-40 sm:h-56 object-cover' src={item.image} alt="" />
                 <RatingBadge summary={item.ratingSummary} className='absolute left-2 top-2' />
               </div>
              
               <div className='p-3 sm:p-4'>
                <div className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm ${item.available ? 'text-green-500' : 'text-gray-500'}`}>
                  <p className={`w-1.5 h-1.5 sm:w-2 sm:h-2 ${item.available ? 'bg-green-500' : 'bg-gray-500'} rounded-full`}></p>
                  <p>{item.available ? t('Available') : t('Not Available')}</p>
                </div>
                 <p className='text-gray-900 text-sm sm:text-lg font-medium mt-2 line-clamp-2'>{item.name}</p>
                 <p className='text-gray-600 text-xs sm:text-sm mt-1'>{tc(item.speciality)}</p>
                 <p className='mt-2 flex items-center gap-1.5 text-gray-500 text-xs sm:text-sm line-clamp-1'>
                   <MapPin className='h-3.5 w-3.5 shrink-0 text-blue-500' />
                   <span className='truncate'>{getDoctorLocation(item) || 'Clinic location'}</span>
                 </p>
               </div>
            </div>   
        ))}
      </div>

      {/* Responsive Button */}
      <button 
        onClick={() => { navigate('/doctors'); scrollTo(0,0) }} 
        className='bg-blue-50 text-gray-600 px-8 sm:px-12 py-2.5 sm:py-3 rounded-full mt-6 sm:mt-10 text-sm sm:text-base font-medium hover:bg-blue-100 transition-all cursor-pointer'
      >
        {t('View More Doctors')}
      </button>
    </div>
  )
}

export default TopDoctors
