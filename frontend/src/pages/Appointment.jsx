import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'
import { assets } from '../assets/assets'
import RelatedDoctors from '../components/RelatedDoctors'
import { toast } from 'react-toastify'
import axios from 'axios'
import { buildDoctorSlots, slotDateForCalendarOffset } from '../utils/schedule'
import { usesClinicWeeklySchedule } from '../utils/doctorBooking'
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Banknote, CalendarDays, CheckCircle2, CreditCard, MapPin, Phone, Receipt, ShieldCheck, Stethoscope, Tag, Video, Building2, Home, MessageCircle } from 'lucide-react'
import { RatingBadge, RatingsList, StarRow } from '../components/DoctorRating'
import PromoOfferBadge from '../components/PromoOfferBadge'
import { computeDoctorPromoDiscountAmount, getPromoOfferLabel } from '../utils/promo'
import { computeHomeVisitSurcharge, getHomeVisitFeeLabel, getHomeVisitPricingHint, normalizeHomeVisitPricing } from '../utils/homeVisitPricing'
import {
  computeAppointmentPayableForVisit,
  normalizeGlobalVisitFees,
  normalizeVisitFeeType,
  resolveVisitFeeAmount
} from '../utils/visitFees'
import { doctorOffersHomeVisit, emptyHomeVisitAddress, getDoctorHomeVisitAreas } from '../utils/homeVisitAreas'
import { formatLocationLine, translatePlaceSegment } from '../utils/placeTranslations'
import { getTranslatedDoctorAbout } from '../utils/doctorAboutTranslate'
import { formatExperienceEn, parseExperienceYears } from '../utils/doctorExperience'
import { hasDoctorPublishedSchedule, isDoctorBookableForPatients } from '../utils/doctorBooking'

const APPOINTMENT_TYPE_OPTIONS = [
  { value: 'Clinic', labelKey: 'In clinic', hintKey: 'Visit the clinic', icon: Building2 },
  { value: 'Voice Call', labelKey: 'Voice call', hintKey: 'Audio consultation', icon: Phone },
  { value: 'Video Call', labelKey: 'Video call', hintKey: 'Online video room', icon: Video },
  { value: 'Home Visit', labelKey: 'Home visit', hintKey: 'Doctor visits home', icon: Home }
]

const VISIT_FEE_OPTIONS = [
  { value: 'examination', labelKey: 'Examination (Kashf)', hintKey: 'Examination hint', icon: Stethoscope },
  { value: 'consultation', labelKey: 'Follow-up consultation (Istishara)', hintKey: 'Follow-up consultation hint', icon: MessageCircle }
]

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51Om5RIFYci1ONXhwffRNoKDSSkbwm6HLTtHRqHo4fG9VVWB74kE41EZG0Q65BvZU0QXQt7BCddGNcMnnOTRzia2500UZzolAxd')

const StripePaymentForm = ({ pendingPayment, confirmBookingStripePayment, onPaid, currencySymbol }) => {
  const stripe = useStripe()
  const elements = useElements()
  const [isPaying, setIsPaying] = useState(false)
  const { t, localizeDigits } = useLanguage()

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!stripe || !elements) return

    setIsPaying(true)
    const cardElement = elements.getElement(CardElement)
    const { error, paymentIntent } = await stripe.confirmCardPayment(pendingPayment.clientSecret, {
      payment_method: { card: cardElement }
    })

    if (error) {
      toast.error(error.message || t('Payment failed'))
      setIsPaying(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      const appointment = await confirmBookingStripePayment(paymentIntent.id)
      if (appointment) onPaid()
    } else {
      toast.error(t('Payment was not completed'))
    }

    setIsPaying(false)
  }

  return (
    <form onSubmit={handleSubmit} className='rounded-xl border-2 border-primary bg-white p-4 shadow-lg sm:p-5'>
      <div className='mb-4 flex items-start justify-between gap-3'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-wide text-primary'>{t('Final step')}</p>
          <p className='mt-1 text-lg font-bold text-gray-900'>{t('Enter Visa details to confirm appointment')}</p>
          <p className='mt-1 text-sm text-gray-600'>{t('Booking payment subtitle')}</p>
        </div>
        <div className='rounded-full bg-primary/10 p-2'>
          <CreditCard className='h-5 w-5 text-primary' />
        </div>
      </div>
      <div className='mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800'>
        {t('Amount to pay')}: {localizeDigits(`${currencySymbol}${pendingPayment.amount}`)}
      </div>
      <label className='mb-2 block text-sm font-medium text-gray-700'>{t('Card information')}</label>
      <div className='rounded-lg border border-gray-300 bg-white p-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'>
        <CardElement options={{ hidePostalCode: true }} />
      </div>
      <button disabled={!stripe || isPaying} className='mt-4 w-full rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white disabled:bg-gray-400 sm:w-auto'>
        {isPaying ? t('Processing payment...') : t('Pay and book appointment')}
      </button>
    </form>
  )
}

