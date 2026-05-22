import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { specialityData } from '../assets/assets'
import { ArrowUpDown, CheckCircle2, CreditCard, Filter, MapPin, Phone, Search, Stethoscope, Video, X } from 'lucide-react'
import { RatingBadge } from '../components/DoctorRating'
import PromoOfferBadge from '../components/PromoOfferBadge'
import { buildDoctorSlots } from '../utils/schedule'
import { getPromoOfferLabel } from '../utils/promo'
import { formatLocationLine } from '../utils/placeTranslations'
import { isDoctorBookableForPatients, isDoctorComingSoon, resolveClinicLocationForSlots } from '../utils/doctorBooking'
import { doctorBelongsToClinicSection } from '../utils/doctorClinicPlaces'

const Doctors = () => {
  const { speciality } = useParams()
  const [searchParams] = useSearchParams()
  const [showFilter, setShowFilter] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('recommended')
  const [selectedTitle, setSelectedTitle] = useState('')
  const [selectedGender, setSelectedGender] = useState('')
  const [selectedPayment, setSelectedPayment] = useState('')
  const navigate = useNavigate()

  const { token, doctors, getDoctorsData, t, tc, currencySymbol, displayPersonName, language, placeTranslationOverrides, localizeDigits } = useContext(AppContext)

  useEffect(() => {
    getDoctorsData()
  }, [])

  const fillT = (key, vars = {}) => {
    let s = String(t(key))
    Object.entries(vars).forEach(([k, v]) => {
      s = s.split(`{{${k}}}`).join(String(v))
    })
    return s
  }
  const placeKey = (value) => String(value || '').trim().toLowerCase()

  const specialityFilters = useMemo(() => specialityData.map((item) => item.speciality), [])
  const specialitySet = useMemo(() => new Set(specialityFilters), [specialityFilters])
  const locationFilters = useMemo(() => {
    const locationNames = doctors.flatMap((doctor) => doctor.locations || [])
    return [...new Set(locationNames.map((name) => String(name || '').trim()).filter(Boolean))]
      .filter((name) => !specialitySet.has(name))
      .sort((a, b) => a.localeCompare(b))
  }, [doctors, specialitySet])

  const consultationMode = searchParams.get('consultation')
  const teleconsultationMode = consultationMode === 'tele'
  const voiceCallMode = consultationMode === 'voice'
  const homeVisitMode = consultationMode === 'home'
  const selectedSpeciality = specialityFilters.includes(speciality) ? speciality : ''
  const selectedClinic = searchParams.get('clinic') || (!selectedSpeciality ? speciality || '' : '')

  const hasHomeVisitAvailability = (doctor) => {
    const areas = Array.isArray(doctor?.homeVisitAreas) ? doctor.homeVisitAreas : []
    const schedule = doctor?.homeVisitSchedule || {}
    return Boolean(
      doctor?.available &&
      Array.isArray(schedule.workingDays) &&
      schedule.workingDays.length > 0 &&
      areas.length > 0
    )
  }

  const hasClinicAvailability = (doctor) => isDoctorBookableForPatients(doctor)

  const getAppointmentTypeForMode = () => {
    if (homeVisitMode) return 'Home Visit'
    if (voiceCallMode) return 'Voice Call'
    if (teleconsultationMode) return 'Video Call'
    return 'Clinic'
  }

  const hasBookableSlot = (doctor) => {
    const appointmentType = getAppointmentTypeForMode()
    const clinicLocation = appointmentType === 'Home Visit' ? '' : resolveClinicLocationForSlots(doctor, selectedClinic)
    return buildDoctorSlots(doctor, 31, appointmentType, clinicLocation).some((day) => day.slots.some((slot) => slot.available))
  }

  const buildDoctorPath = (nextSpeciality = selectedSpeciality, nextClinic = selectedClinic) => {
    const path = nextSpeciality ? `/doctors/${encodeURIComponent(nextSpeciality)}` : '/doctors'
    const params = new URLSearchParams()
    if (nextClinic) params.set('clinic', nextClinic)
    if (voiceCallMode) params.set('consultation', 'voice')
    if (teleconsultationMode) params.set('consultation', 'tele')
    if (homeVisitMode) params.set('consultation', 'home')
    const query = params.toString() ? `?${params.toString()}` : ''
    return `${path}${query}`
  }

  const search = searchTerm.trim().toLowerCase()
  const filterDoc = doctors
    .filter((doc) => {
    const doctorClinics = (doc.clinics || []).map((clinic) => clinic.name || clinic)
    const doctorLocations = doc.locations || []
    const doctorPlaces = [...doctorClinics, ...doctorLocations]
    const matchesSpeciality = selectedSpeciality
      ? doctorBelongsToClinicSection(doc, selectedSpeciality)
      : true
    const matchesLocation = selectedClinic ? doctorBelongsToClinicSection(doc, selectedClinic) : true
    const matchesConsultationMode = homeVisitMode
      ? hasHomeVisitAvailability(doc)
      : voiceCallMode
        ? doc.available && doc.acceptsVoiceCall !== false && hasClinicAvailability(doc)
        : teleconsultationMode
          ? doc.available && doc.acceptsVideoCall !== false && hasClinicAvailability(doc)
          : true
    const matchesTitle = selectedTitle ? doc.title === selectedTitle : true
    const matchesGender = selectedGender ? doc.gender === selectedGender : true
    const matchesPayment = selectedPayment === 'Cash'
      ? doc.acceptsCash !== false
      : selectedPayment === 'Visa'
        ? doc.acceptsOnlinePayment !== false
        : true
    const matchesSearch = search
      ? [doc.name, doc.speciality, ...doctorPlaces].some((value) => String(value || '').toLowerCase().includes(search))
      : true

    return matchesSpeciality && matchesLocation && matchesConsultationMode && matchesTitle && matchesGender && matchesPayment && matchesSearch
  })
    .sort((a, b) => {
    if (sortBy === 'rating') return (b.ratingSummary?.averageRating || 0) - (a.ratingSummary?.averageRating || 0)
    const bookableDelta = Number(isDoctorBookableForPatients(b)) - Number(isDoctorBookableForPatients(a))
    if (bookableDelta !== 0) return bookableDelta
    return Number(hasBookableSlot(b)) - Number(hasBookableSlot(a))
  })

  const handleSpecialityFilter = (specialityName) => {
    navigate(buildDoctorPath(selectedSpeciality === specialityName ? '' : specialityName, selectedClinic))
  }

  const handleLocationFilter = (locationName) => {
    navigate(buildDoctorPath(selectedSpeciality, selectedClinic === locationName ? '' : locationName))
  }

  const handleAllDoctorsFilter = () => {
    setSearchTerm('')
    setSortBy('recommended')
    setSelectedTitle('')
    setSelectedGender('')
    setSelectedPayment('')
    navigate('/doctors')
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSortBy('recommended')
    setSelectedTitle('')
    setSelectedGender('')
    setSelectedPayment('')
    navigate(consultationMode ? `/doctors?consultation=${consultationMode}` : '/doctors')
  }

  const updateConsultationMode = (mode) => {
    const params = new URLSearchParams(searchParams)

    if (mode === 'clinic') {
      params.delete('consultation')
    } else {
      params.set('consultation', mode)
    }

    const path = selectedSpeciality ? `/doctors/${encodeURIComponent(selectedSpeciality)}` : '/doctors'
    const query = params.toString() ? `?${params.toString()}` : ''
    navigate(`${path}${query}`)
  }

  const getDoctorLocation = (doctor) => {
    const locations = doctor.locations?.length
      ? doctor.locations
      : (doctor.clinics || []).map((clinic) => clinic.name || clinic)
    return locations.filter(Boolean).join(', ')
  }

  const getDoctorLocations = (doctor) => {
    const locations = doctor.locations?.length
      ? doctor.locations
      : (doctor.clinics || []).map((clinic) => clinic.name || clinic)
    return locations.filter(Boolean)
  }

  const getWeeklyAvailabilityLabel = (doctor, location) => {
    if (isDoctorComingSoon(doctor)) return t('Coming Soon')
    const slots = buildDoctorSlots(doctor, 7, 'Clinic', location)
    const count = slots.reduce((sum, day) => sum + day.slots.filter((slot) => slot.available).length, 0)
    return count > 0 ? fillT('{{count}} slots this week', { count }) : t('No branch slots this week')
  }

  const activeFilterCount = [selectedSpeciality, selectedClinic, searchTerm, selectedTitle, selectedGender, selectedPayment].filter(Boolean).length
  const isAllDoctorsSelected = activeFilterCount === 0 && !consultationMode
  const titleFilters = ['Professor', 'Lecturer', 'Consultant', 'Specialist']
  const genderFilters = ['Female', 'Male']
  const consultationOptions = [
    { key: 'clinic', label: t('Clinic visit'), icon: Stethoscope },
    { key: 'voice', label: t('Voice call'), icon: Phone },
    { key: 'tele', label: t('Video call'), icon: Video },
    { key: 'home', label: t('Home visit'), icon: MapPin },
  ]

  return (
    <div className='pb-8'>
      <section className='mb-6 overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-blue-50 px-5 py-6 sm:px-7'>
        <div className='flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
          <div className='max-w-2xl'>
            <p className='mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm'>
              <CheckCircle2 className='h-3.5 w-3.5' />
              {fillT('{{count}} doctors ready to review', { count: filterDoc.length })}
            </p>
            <h1 className='text-2xl font-bold text-gray-950 sm:text-3xl'>
              {teleconsultationMode ? t('Book a Video Call') : voiceCallMode ? t('Book a Voice Call') : homeVisitMode ? t('Book a Home Visit') : t('Find Your Doctor')}
            </h1>
            <p className='mt-2 text-sm leading-6 text-gray-600 sm:text-base'>
              {teleconsultationMode
                ? t('Doctors page subtitle video')
                : voiceCallMode
                  ? t('Doctors page subtitle voice')
                  : homeVisitMode
                    ? t('Doctors page subtitle home')
                    : t('Doctors page subtitle default')}
            </p>
          </div>

          <div className='flex w-full flex-col gap-3 sm:w-auto sm:flex-row'>
            {token && (
              <button
                onClick={() => navigate('/my-appointments')}
                className='rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark'
              >
                {t('View My Appointments')}
              </button>
            )}
            <button
              onClick={clearFilters}
              className='rounded-full border border-teal-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-primary hover:text-primary'
            >
              {t('Reset filters')}
            </button>
          </div>
        </div>
      </section>

      <div className='mb-5 grid gap-3 lg:grid-cols-[1fr_auto]'>
        <div className='relative'>
          <Search className='absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className='h-12 w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-11 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10'
            placeholder={t('Search doctors, specialities, clinics, or locations')}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className='absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700'
              aria-label={t('Clear search')}
            >
              <X className='h-4 w-4' />
            </button>
          )}
        </div>

        <div className='flex gap-2 overflow-x-auto pb-1 lg:pb-0'>
          {consultationOptions.map(({ key, label, icon: Icon }) => {
            const selected = (key === 'clinic' && !consultationMode) || consultationMode === key

            return (
              <button
                key={key}
                onClick={() => updateConsultationMode(key)}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  selected
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-primary/50 hover:text-primary'
                }`}
              >
                {React.createElement(Icon, { className: 'h-4 w-4' })}
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className='flex flex-col gap-5 lg:flex-row lg:items-start'>
        <button
          className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition lg:hidden ${showFilter ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-gray-700'}`}
          onClick={() => setShowFilter((prev) => !prev)}
        >
          <Filter className='h-4 w-4' />
          {showFilter ? t('Close filters') : `${t('Filters')}${activeFilterCount ? ` (${activeFilterCount})` : ''}`}
        </button>

        <aside className={`max-h-[70vh] w-full shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100vh-7rem)] lg:w-72 lg:flex-col ${showFilter ? 'flex flex-col' : 'hidden'}`}>
          <div className='space-y-5 overflow-y-auto pr-1 text-sm text-gray-600'>
            <div>
              <p className='mb-2 font-semibold text-gray-900'>{t('Speciality')}</p>
              <div className='flex max-h-[294px] flex-wrap gap-2 overflow-y-auto pr-1 lg:flex-col lg:flex-nowrap'>
                <button
                  onClick={handleAllDoctorsFilter}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    isAllDoctorsSelected
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40 hover:bg-teal-50'
                  }`}
                >
                  {t('All doctors')}
                </button>
                {specialityFilters.map((specialityName) => (
                  <button
                    key={specialityName}
                    onClick={() => handleSpecialityFilter(specialityName)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      selectedSpeciality === specialityName
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40 hover:bg-teal-50'
                    }`}
                  >
                    {tc(specialityName)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className='mb-2 font-semibold text-gray-900'>{t('Doctor title')}</p>
              <div className='flex flex-wrap gap-2 lg:flex-col'>
                {titleFilters.map((titleName) => (
                  <button
                    key={titleName}
                    onClick={() => setSelectedTitle((value) => value === titleName ? '' : titleName)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${selectedTitle === titleName ? 'border-primary bg-primary text-white shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40 hover:bg-teal-50'}`}
                  >
                    {t(titleName)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className='mb-2 font-semibold text-gray-900'>{t('Gender')}</p>
              <div className='flex flex-wrap gap-2 lg:flex-col'>
                {genderFilters.map((genderName) => (
                  <button
                    key={genderName}
                    onClick={() => setSelectedGender((value) => value === genderName ? '' : genderName)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${selectedGender === genderName ? 'border-primary bg-primary text-white shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40 hover:bg-teal-50'}`}
                  >
                    {t(genderName)}
                  </button>
                ))}
              </div>
            </div>

            {locationFilters.length > 0 && (
              <div>
                <p className='mb-2 font-semibold text-gray-900'>{t('Location')}</p>
                <div className='flex max-h-[294px] flex-wrap gap-2 overflow-y-auto pr-1 lg:flex-col lg:flex-nowrap'>
                  {locationFilters.map((locationName) => (
                    <button
                      key={locationName}
                      onClick={() => handleLocationFilter(locationName)}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        selectedClinic === locationName
                          ? 'border-primary bg-primary text-white shadow-sm'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40 hover:bg-teal-50'
                      }`}
                    >
                      {formatLocationLine(locationName, language, t, placeTranslationOverrides)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className='mb-2 font-semibold text-gray-900'>{t('Payment')}</p>
              <div className='flex flex-wrap gap-2 lg:flex-col'>
                {[
                  { value: 'Cash', label: t('Cash') },
                  { value: 'Visa', label: t('Online payment') }
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setSelectedPayment((value) => value === item.value ? '' : item.value)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${selectedPayment === item.value ? 'border-primary bg-primary text-white shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40 hover:bg-teal-50'}`}
                  >
                    <CreditCard className='h-4 w-4' />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </aside>

        <main className='min-w-0 flex-1'>
          <div className='mb-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between'>
            <p className='text-sm text-gray-600'>
              {fillT('Showing doctors count', { current: filterDoc.length, total: doctors.length })}
            </p>
            <label className='flex items-center gap-2 text-sm font-semibold text-gray-700'>
              <ArrowUpDown className='h-4 w-4 text-primary' />
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className='rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10'
              >
                <option value='recommended'>{t('Recommended')}</option>
                <option value='rating'>{t('Highest rated')}</option>
              </select>
            </label>
          </div>

          <div className='grid grid-cols-[repeat(auto-fill,minmax(166px,188px))] justify-center gap-4 sm:justify-start'>
            {filterDoc.length > 0 ? filterDoc.map((item, index) => {
                const promoOffer = getPromoOfferLabel(item, currencySymbol, t, language)
                return (
              <div
                onClick={() => {
                  if (isDoctorComingSoon(item)) return
                  navigate(`/appointment/${item._id}${consultationMode ? `?consultation=${consultationMode}` : ''}`)
                }}
                className={`group min-h-[386px] overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition ${
                  isDoctorComingSoon(item)
                    ? 'cursor-default opacity-95'
                    : 'cursor-pointer hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg'
                }`}
                key={item._id || index}
              >
                <div className='relative mx-3 mt-3 h-[146px] overflow-hidden rounded-lg bg-blue-50'>
                  <img className='h-full w-full object-cover transition duration-300 group-hover:scale-105' src={item.image} alt={displayPersonName(item.name)} />
                  <RatingBadge summary={item.ratingSummary} className='absolute left-2 top-2' />
                  <PromoOfferBadge doctor={item} currencySymbol={currencySymbol} className='absolute bottom-2 left-2' />
                </div>

                <div className='px-3 py-2.5'>
                  <div className={`flex items-center gap-1.5 text-xs ${
                    isDoctorComingSoon(item)
                      ? 'text-amber-600'
                      : homeVisitMode
                        ? 'text-emerald-600'
                        : isDoctorBookableForPatients(item)
                          ? 'text-green-500'
                          : 'text-gray-500'
                  }`}>
                    <p className={`h-1.5 w-1.5 rounded-full ${
                      isDoctorComingSoon(item)
                        ? 'bg-amber-500'
                        : homeVisitMode
                          ? 'bg-emerald-600'
                          : isDoctorBookableForPatients(item)
                            ? 'bg-green-500'
                            : 'bg-gray-500'
                    }`} />
                    <p className='truncate'>
                      {isDoctorComingSoon(item)
                        ? t('Coming Soon')
                        : homeVisitMode
                          ? t('Home visit available')
                          : isDoctorBookableForPatients(item)
                            ? t('Available')
                            : t('Not Available')}
                    </p>
                  </div>
                  <p className='truncate text-sm font-bold text-gray-800 mt-1.5'>{displayPersonName(item.name)}</p>
                  <p className='mt-1 truncate text-sm text-gray-600'>{[item.title ? t(item.title) : '', tc(item.speciality)].filter(Boolean).join(' - ')}</p>
                  <div className='mt-2 flex flex-wrap gap-1.5'>
                    {item.gender && <span className='rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600'>{t(item.gender)}</span>}
                    {promoOffer && <span className='rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700'>{localizeDigits(promoOffer)}</span>}
                  </div>
                  <div className='mt-2 space-y-1.5'>
                    {getDoctorLocations(item).slice(0, 2).map((location) => (
                      <div key={location} className='rounded-lg bg-blue-50 px-2 py-1.5'>
                        <p className='flex items-center gap-1.5 truncate text-xs font-semibold text-gray-700'>
                          <MapPin className='h-3.5 w-3.5 shrink-0 text-blue-500' />
                          <span className='truncate'>{formatLocationLine(location, language, t, placeTranslationOverrides)}</span>
                        </p>
                        <p className='ml-5 mt-0.5 text-[11px] font-medium text-blue-700'>{getWeeklyAvailabilityLabel(item, location)}</p>
                      </div>
                    ))}
                    {getDoctorLocations(item).length === 0 && (
                      <p className='flex items-center gap-1.5 truncate text-sm text-gray-600'>
                        <MapPin className='h-4 w-4 shrink-0 text-blue-500' />
                        <span className='truncate'>{formatLocationLine(getDoctorLocation(item), language, t, placeTranslationOverrides) || t('Clinic location')}</span>
                      </p>
                    )}
                    {getDoctorLocations(item).length > 2 && (
                      <p className='text-[11px] font-semibold text-gray-500'>
                        {fillT('{{n}} more branches', { n: getDoctorLocations(item).length - 2 })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
                )
              }) : (
              <div className='col-span-full rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center shadow-sm'>
                <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-primary'>
                  <Search className='h-5 w-5' />
                </div>
                <p className='text-lg font-bold text-gray-900'>{t('No doctors match these filters')}</p>
                <p className='mx-auto mt-2 max-w-md text-sm text-gray-500'>{t('Doctors empty state hint')}</p>
                <button
                  onClick={clearFilters}
                  className='mt-5 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark'
                >
                  {t('Clear filters')}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Doctors
