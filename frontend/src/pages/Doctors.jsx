import React, { useContext, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { specialityData } from '../assets/assets'
import { MapPin, Search, X } from 'lucide-react'
import { RatingBadge } from '../components/DoctorRating'

const defaultClinicNames = [
  'General physician',
  'Gynecologist',
  'Dermatologist',
  'Pediatricians',
  'Neurologist',
  'Gastroenterologist'
]

const Doctors = () => {
  const { speciality } = useParams()
  const [searchParams] = useSearchParams()
  const [showFilter, setShowFilter] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  const { token, doctors, clinics } = useContext(AppContext)

  const specialityFilters = useMemo(() => specialityData.map((item) => item.speciality), [])
  const clinicFilters = useMemo(() => {
    const names = clinics.length > 0 ? clinics.map((clinic) => clinic.name) : defaultClinicNames
    return [...new Set(names.filter(Boolean))]
  }, [clinics])

  const consultationMode = searchParams.get('consultation')
  const teleconsultationMode = consultationMode === 'tele'
  const homeVisitMode = consultationMode === 'home'
  const selectedSpeciality = specialityFilters.includes(speciality) ? speciality : ''
  const selectedClinic = searchParams.get('clinic') || (!selectedSpeciality ? speciality || '' : '')

  const buildDoctorPath = (nextSpeciality = selectedSpeciality, nextClinic = selectedClinic) => {
    const path = nextSpeciality ? `/doctors/${encodeURIComponent(nextSpeciality)}` : '/doctors'
    const params = new URLSearchParams()
    if (nextClinic) params.set('clinic', nextClinic)
    if (teleconsultationMode) params.set('consultation', 'tele')
    if (homeVisitMode) params.set('consultation', 'home')
    const query = params.toString() ? `?${params.toString()}` : ''
    return `${path}${query}`
  }

  const filterDoc = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    return doctors.filter((doc) => {
      const doctorClinics = (doc.clinics || []).map((clinic) => clinic.name || clinic)
      const matchesSpeciality = selectedSpeciality ? doc.speciality === selectedSpeciality : true
      const matchesClinic = selectedClinic ? doctorClinics.includes(selectedClinic) : true
      const matchesSearch = search
        ? [doc.name, doc.speciality, ...doctorClinics].some((value) => String(value || '').toLowerCase().includes(search))
        : true

      return matchesSpeciality && matchesClinic && matchesSearch
    })
  }, [doctors, selectedSpeciality, selectedClinic, searchTerm])

  const handleSpecialityFilter = (specialityName) => {
    navigate(buildDoctorPath(selectedSpeciality === specialityName ? '' : specialityName, selectedClinic))
  }

  const handleClinicFilter = (clinicName) => {
    navigate(buildDoctorPath(selectedSpeciality, selectedClinic === clinicName ? '' : clinicName))
  }

  const clearFilters = () => {
    setSearchTerm('')
    navigate(consultationMode ? `/doctors?consultation=${consultationMode}` : '/doctors')
  }

  const getDoctorLocation = (doctor) => {
    const locations = doctor.locations?.length
      ? doctor.locations
      : (doctor.clinics || []).map((clinic) => clinic.name || clinic)
    return locations.filter(Boolean).join(', ') || [doctor.address?.line1, doctor.address?.line2].filter(Boolean).join(', ')
  }

  return (
    <div>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6'>
        <div>
          <h1 className='text-xl sm:text-2xl font-bold text-gray-900'>{teleconsultationMode ? 'Book a Teleconsultation' : homeVisitMode ? 'Book a Home Visit' : 'Find Your Doctor'}</h1>
          <p className='text-sm sm:text-base text-gray-600 mt-1'>{teleconsultationMode ? 'Choose any doctor, then select voice or video call on the booking page' : homeVisitMode ? 'Choose any doctor, then add a supported Cairo or Giza visit address' : 'Browse doctors by speciality, clinic, or name'}</p>
        </div>

        {token && (
          <button
            onClick={() => navigate('/my-appointments')}
            className='w-full sm:w-auto bg-primary text-white px-6 py-3 rounded-lg sm:rounded-full font-medium cursor-pointer hover:bg-primary-dark transition shadow-md hover:shadow-lg text-sm sm:text-base whitespace-nowrap'
          >
            View My Appointments
          </button>
        )}
      </div>

      <div className='relative mb-5'>
        <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className='w-full border border-gray-300 rounded-lg py-3 pl-10 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10'
          placeholder='Search doctors, specialities, or clinics'
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700'
            aria-label='Clear search'
          >
            <X className='w-4 h-4' />
          </button>
        )}
      </div>

      <div className='flex flex-col sm:flex-row items-start gap-5 mt-5'>
        <button
          className={`py-2 px-4 border rounded text-sm transition-all sm:hidden ${showFilter ? 'bg-primary text-white' : ''}`}
          onClick={() => setShowFilter((prev) => !prev)}
        >
          {showFilter ? 'Close Filters' : 'Filters'}
        </button>

        <div className={`w-full sm:w-64 flex-col gap-5 text-sm text-gray-600 ${showFilter ? 'flex' : 'hidden sm:flex'}`}>
          <div>
            <div className='flex items-center justify-between mb-2'>
              <p className='font-semibold text-gray-900'>Speciality</p>
              {(selectedSpeciality || selectedClinic || searchTerm) && (
                <button onClick={clearFilters} className='text-xs text-primary hover:underline'>Clear</button>
              )}
            </div>
            <div className='flex flex-col gap-2'>
              {specialityFilters.map((specialityName) => (
                <button
                  key={specialityName}
                  onClick={() => handleSpecialityFilter(specialityName)}
                  className={`w-full text-left pl-3 py-2 pr-4 border border-gray-300 rounded transition-all cursor-pointer ${selectedSpeciality === specialityName ? 'bg-indigo-100 text-black' : 'hover:bg-gray-50'}`}
                >
                  {specialityName}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className='font-semibold text-gray-900 mb-2'>Clinic</p>
            <div className='flex flex-col gap-2'>
              {clinicFilters.map((clinicName) => (
                <button
                  key={clinicName}
                  onClick={() => handleClinicFilter(clinicName)}
                  className={`w-full text-left pl-3 py-2 pr-4 border border-gray-300 rounded transition-all cursor-pointer ${selectedClinic === clinicName ? 'bg-indigo-100 text-black' : 'hover:bg-gray-50'}`}
                >
                  {clinicName}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className='w-full grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          {filterDoc.length > 0 ? filterDoc.map((item, index) => (
            <div
              onClick={() => navigate(`/appointment/${item._id}${consultationMode ? `?consultation=${consultationMode}` : ''}`)}
              className='border border-blue-200 rounded-xl overflow-hidden cursor-pointer hover:translate-y-[-10px] transition-all duration-500'
              key={index}
            >
              <div className='relative'>
                <img className='bg-blue-50 w-full h-40 sm:h-56 object-cover' src={item.image} alt='' />
                <RatingBadge summary={item.ratingSummary} className='absolute left-2 top-2' />
              </div>

              <div className='p-3 sm:p-4'>
                <div className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm ${item.available ? 'text-green-500' : 'text-gray-500'} `}>
                  <p className={`w-1.5 h-1.5 sm:w-2 sm:h-2 ${item.available ? 'bg-green-500' : 'bg-gray-500'} rounded-full`}></p>
                  <p>{item.available ? 'Available' : 'Not Available'}</p>
                </div>
                <p className='text-gray-900 text-sm sm:text-lg font-medium mt-2 line-clamp-2'>{item.name}</p>
                <p className='text-gray-600 text-xs sm:text-sm mt-1'>{item.speciality}</p>
                <p className='mt-2 flex items-center gap-1.5 text-gray-500 text-xs line-clamp-1'>
                  <MapPin className='h-3.5 w-3.5 shrink-0 text-blue-500' />
                  <span className='truncate'>{getDoctorLocation(item) || 'Clinic location'}</span>
                </p>
              </div>
            </div>
          )) : (
            <div className='col-span-full text-center py-12 border border-dashed border-gray-300 rounded-lg text-gray-500'>
              No doctors match these filters
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Doctors