const Appointment = () => {
  
  const {docId} = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    doctors,
    currencySymbol,
    backendUrl,
    token,
    getDoctorsData,
    createBookingPaymentIntent,
    confirmBookingStripePayment,
    getDoctorRatings,
    displayPersonName,
    slotDateFormat,
    siteSettings,
    t,
    tc,
    language,
    placeTranslationOverrides,
    textTranslationOverrides,
    localizeDigits
  } = useContext(AppContext)

  const fillT = (key, vars = {}) => {
    let s = String(t(key))
    Object.entries(vars || {}).forEach(([k, v]) => {
      s = s.split(`{{${k}}}`).join(String(v))
    })
    return localizeDigits(s)
  }

  const weekShortLabels = useMemo(() => {
    if (language !== 'ar') return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    return ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  }, [language])

  const formatExperienceBadge = (exp) => {
    const n = parseExperienceYears(exp)
    if (n === null) return String(exp || '').trim()
    if (language === 'ar') return fillT('Years experience', { n: String(n) })
    return formatExperienceEn(exp)
  }

  const [slotIndex, setSlotIndex] = useState(null)
  const [slotTime, setSlotTime] = useState('')

  const [isBooking, setIsBooking] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [promoSelected, setPromoSelected] = useState(true)
  const [clinicLocation, setClinicLocation] = useState('')
  const [slotBranch, setSlotBranch] = useState('')
  const [appointmentType, setAppointmentType] = useState(searchParams.get('consultation') === 'voice' ? 'Voice Call' : searchParams.get('consultation') === 'tele' ? 'Video Call' : searchParams.get('consultation') === 'home' ? 'Home Visit' : 'Clinic')
  const [visitFeeType, setVisitFeeType] = useState('examination')
  const [visitFeeEligibility, setVisitFeeEligibility] = useState({
    loading: false,
    canBookConsultation: false,
    examinationFee: null,
    consultationFee: null
  })
  const [homeVisitAddress, setHomeVisitAddress] = useState(emptyHomeVisitAddress)
  const [pendingPayment, setPendingPayment] = useState(null)
  const [ratingsOpen, setRatingsOpen] = useState(false)
  const [ratingsData, setRatingsData] = useState({ summary: { averageRating: 0, ratingCount: 0 }, ratings: [] })
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const paymentPanelRef = useRef(null)
  

  const docInfo = useMemo(() => doctors.find(doc => doc._id === docId), [doctors, docId])
  const hasClinicAvailability = useMemo(
    () => Boolean(docInfo && hasDoctorPublishedSchedule(docInfo)),
    [docInfo]
  )
  const doctorHomeVisitAreas = useMemo(
    () => (docInfo ? getDoctorHomeVisitAreas(docInfo) : []),
    [docInfo]
  )
  const homeVisitAvailable = useMemo(() => Boolean(docInfo && doctorOffersHomeVisit(docInfo)), [docInfo])
  const voiceCallAvailable = isDoctorBookableForPatients(docInfo) && docInfo?.acceptsVoiceCall !== false && hasClinicAvailability
  const videoCallAvailable = isDoctorBookableForPatients(docInfo) && docInfo?.acceptsVideoCall !== false && hasClinicAvailability
  const isAppointmentTypeAvailable = (type) => {
    if (type === 'Clinic') return hasClinicAvailability
    if (type === 'Voice Call') return voiceCallAvailable
    if (type === 'Video Call') return videoCallAvailable
    if (type === 'Home Visit') return homeVisitAvailable
    return false
  }
  const fallbackAppointmentType = appointmentType === 'Clinic' && hasClinicAvailability
    ? 'Clinic'
    : appointmentType === 'Voice Call' && voiceCallAvailable
      ? 'Voice Call'
      : appointmentType === 'Video Call' && videoCallAvailable
        ? 'Video Call'
        : appointmentType === 'Home Visit' && homeVisitAvailable
          ? 'Home Visit'
          : 'Clinic'
  const activeAppointmentType = isAppointmentTypeAvailable(appointmentType) ? appointmentType : fallbackAppointmentType
  const doctorLocations = useMemo(() => {
    if (!docInfo) return []
    return (docInfo.locations || []).map((loc) => String(loc || '').trim()).filter(Boolean)
  }, [docInfo])
  const selectedClinicLocation = clinicLocation || (doctorLocations.length === 1 ? doctorLocations[0] : '')
  const crossBranchHold = useMemo(() => {
    if (!usesClinicWeeklySchedule(activeAppointmentType) || doctorLocations.length < 2 || slotIndex === null || !slotTime || !slotBranch) return null
    return { slotDate: slotDateForCalendarOffset(slotIndex), slotTime, sourceLocation: slotBranch }
  }, [activeAppointmentType, doctorLocations.length, slotIndex, slotTime, slotBranch])

  const docSlots = useMemo(
    () => docInfo ? buildDoctorSlots(docInfo, 31, activeAppointmentType, selectedClinicLocation, crossBranchHold) : [],
    [docInfo, activeAppointmentType, selectedClinicLocation, crossBranchHold]
  )
  const activePromoCode = String(docInfo?.promoCode?.code || '').trim().toUpperCase()
  const promoActive = Boolean(docInfo?.promoCode?.active && activePromoCode)
  const promoLabel = useMemo(
    () => (promoActive && docInfo ? getPromoOfferLabel(docInfo, currencySymbol, t, language) : ''),
    [promoActive, docInfo, currencySymbol, t, language]
  )
  const globalVisitFees = useMemo(
    () => normalizeGlobalVisitFees(siteSettings?.globalVisitFees),
    [siteSettings?.globalVisitFees]
  )
  const homeVisitPricing = useMemo(
    () => normalizeHomeVisitPricing(siteSettings?.homeVisitPricing),
    [siteSettings?.homeVisitPricing]
  )
  const activeVisitFeeType = normalizeVisitFeeType(visitFeeType)
  const examinationBaseFee = docInfo
    ? resolveVisitFeeAmount(docInfo, 'examination', globalVisitFees)
    : 0
  const consultationBaseFee = docInfo
    ? resolveVisitFeeAmount(docInfo, 'consultation', globalVisitFees)
    : 0
  const selectedBaseFee = docInfo
    ? resolveVisitFeeAmount(docInfo, activeVisitFeeType, globalVisitFees)
    : 0
  const discountAmount = promoActive && promoSelected
    ? computeDoctorPromoDiscountAmount(selectedBaseFee, docInfo.promoCode)
    : 0
  const homeVisitSurcharge = activeAppointmentType === 'Home Visit'
    ? computeHomeVisitSurcharge(examinationBaseFee, homeVisitPricing)
    : 0
  const homeVisitFeeLabel = useMemo(
    () => getHomeVisitFeeLabel(homeVisitPricing, t, currencySymbol),
    [homeVisitPricing, t, currencySymbol]
  )
  const homeVisitPricingHint = useMemo(
    () => getHomeVisitPricingHint(homeVisitPricing, t, currencySymbol, homeVisitSurcharge),
    [homeVisitPricing, t, currencySymbol, homeVisitSurcharge]
  )
  const payableAmount = docInfo
    ? computeAppointmentPayableForVisit(
        docInfo,
        activeVisitFeeType,
        discountAmount,
        activeAppointmentType,
        globalVisitFees,
        homeVisitPricing
      )
    : 0
  const visitFeeTypeLabel = useMemo(
    () => t(VISIT_FEE_OPTIONS.find((option) => option.value === activeVisitFeeType)?.labelKey || 'Examination (Kashf)'),
    [activeVisitFeeType, t]
  )
  const consultationVisitDisabled = !visitFeeEligibility.canBookConsultation
  const appointmentTypeLabel = useMemo(
    () => t(APPOINTMENT_TYPE_OPTIONS.find((option) => option.value === activeAppointmentType)?.labelKey || 'In clinic'),
    [activeAppointmentType, t]
  )
  const selectedBookingDetails = useMemo(() => {
    if (slotIndex === null || !slotTime || !docSlots[slotIndex]) return null
    const dateTime = docSlots[slotIndex].dateTime
    const slotDate = `${dateTime.getDate()}_${dateTime.getMonth() + 1}_${dateTime.getFullYear()}`
    const bookingClinicLocation = usesClinicWeeklySchedule(activeAppointmentType) && slotBranch ? slotBranch : selectedClinicLocation
    return {
      slotDate,
      slotDateLabel: slotDateFormat(slotDate),
      slotTime,
      appointmentTypeLabel,
      visitFeeTypeLabel,
      locationLabel:
        usesClinicWeeklySchedule(activeAppointmentType) && bookingClinicLocation
          ? formatLocationLine(bookingClinicLocation, language, t, placeTranslationOverrides)
          : activeAppointmentType === 'Home Visit' && homeVisitAddress.area
            ? `${homeVisitAddress.area}${homeVisitAddress.street ? `, ${homeVisitAddress.street}` : ''}`
            : ''
    }
  }, [
    slotIndex,
    slotTime,
    docSlots,
    slotDateFormat,
    activeAppointmentType,
    slotBranch,
    selectedClinicLocation,
    appointmentTypeLabel,
    visitFeeTypeLabel,
    homeVisitAddress,
    language,
    t,
    placeTranslationOverrides
  ])
  const effectivePaymentMethod = paymentMethod === 'Cash' && docInfo?.acceptsCash === false && docInfo?.acceptsOnlinePayment !== false
    ? 'Visa'
    : paymentMethod === 'Visa' && docInfo?.acceptsOnlinePayment === false && docInfo?.acceptsCash !== false
      ? 'Cash'
      : paymentMethod

  useEffect(() => {
    if (activeAppointmentType !== 'Home Visit') return
    if (homeVisitAddress.area && !doctorHomeVisitAreas.includes(homeVisitAddress.area)) {
      setHomeVisitAddress((previous) => ({ ...previous, area: '' }))
      setPendingPayment(null)
    }
  }, [activeAppointmentType, doctorHomeVisitAreas, homeVisitAddress.area])

  useEffect(() => {
    const loadRatings = async () => {
      if (!docId) return
      setRatingsLoading(true)
      const data = await getDoctorRatings(docId)
      setRatingsData(data)
      setRatingsLoading(false)
    }
    loadRatings()
  }, [docId])

  useEffect(() => {
    getDoctorsData()
  }, [docId])

  useEffect(() => {
    if (!docId || !token) {
      setVisitFeeEligibility({
        loading: false,
        canBookConsultation: false,
        examinationFee: examinationBaseFee,
        consultationFee: consultationBaseFee
      })
      return
    }

    let cancelled = false
    const loadEligibility = async () => {
      setVisitFeeEligibility((previous) => ({ ...previous, loading: true }))
      try {
        const { data } = await axios.get(`${backendUrl}/api/user/visit-fee-eligibility/${docId}`, {
          headers: { token }
        })
        if (cancelled) return
        if (data.success) {
          setVisitFeeEligibility({
            loading: false,
            canBookConsultation: Boolean(data.canBookConsultation),
            examinationFee: data.examinationFee,
            consultationFee: data.consultationFee
          })
        } else {
          setVisitFeeEligibility({
            loading: false,
            canBookConsultation: false,
            examinationFee: examinationBaseFee,
            consultationFee: consultationBaseFee
          })
        }
      } catch {
        if (!cancelled) {
          setVisitFeeEligibility({
            loading: false,
            canBookConsultation: false,
            examinationFee: examinationBaseFee,
            consultationFee: consultationBaseFee
          })
        }
      }
    }

    loadEligibility()
    return () => {
      cancelled = true
    }
  }, [docId, token, backendUrl])

  useEffect(() => {
    if (consultationVisitDisabled && activeVisitFeeType === 'consultation') {
      setVisitFeeType('examination')
      setPendingPayment(null)
    }
  }, [consultationVisitDisabled, activeVisitFeeType])

  const doctorAcceptsBookings = isDoctorBookableForPatients(docInfo)

  const bookAppointment = async () => {
    if (!doctorAcceptsBookings) {
      return toast.warn(t('Coming soon — booking not open yet'))
    }
    if(!token) {
      toast.warn(t('Login to book appointment'))
      return  navigate('/login')
    }

    if(slotIndex === null) {
      return toast.warn(t('Please select a day'))
    }

    if(!slotTime) {
      return toast.warn(t('Please select a time'))
    }

    const bookingClinicLocation = usesClinicWeeklySchedule(activeAppointmentType) && slotBranch ? slotBranch : selectedClinicLocation

    if(usesClinicWeeklySchedule(activeAppointmentType) && doctorLocations.length > 0 && !bookingClinicLocation) {
      return toast.warn(t('Please choose clinic location'))
    }
    if(activeAppointmentType === 'Home Visit' && (!homeVisitAddress.area || !homeVisitAddress.street.trim())) {
      return toast.warn(t('Please enter home visit street'))
    }
    if (effectivePaymentMethod === 'Cash' && docInfo.acceptsCash === false) {
      return toast.warn(t('Doctor does not accept cash'))
    }
    if (effectivePaymentMethod === 'Visa' && docInfo.acceptsOnlinePayment === false) {
      return toast.warn(t('Doctor does not accept card'))
    }
    setIsBooking(true)  // Booking start

    try {
      
    const date = docSlots[slotIndex].dateTime

    let day = date.getDate()
    let month = date.getMonth()+1
    let year = date.getFullYear()

    const slotDate = day + "_" + month + "_" + year
    
    if (effectivePaymentMethod === 'Visa') {
      const intent = await createBookingPaymentIntent({
        docId,
        slotDate,
        slotTime,
        clinicLocation: bookingClinicLocation,
        appointmentType: activeAppointmentType,
        visitFeeType: activeVisitFeeType,
        homeVisitAddress,
        promoCode: promoSelected ? activePromoCode : ''
      })
        if (intent?.clientSecret) {
          setPendingPayment({
            clientSecret: intent.clientSecret,
            paymentIntentId: intent.paymentIntentId,
            amount: intent.amount
          })
          setTimeout(() => {
            paymentPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 100)
        }
      setIsBooking(false)
      return
    }

    const { data } = await axios.post(
      backendUrl + '/api/user/book-appointment',
      {
        docId,
        slotDate,
        slotTime,
        paymentMethod: effectivePaymentMethod,
        clinicLocation: bookingClinicLocation,
        appointmentType: activeAppointmentType,
        visitFeeType: activeVisitFeeType,
        homeVisitAddress,
        promoCode: promoSelected ? activePromoCode : ''
      },
      { headers: { token } }
    )
    if(data.success){
      toast.success(t('Appointment Booked'))
      getDoctorsData()
      navigate('/my-appointments')
      } else {
      toast.error(data.message)
    }

    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
    setIsBooking(false)  // Booking end
  }

  return docInfo && (
    <div className='pb-10'>
      {/* -------- Doctor Details -------- */}
      <div className='overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm'>
      <div className='flex flex-col gap-5 bg-gradient-to-br from-teal-50 via-white to-blue-50 p-4 sm:flex-row sm:p-6'>
        <div className='sm:w-72 sm:shrink-0'>
          <div className='relative overflow-hidden rounded-2xl bg-primary shadow-sm'>
            <img className='h-80 w-full object-cover sm:h-full sm:min-h-80' src={docInfo.image} alt={displayPersonName(docInfo.name)} />
            <RatingBadge summary={docInfo.ratingSummary || ratingsData.summary} className='absolute left-3 top-3' />
            <PromoOfferBadge doctor={docInfo} currencySymbol={currencySymbol} className='absolute bottom-3 left-3' />
          </div>
        </div>

        <div className='flex-1 rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm sm:p-7'>
          {/* Doc Info : name, degree, experience -------- */}
          <p className='flex flex-wrap items-center gap-2 text-2xl font-bold text-gray-950 sm:text-3xl'>
            {displayPersonName(docInfo.name)}
            <img className='w-5' src={assets.verified_icon} alt="" />
            </p>
            <div className='mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600'>
              <p>{docInfo.degree} - {tc(docInfo.speciality)}</p>
              <span className='rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-primary'>{formatExperienceBadge(docInfo.experience)}</span>
            </div>

            {/* -------- Doctor About -------- */}
            <div>
              <p className='flex items-center gap-1 text-sm font-medium text-gray-900 mt-3' >{t('About the doctor')} <img src={assets.info_icon} alt="" />
              </p>
              <p className='mt-2 max-w-[760px] text-sm leading-6 text-gray-600 whitespace-pre-wrap'>{getTranslatedDoctorAbout(docInfo.about, language, textTranslationOverrides)}</p>
            </div>
            <div className='mt-4 flex flex-wrap gap-3'>
              <div className='rounded-xl border border-gray-100 bg-gray-50 px-4 py-3'>
                <p className='text-xs font-semibold uppercase tracking-wide text-gray-400'>{t('Examination fee label')}</p>
                <p className='mt-1 text-lg font-bold text-gray-900'>{localizeDigits(`${currencySymbol}${examinationBaseFee}`)}</p>
                {consultationBaseFee < examinationBaseFee && (
                  <p className='mt-1 text-xs text-gray-500'>
                    {t('Follow-up consultation fee label')}: {localizeDigits(`${currencySymbol}${consultationBaseFee}`)}
                  </p>
                )}
              </div>
              <div className='rounded-xl border border-gray-100 bg-gray-50 px-4 py-3'>
                <p className='text-xs font-semibold uppercase tracking-wide text-gray-400'>{t('Availability')}</p>
                <p className={`mt-1 flex items-center gap-2 font-bold ${doctorAcceptsBookings ? 'text-emerald-700' : 'text-gray-500'}`}>
                  <CheckCircle2 className='h-4 w-4' />
                  {doctorAcceptsBookings ? t('Open for booking') : t('Coming Soon')}
                </p>
              </div>
            </div>
            {!doctorAcceptsBookings && (
              <div className='mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900'>
                {t('This doctor is coming soon. Appointments will open after the doctor publishes their schedule.')}
              </div>
            )}
            <div className={`mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 ${!doctorAcceptsBookings ? 'pointer-events-none opacity-50' : ''}`}>
              <p className='mb-3 text-sm font-semibold text-gray-900'>{t('Appointment type')}</p>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-4'>
                {APPOINTMENT_TYPE_OPTIONS.map((option) => {
                  const Icon = option.icon
                  const isDisabled = !isAppointmentTypeAvailable(option.value)
                  const label = t(option.labelKey)
                  const hint = t(option.hintKey)
                  return (
                    <button
                      key={option.value}
                      type='button'
                      disabled={isDisabled}
                      title={isDisabled ? fillT('Appointment type not available', { type: label }) : hint}
                      onClick={() => {
                        if (isDisabled) return
                        setAppointmentType(option.value)
                        setSlotIndex(null)
                        setSlotTime('')
                        setSlotBranch('')
                        setPendingPayment(null)
                      }}
                      className={`rounded-xl border p-3 text-left transition ${
                        isDisabled
                          ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 opacity-70'
                          : activeAppointmentType === option.value
                            ? 'border-primary bg-white text-primary shadow-sm'
                            : 'border-blue-200 bg-white/70 text-gray-700 hover:border-primary'
                      }`}
                    >
                      <span className='flex items-center gap-2 text-sm font-semibold'>
                        <Icon className='h-4 w-4' />
                        {label}
                      </span>
                      <span className={`mt-1 block text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
                        {isDisabled ? t('Not Available') : hint}
                      </span>
                    </button>
                  )
                })}
              </div>
              {!hasClinicAvailability && !homeVisitAvailable && (
                <div className='mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900'>
                  <p className='font-semibold'>{t('Doctor setting up availability')}</p>
                  <p className='mt-1 text-xs'>{t('Doctor setting up availability hint')}</p>
                </div>
              )}
            </div>

            <div className={`mt-5 rounded-2xl border border-violet-100 bg-violet-50 p-4 ${!doctorAcceptsBookings ? 'pointer-events-none opacity-50' : ''}`}>
              <p className='mb-3 text-sm font-semibold text-gray-900'>{t('Visit type')}</p>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                {VISIT_FEE_OPTIONS.map((option) => {
                  const Icon = option.icon
                  const isConsultation = option.value === 'consultation'
                  const isDisabled = isConsultation && consultationVisitDisabled
                  const label = t(option.labelKey)
                  const lockedHint = !token
                    ? t('Follow-up consultation login hint')
                    : t('Follow-up consultation locked hint')
                  const hint = isDisabled ? lockedHint : t(option.hintKey)
                  const displayFee = option.value === 'consultation' ? consultationBaseFee : examinationBaseFee
                  return (
                    <button
                      key={option.value}
                      type='button'
                      disabled={isDisabled}
                      title={hint}
                      onClick={() => {
                        if (isDisabled) return
                        setVisitFeeType(option.value)
                        setPendingPayment(null)
                      }}
                      className={`rounded-xl border p-3 text-left transition ${
                        isDisabled
                          ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 opacity-70'
                          : activeVisitFeeType === option.value
                            ? 'border-primary bg-white text-primary shadow-sm'
                            : 'border-violet-200 bg-white/70 text-gray-700 hover:border-primary'
                      }`}
                    >
                      <span className='flex items-center justify-between gap-2'>
                        <span className='flex items-center gap-2 text-sm font-semibold'>
                          <Icon className='h-4 w-4' />
                          {label}
                        </span>
                        <span className={`text-sm font-bold ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
                          {localizeDigits(`${currencySymbol}${displayFee}`)}
                        </span>
                      </span>
                      <span className={`mt-1 block text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>{hint}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {usesClinicWeeklySchedule(activeAppointmentType) && (
            <div className='mt-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm'>
              <p className='flex items-center gap-2 text-sm font-semibold text-gray-900'>
                <MapPin className='h-4 w-4 text-blue-600' />
                {t('Location')}
              </p>
              {doctorLocations.length > 0 ? (
                <div className='mt-3 flex max-h-[294px] flex-wrap gap-2 overflow-y-auto pr-1 lg:flex-col lg:flex-nowrap'>
                  {doctorLocations.map((location) => {
                    const previewSlots = buildDoctorSlots(docInfo, 7, activeAppointmentType, location, crossBranchHold)
                    const availableCount = previewSlots.reduce((sum, day) => sum + day.slots.filter((slot) => slot.available).length, 0)
                    return (
                    <button
                      key={location}
                      type='button'
                      onClick={() => {
                        setClinicLocation(location)
                        setSlotIndex(null)
                        setSlotTime('')
                        setSlotBranch('')
                        setPendingPayment(null)
                      }}
                      className={`shrink-0 rounded-xl border px-4 py-2 text-left text-sm font-medium ${selectedClinicLocation === location ? 'border-primary bg-white text-primary shadow-sm' : 'border-blue-200 bg-white/70 text-gray-700 hover:border-primary'}`}
                    >
                      <span className='block'>{formatLocationLine(location, language, t, placeTranslationOverrides)}</span>
                      <span className='mt-0.5 block text-xs font-semibold text-gray-500'>{fillT('{{count}} slots this week', { count: availableCount })}</span>
                    </button>
                    )
                  })}
                </div>
              ) : (
                <p className='mt-2 text-sm text-gray-700'>{t('Location confirmed by reception')}</p>
              )}
            </div>
            )}
            {activeAppointmentType === 'Home Visit' && (
              <div className='mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4'>
                <p className='mb-2 text-xs text-emerald-800'>{localizeDigits(homeVisitPricingHint)}</p>
                <p className='flex items-center gap-2 text-sm font-semibold text-gray-900'>
                  <Home className='h-4 w-4 text-emerald-600' />
                  {t('Home visit address')}
                </p>
                <div className='mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <select
                    value={homeVisitAddress.area}
                    onChange={(event) => {
                      setHomeVisitAddress((previous) => ({ ...previous, area: event.target.value }))
                      setPendingPayment(null)
                    }}
                    className='rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400'
                  >
                    <option value=''>{t('Choose supported area')}</option>
                    {doctorHomeVisitAreas.map((area) => (
                      <option key={area} value={area}>{translatePlaceSegment(area, language, t, placeTranslationOverrides)}</option>
                    ))}
                  </select>
                  {doctorHomeVisitAreas.length === 0 && (
                    <p className='sm:col-span-2 text-xs text-amber-800'>{t('Doctor has no home visit areas configured')}</p>
                  )}
                  <input
                    value={homeVisitAddress.street}
                    onChange={(event) => {
                      setHomeVisitAddress((previous) => ({ ...previous, street: event.target.value }))
                      setPendingPayment(null)
                    }}
                    className='rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400'
                    placeholder={t('Street name and number')}
                  />
                  <input value={homeVisitAddress.building} onChange={(event) => setHomeVisitAddress((previous) => ({ ...previous, building: event.target.value }))} className='rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400' placeholder={t('Building')} />
                  <input value={homeVisitAddress.floor} onChange={(event) => setHomeVisitAddress((previous) => ({ ...previous, floor: event.target.value }))} className='rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400' placeholder={t('Floor')} />
                  <input value={homeVisitAddress.apartment} onChange={(event) => setHomeVisitAddress((previous) => ({ ...previous, apartment: event.target.value }))} className='rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400' placeholder={t('Apartment')} />
                  <input value={homeVisitAddress.notes} onChange={(event) => setHomeVisitAddress((previous) => ({ ...previous, notes: event.target.value }))} className='rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400' placeholder={t('Landmark or notes')} />
                </div>
                <p className='mt-2 text-xs text-emerald-700'>{t('Home visit areas note')}</p>
              </div>
            )}
            <div className='mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4'>
              <button
                type='button'
                onClick={() => setRatingsOpen((value) => !value)}
                className='flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between'
              >
                <span>
                  <span className='block text-sm font-semibold text-gray-900'>{t('General rating for this doctor')}</span>
                  <span className='mt-1 flex items-center gap-2 text-sm text-gray-700'>
                    <StarRow value={ratingsData.summary?.averageRating || docInfo.ratingSummary?.averageRating} />
                    {ratingsData.summary?.ratingCount || docInfo.ratingSummary?.ratingCount
                      ? fillT('{{avg}} from {{count}} ratings', {
                          avg: Number(ratingsData.summary?.averageRating || docInfo.ratingSummary?.averageRating || 0).toFixed(1),
                          count: ratingsData.summary?.ratingCount || docInfo.ratingSummary?.ratingCount
                        })
                      : t('No ratings yet')}
                  </span>
                </span>
                <span className='rounded-full bg-yellow-400 px-4 py-2 text-xs font-bold text-yellow-950'>
                  {ratingsOpen ? t('Hide ratings') : t('Show all ratings')}
                </span>
              </button>
              {ratingsOpen && (
                <div className='mt-4'>
                  {ratingsLoading ? (
                    <p className='text-sm text-gray-500'>{t('Loading ratings...')}</p>
                  ) : (
                    <RatingsList ratings={ratingsData.ratings} />
                  )}
                </div>
              )}
            </div>
        </div>
      </div>
      </div>


      {/* -------- Booking slots -------- */}
      <div className='mt-6 rounded-2xl border border-gray-200 bg-white p-4 font-medium text-gray-700 shadow-sm sm:p-6'>
        <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='flex items-center gap-2 text-xl font-bold text-gray-950'>
              <CalendarDays className='h-5 w-5 text-primary' />
              {activeAppointmentType === 'Home Visit' ? t('Home visit slots title') : t('Choose appointment time')}
            </p>
            <p className='mt-1 text-sm font-normal text-gray-500'>{t('Pick day then time hint')}</p>
          </div>
              {slotTime && (
            <div className='rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary'>
              {localizeDigits(slotTime.toLowerCase())} {t('Time selected suffix')}
            </div>
          )}
        </div>

        <div className='flex w-full items-center gap-3 overflow-x-auto pb-2' >
          {
            docSlots.length && docSlots.map((item, index) => (
             <div
              onClick={() => {
                if (!item.slots.length) return
                setSlotIndex(slotIndex === index ? null : index)
                setSlotTime('')
                setSlotBranch('')
                setPendingPayment(null)
              }}
                className={`min-w-20 rounded-2xl px-4 py-3 text-center text-sm font-bold transition ${item.slots.length ? 'cursor-pointer hover:border-primary/40 hover:bg-teal-50' : 'cursor-not-allowed bg-gray-100 text-gray-500 opacity-50'} ${slotIndex === index ? 'bg-primary text-white shadow-sm' : 'border border-gray-200'}`}
              key={index}
             >
              <p>{weekShortLabels[item.dateTime.getDay()]}</p>
              <p>{localizeDigits(String(item.dateTime.getDate()))}</p>
              <p className='mt-1 text-[11px] font-medium opacity-80'>{fillT('{{n}} slots', { n: item.slots.filter((slot) => slot.available).length })}</p>
             </div>
            ))
          }
        </div>

        <div className='mt-4 flex min-h-14 w-full flex-wrap items-center gap-3'>
          {docSlots.length && slotIndex !== null && docSlots[slotIndex].slots.map((item,index) => (
             <button
              type='button'
              disabled={!item.available}
              title={item.reason}
              onClick={() => {
                const next = slotTime === item.time ? '' : item.time
                setSlotTime(next)
                if (!next) setSlotBranch('')
                else setSlotBranch(selectedClinicLocation)
                setPendingPayment(null)
              }}
              className={`flex-shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                item.time === slotTime
                  ? 'bg-primary text-white border-primary'
                  : item.available
                    ? 'bg-green-50 text-green-700 border-green-200 cursor-pointer hover:bg-green-100'
                    : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              }`}
              key={index}>
              {localizeDigits(item.time.toLowerCase())}
             </button>
          ))}
          {slotIndex !== null && docSlots[slotIndex].slots.length === 0 && (
            <p className='text-sm text-gray-500'>{activeAppointmentType === 'Home Visit' ? t('No home visit slots this day') : t('No slots this day')}</p>
          )}
        </div>

        <div className='mt-5 max-w-xl'>
          {promoActive && (
            <button
              type='button'
              onClick={() => {
                setPromoSelected(true)
                setPendingPayment(null)
              }}
              className='mb-5 flex w-full items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-left transition hover:border-emerald-400'
            >
              <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${promoSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-300 bg-white'}`}>
                {promoSelected && <CheckCircle2 className='h-4 w-4' />}
              </span>
              <span className='min-w-0 flex-1'>
                <span className='flex items-center gap-2 text-sm font-semibold text-gray-900'>
                  <Tag className='h-4 w-4 text-emerald-600' />
                  {t('Promo applied automatically')}
                </span>
                <span className='mt-1 block text-sm text-emerald-700'>
                  {fillT('{{code}} — {{promo}}. You save {{save}}.', { code: activePromoCode, promo: promoLabel, save: `${currencySymbol}${discountAmount}` })}
                </span>
                <span className='mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700'>
                  {homeVisitSurcharge > 0
                    ? fillT('Total (incl. home visit): {{amount}}', { amount: `${currencySymbol}${payableAmount}` })
                    : `${t('Total after promo')}: ${localizeDigits(`${currencySymbol}${payableAmount}`)}`}
                </span>
              </span>
            </button>
          )}

          <p className='mb-3 text-sm font-medium text-gray-800'>{t('Payment method')}</p>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <button
              type='button'
              disabled={docInfo.acceptsCash === false}
              onClick={() => {
                if (docInfo.acceptsCash === false) return
                setPaymentMethod('Cash')
                setPendingPayment(null)
              }}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left ${docInfo.acceptsCash === false ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400' : effectivePaymentMethod === 'Cash' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 bg-white text-gray-700'}`}
            >
              <Banknote className='h-5 w-5' />
              <span>
                <span className='block font-semibold'>{t('Cash')}</span>
                <span className='text-xs text-gray-500'>{docInfo.acceptsCash === false ? t('Doctor does not accept cash') : t('Cash payment hint')}</span>
              </span>
            </button>
            <button
              type='button'
              disabled={docInfo.acceptsOnlinePayment === false}
              onClick={() => {
                if (docInfo.acceptsOnlinePayment === false) return
                setPaymentMethod('Visa')
              }}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left ${docInfo.acceptsOnlinePayment === false ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400' : effectivePaymentMethod === 'Visa' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 bg-white text-gray-700'}`}
            >
              <CreditCard className='h-5 w-5' />
              <span>
                <span className='block font-semibold'>{t('Visa')}</span>
                <span className='text-xs text-gray-500'>{docInfo.acceptsOnlinePayment === false ? t('Doctor does not accept card') : t('Visa payment hint')}</span>
              </span>
            </button>
          </div>
          {docInfo.acceptsCash === false && docInfo.acceptsOnlinePayment === false && (
            <p className='mt-3 text-sm text-red-600'>{t('Doctor no payment methods')}</p>
          )}
        </div>

        <div className='mt-6 max-w-xl rounded-2xl border-2 border-primary/20 bg-gradient-to-b from-slate-50 to-white p-5 shadow-sm'>
          <div className='mb-4 flex items-center gap-2'>
            <Receipt className='h-5 w-5 text-primary' />
            <h3 className='text-base font-bold text-gray-900'>{t('Booking summary')}</h3>
          </div>

          {selectedBookingDetails ? (
            <dl className='mb-4 space-y-2 border-b border-gray-200 pb-4 text-sm'>
              <div className='flex justify-between gap-4'>
                <dt className='text-gray-500'>{t('Appointment type')}</dt>
                <dd className='font-semibold text-gray-900'>{selectedBookingDetails.appointmentTypeLabel}</dd>
              </div>
              <div className='flex justify-between gap-4'>
                <dt className='text-gray-500'>{t('Visit type')}</dt>
                <dd className='font-semibold text-gray-900'>{selectedBookingDetails.visitFeeTypeLabel}</dd>
              </div>
              <div className='flex justify-between gap-4'>
                <dt className='text-gray-500'>{t('Date')}</dt>
                <dd className='font-semibold text-gray-900'>{selectedBookingDetails.slotDateLabel}</dd>
              </div>
              <div className='flex justify-between gap-4'>
                <dt className='text-gray-500'>{t('Time')}</dt>
                <dd className='font-semibold text-gray-900'>{localizeDigits(selectedBookingDetails.slotTime.toLowerCase())}</dd>
              </div>
              {selectedBookingDetails.locationLabel && (
                <div className='flex justify-between gap-4'>
                  <dt className='text-gray-500'>
                    {activeAppointmentType === 'Home Visit' ? t('Home visit address') : t('Location')}
                  </dt>
                  <dd className='max-w-[60%] text-end font-semibold text-gray-900'>{selectedBookingDetails.locationLabel}</dd>
                </div>
              )}
              <div className='flex justify-between gap-4'>
                <dt className='text-gray-500'>{t('Payment method')}</dt>
                <dd className='font-semibold text-gray-900'>{effectivePaymentMethod === 'Visa' ? t('Visa') : t('Cash')}</dd>
              </div>
            </dl>
          ) : (
            <p className='mb-4 border-b border-gray-200 pb-4 text-sm text-amber-800'>
              {t('Select day and time for appointment details')}
            </p>
          )}

          <div className='space-y-2 text-sm'>
            <div className='flex justify-between gap-4 text-gray-700'>
              <span>
                {activeVisitFeeType === 'consultation'
                  ? t('Follow-up consultation fee label')
                  : t('Examination fee label')}
              </span>
              <span className='font-semibold text-gray-900'>
                {localizeDigits(`${currencySymbol}${selectedBaseFee}`)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className='flex justify-between gap-4 text-emerald-700'>
                <span>{fillT('Promo discount ({{code}})', { code: activePromoCode })}</span>
                <span className='font-semibold'>
                  −{localizeDigits(`${currencySymbol}${discountAmount}`)}
                </span>
              </div>
            )}
            {homeVisitSurcharge > 0 && (
              <div className='flex justify-between gap-4 text-emerald-800'>
                <span>{homeVisitFeeLabel}</span>
                <span className='font-semibold'>
                  +{localizeDigits(`${currencySymbol}${homeVisitSurcharge}`)}
                </span>
              </div>
            )}
            <div className='flex justify-between gap-4 border-t border-gray-200 pt-3 text-base'>
              <span className='font-bold text-gray-900'>{t('Total to pay')}</span>
              <span className='font-bold text-primary'>
                {localizeDigits(`${currencySymbol}${payableAmount}`)}
              </span>
            </div>
          </div>
        </div>

        {pendingPayment && (
          <div ref={paymentPanelRef} className='mt-5 max-w-xl scroll-mt-24'>
            <Elements stripe={stripePromise}>
              <StripePaymentForm
                pendingPayment={pendingPayment}
                confirmBookingStripePayment={confirmBookingStripePayment}
                currencySymbol={currencySymbol}
                onPaid={() => navigate('/my-appointments')}
              />
            </Elements>
          </div>
        )}
        
        <button
          onClick={bookAppointment} 
          disabled={!doctorAcceptsBookings || isBooking || pendingPayment || (docInfo.acceptsCash === false && docInfo.acceptsOnlinePayment === false)}
          className={`flex items-center justify-center gap-2 text-white text-sm font-bold px-8 py-3 rounded-full ${pendingPayment ? 'mt-3 mb-2' : 'my-6'} cursor-pointer ${!doctorAcceptsBookings || isBooking || pendingPayment || (docInfo.acceptsCash === false && docInfo.acceptsOnlinePayment === false) ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark'}`}>
          <ShieldCheck className='h-4 w-4' />
          {isBooking ? t('Preparing payment...') : effectivePaymentMethod === 'Visa' ? t('Show Visa payment form') : t('Book an appointment')}
        </button>
        </div>


      {/* -------- Listing Related Doctors -------- */}
      <RelatedDoctors docId={docId}  speciality={docInfo.speciality}/>
    </div>
  )
}

export default Appointment
