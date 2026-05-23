import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { specialityData } from '../assets/assets'
import { ArrowUpDown, CheckCircle2, CreditCard, Filter, MapPin, Phone, Search, Stethoscope, UserRound, Video, X } from 'lucide-react'
import { RatingBadge } from '../components/DoctorRating'
import PromoOfferBadge from '../components/PromoOfferBadge'
import { buildDoctorSlots } from '../utils/schedule'
import { getPromoOfferLabel } from '../utils/promo'
import { formatLocationLine } from '../utils/placeTranslations'
import { isDoctorBookableForPatients, isDoctorComingSoon, resolveClinicLocationForSlots } from '../utils/doctorBooking'
import { doctorBelongsToClinicSection } from '../utils/doctorClinicPlaces'
import { useMediaQuery } from '../utils/useMediaQuery'

const MOBILE_PAGE_SIZE = 10

const Doctors = () => {
  const { speciality } = useParams()
  const [searchParams] = useSearchParams()
  const [showFilter, setShowFilter] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('recommended')
  const [selectedTitle, setSelectedTitle] = useState('')
  const [selectedGender, setSelectedGender] = useState('')
  const [selectedPayment, setSelectedPayment] = useState('')
  const [mobilePage, setMobilePage] = useState(1)
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 1023px)')
  const doctorsListRef = useRef(null)

  const { token, doctors, getDoctorsData, t, tc, currencySymbol, displayPersonName, language, placeTranslationOverrides, localizeDigits } = useContext(AppContext)

  useEffect(() => {
    getDoctorsData()
  }, [])

  useEffect(() => {
    if (!showFilter) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [showFilter])

  const fillT = (key, vars = {}) => {
    let s = String(t(key))
    Object.entries(vars).forEach(([k, v]) => {
      s = s.split(`{{${k}}}`).join(String(v))
    })
    return s
  }

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
  const totalMobilePages = Math.max(1, Math.ceil(filterDoc.length / MOBILE_PAGE_SIZE))
  const displayedDoctors = isMobile
    ? filterDoc.slice((mobilePage - 1) * MOBILE_PAGE_SIZE, mobilePage * MOBILE_PAGE_SIZE)
    : filterDoc

  useEffect(() => {
    setMobilePage(1)
  }, [selectedSpeciality, selectedClinic, searchTerm, selectedTitle, selectedGender, selectedPayment, consultationMode, sortBy])

  useEffect(() => {
    if (mobilePage > totalMobilePages) setMobilePage(totalMobilePages)
  }, [mobilePage, totalMobilePages])

  const titleFilters = ['Professor', 'Lecturer', 'Consultant', 'Specialist']
  const genderFilters = ['Female', 'Male']
  const consultationOptions = [
    { key: 'clinic', label: t('Clinic visit'), icon: Stethoscope },
    { key: 'voice', label: t('Voice call'), icon: Phone },
    { key: 'tele', label: t('Video call'), icon: Video },
    { key: 'home', label: t('Home visit'), icon: MapPin },
  ]

  const filterChipClass = (active) =>
    `rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
      active
        ? 'border-primary bg-primary text-white shadow-sm'
        : 'border-gray-200 bg-gray-50 text-gray-700 active:bg-teal-50'
    }`

  const scrollToDoctorsTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    doctorsListRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }

  const renderFilterSection = (title, icon, children) => {
    const Icon = icon
    return (
      <section className='overflow-hidden rounded-xl border border-gray-200 bg-white'>
        <div className='flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2.5'>
          <Icon className='h-4 w-4 shrink-0 text-primary' />
          <p className='text-xs font-bold uppercase tracking-wide text-gray-700'>{title}</p>
        </div>
        <div className='p-3'>{children}</div>
      </section>
    )
  }

  const renderFilterPanel = () => (
    <div className='space-y-3 text-sm text-gray-600'>
      {renderFilterSection(
        t('Speciality'),
        Stethoscope,
        <div className='grid max-h-[200px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-1'>
          <button type='button' onClick={handleAllDoctorsFilter} className={filterChipClass(isAllDoctorsSelected)}>
            {t('All doctors')}
          </button>
          {specialityFilters.map((specialityName) => (
            <button
              key={specialityName}
              type='button'
              onClick={() => handleSpecialityFilter(specialityName)}
              className={filterChipClass(selectedSpeciality === specialityName)}
            >
              {tc(specialityName)}
            </button>
          ))}
        </div>,
      )}

      {locationFilters.length > 0 &&
        renderFilterSection(
          t('Location'),
          MapPin,
          <div className='grid max-h-[200px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-1'>
            {locationFilters.map((locationName) => (
              <button
                key={locationName}
                type='button'
                onClick={() => handleLocationFilter(locationName)}
                className={filterChipClass(selectedClinic === locationName)}
              >
                {formatLocationLine(locationName, language, t, placeTranslationOverrides)}
              </button>
            ))}
          </div>,
        )}

      {renderFilterSection(
        t('Doctor details'),
        UserRound,
        <>
          <p className='mb-2 text-[11px] font-semibold text-gray-500'>{t('Doctor title')}</p>
          <div className='mb-3 grid grid-cols-2 gap-2'>
            {titleFilters.map((titleName) => (
              <button
                key={titleName}
                type='button'
                onClick={() => setSelectedTitle((value) => (value === titleName ? '' : titleName))}
                className={filterChipClass(selectedTitle === titleName)}
              >
                {t(titleName)}
              </button>
            ))}
          </div>
          <p className='mb-2 text-[11px] font-semibold text-gray-500'>{t('Gender')}</p>
          <div className='grid grid-cols-2 gap-2'>
            {genderFilters.map((genderName) => (
              <button
                key={genderName}
                type='button'
                onClick={() => setSelectedGender((value) => (value === genderName ? '' : genderName))}
                className={filterChipClass(selectedGender === genderName)}
              >
                {t(genderName)}
              </button>
            ))}
          </div>
        </>,
      )}

      {renderFilterSection(
        t('Payment'),
        CreditCard,
        <div className='grid grid-cols-2 gap-2'>
          {[
            { value: 'Cash', label: t('Cash') },
            { value: 'Visa', label: t('Online payment') },
          ].map((item) => (
            <button
              key={item.value}
              type='button'
              onClick={() => setSelectedPayment((value) => (value === item.value ? '' : item.value))}
              className={`flex items-center justify-center gap-2 ${filterChipClass(selectedPayment === item.value)}`}
            >
              <CreditCard className='h-4 w-4 shrink-0' />
              {item.label}
            </button>
          ))}
        </div>,
      )}
    </div>
  )

  const renderDoctorCard = (item, index) => {
    const promoOffer = getPromoOfferLabel(item, currencySymbol, t, language)
    return (
      <button
        type='button'
        disabled={isDoctorComingSoon(item)}
        onClick={() => {
          navigate(`/appointment/${item._id}${consultationMode ? `?consultation=${consultationMode}` : ''}`)
        }}
        className={`group w-full overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition ${
          isMobile ? 'min-h-[320px]' : 'min-h-[386px]'
        } ${
          isDoctorComingSoon(item)
            ? 'cursor-default opacity-95'
            : 'cursor-pointer hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg'
        }`}
        key={item._id || index}
      >
        <div className={`relative overflow-hidden rounded-lg bg-blue-50 ${isMobile ? 'mx-2 mt-2 h-[110px]' : 'mx-3 mt-3 h-[146px]'}`}>
          <img className='h-full w-full object-cover transition duration-300 group-hover:scale-105' src={item.image} alt={displayPersonName(item.name)} />
          <RatingBadge summary={item.ratingSummary} className='absolute left-2 top-2' />
          <PromoOfferBadge doctor={item} currencySymbol={currencySymbol} className='absolute bottom-2 left-2' />
        </div>

        <div className={isMobile ? 'px-2 py-2' : 'px-3 py-2.5'}>
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
          <p className='mt-1.5 truncate text-sm font-bold text-gray-800'>{displayPersonName(item.name)}</p>
          <p className='mt-1 truncate text-sm text-gray-600'>{[item.title ? t(item.title) : '', tc(item.speciality)].filter(Boolean).join(' - ')}</p>
          <div className='mt-2 flex flex-wrap gap-1.5'>
            {item.gender && <span className='rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600'>{t(item.gender)}</span>}
            {promoOffer && <span className='rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700'>{localizeDigits(promoOffer)}</span>}
          </div>
          {!isMobile && (
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
          )}
        </div>
      </button>
    )
  }

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
                type='button'
                onClick={() => navigate('/my-appointments')}
                className='rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark'
              >
                {t('View My Appointments')}
              </button>
            )}
            <button
              type='button'
              onClick={clearFilters}
              className='hidden rounded-full border border-teal-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-primary hover:text-primary lg:inline-flex'
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
              type='button'
              onClick={() => setSearchTerm('')}
              className='absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700'
              aria-label={t('Clear search')}
            >
              <X className='h-4 w-4' />
            </button>
          )}
        </div>

        <div className='tap-row-mobile-wrap flex gap-2 overflow-x-auto pb-1 lg:pb-0'>
          {consultationOptions.map(({ key, label, icon: Icon }) => {
            const selected = (key === 'clinic' && !consultationMode) || consultationMode === key

            return (
              <button
                key={key}
                type='button'
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
          type='button'
          className='flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-semibold text-gray-700 shadow-sm transition lg:hidden active:border-primary active:bg-teal-50'
          onClick={() => setShowFilter(true)}
        >
          <Filter className='h-4 w-4' />
          {`${t('Filters')}${activeFilterCount ? ` (${activeFilterCount})` : ''}`}
        </button>

        {isMobile && showFilter ? (
          <div className='fixed inset-0 z-50 lg:hidden' role='dialog' aria-modal='true' aria-label={t('Filters')}>
            <div className='absolute inset-0 bg-gray-950/50 backdrop-blur-[2px]' onClick={() => setShowFilter(false)} role='presentation' />
            <div className='absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl'>
              <div className='flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4'>
                <div>
                  <p className='text-base font-bold text-gray-900'>{t('Filters')}</p>
                  {activeFilterCount > 0 && (
                    <p className='text-xs text-gray-500'>{fillT('{{count}} active filters', { count: activeFilterCount })}</p>
                  )}
                </div>
                <button type='button' onClick={() => setShowFilter(false)} className='flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600' aria-label={t('Close')}>
                  <X className='h-5 w-5' />
                </button>
              </div>
              <div className='flex-1 overflow-y-auto px-4 py-4'>{renderFilterPanel()}</div>
              <div className='flex gap-3 border-t border-gray-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]'>
                <button
                  type='button'
                  onClick={() => {
                    clearFilters()
                    setShowFilter(false)
                  }}
                  className='flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700'
                >
                  {t('Reset filters')}
                </button>
                <button type='button' onClick={() => setShowFilter(false)} className='flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-sm'>
                  {t('Apply filters')}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <aside className='hidden w-72 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)]'>
          <div className='mb-4 flex items-center justify-between gap-2'>
            <p className='font-bold text-gray-900'>{t('Filters')}</p>
            <button type='button' onClick={clearFilters} className='text-xs font-semibold text-primary'>
              {t('Reset filters')}
            </button>
          </div>
          <div className='max-h-[calc(100vh-11rem)] overflow-y-auto pr-1'>{renderFilterPanel()}</div>
        </aside>

        <main ref={doctorsListRef} className='min-w-0 flex-1 scroll-mt-24'>
          <div className='mb-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm'>
            <p className='text-sm text-gray-600'>
              {isMobile
                ? fillT('Showing doctors page count', { current: displayedDoctors.length, total: filterDoc.length, page: mobilePage, pages: totalMobilePages })
                : fillT('Showing doctors count', { current: filterDoc.length, total: doctors.length })}
            </p>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <p className='flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 lg:hidden'>
                <ArrowUpDown className='h-3.5 w-3.5 text-primary' />
                {t('Sort by')}
              </p>
              {isMobile ? (
                <div className='grid grid-cols-2 gap-2'>
                  <button
                    type='button'
                    onClick={() => setSortBy('recommended')}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      sortBy === 'recommended'
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-gray-200 bg-gray-50 text-gray-700'
                    }`}
                  >
                    {t('Recommended')}
                  </button>
                  <button
                    type='button'
                    onClick={() => setSortBy('rating')}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      sortBy === 'rating'
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-gray-200 bg-gray-50 text-gray-700'
                    }`}
                  >
                    {t('Highest rated')}
                  </button>
                </div>
              ) : (
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
              )}
            </div>
          </div>

          <div className={`grid gap-3 sm:gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-[repeat(auto-fill,minmax(166px,188px))] justify-center sm:justify-start'}`}>
            {displayedDoctors.length > 0 ? (
              displayedDoctors.map((item, index) => renderDoctorCard(item, index))
            ) : (
              <div className='col-span-full rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center shadow-sm'>
                <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-primary'>
                  <Search className='h-5 w-5' />
                </div>
                <p className='text-lg font-bold text-gray-900'>{t('No doctors match these filters')}</p>
                <p className='mx-auto mt-2 max-w-md text-sm text-gray-500'>{t('Doctors empty state hint')}</p>
                <button
                  type='button'
                  onClick={clearFilters}
                  className='mt-5 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark'
                >
                  {t('Clear filters')}
                </button>
              </div>
            )}
          </div>

          {isMobile && totalMobilePages > 1 && (
            <nav className='mt-6 flex flex-wrap items-center justify-center gap-2' aria-label={t('Page')}>
              {Array.from({ length: totalMobilePages }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type='button'
                  onClick={() => {
                    setMobilePage(pageNumber)
                    scrollToDoctorsTop()
                  }}
                  className={`flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition ${
                    mobilePage === pageNumber
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700'
                  }`}
                  aria-current={mobilePage === pageNumber ? 'page' : undefined}
                >
                  {localizeDigits(String(pageNumber))}
                </button>
              ))}
            </nav>
          )}
        </main>
      </div>
    </div>
  )
}

export default Doctors
