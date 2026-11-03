import React, { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Banknote, Building2, CreditCard, Home, Info, MapPin, MessageCircle, Phone, Radio, ShieldCheck, Stethoscope, Tag, Video } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'
import { assets } from '../assets/assets'
import RelatedDoctors from '../components/RelatedDoctors'
import { RatingBadge, RatingsList, StarRow } from '../components/DoctorRating'
import { Badge, Button, Card, CardBody, EmptyState, Field, Input, Select, Skeleton, Textarea, cx, notify } from '../components/ui'
import { emptyHomeVisitAddress, getDoctorHomeVisitAreas, doctorOffersHomeVisit } from '../utils/homeVisitAreas'
import { hasDoctorPublishedSchedule, isDoctorBookableForPatients, usesClinicWeeklySchedule } from '../utils/doctorBooking'
import { formatLocationLine, translatePlaceSegment } from '../utils/placeTranslations'
import { getTranslatedDoctorAbout } from '../utils/doctorAboutTranslate'
import { formatExperienceEn, parseExperienceYears } from '../utils/doctorExperience'
import BookingConfirmation from '../features/booking/BookingConfirmation'
import CheckoutForm from '../features/booking/CheckoutForm'
import SlotPicker from '../features/booking/SlotPicker'
import {
  bookWithoutCard,
  confirmBookingCheckout,
  fetchFeeEligibility,
  fetchNextAvailable,
  fetchQuote,
  fetchWaitlist,
  joinWaitlist,
  releaseCheckout,
  startBookingCheckout
} from '../features/booking/bookingApi'
import { fill, formatDayLong, formatRelativeDay, formatSlotTime, nearestOpenSlot } from '../features/booking/bookingFormat'
import { useLiveAvailability } from '../features/booking/useLiveAvailability'

const APPOINTMENT_TYPES = [
  { value: 'Clinic', labelKey: 'In clinic', hintKey: 'Visit the clinic', icon: Building2 },
  { value: 'Video Call', labelKey: 'Video call', hintKey: 'Online video room', icon: Video },
  { value: 'Voice Call', labelKey: 'Voice call', hintKey: 'Audio consultation', icon: Phone },
  { value: 'Home Visit', labelKey: 'Home visit', hintKey: 'Doctor visits home', icon: Home }
]

const TYPE_FROM_LEGACY_PARAM = { voice: 'Voice Call', tele: 'Video Call', home: 'Home Visit' }
const draftKey = (docId) => `clinivoBookingDraft:${docId}`

const readDraft = (docId) => {
  try {
    return JSON.parse(sessionStorage.getItem(draftKey(docId)) || 'null')
  } catch {
    return null
  }
}

const writeDraft = (docId, draft) => {
  try {
    if (draft) sessionStorage.setItem(draftKey(docId), JSON.stringify(draft))
    else sessionStorage.removeItem(draftKey(docId))
  } catch {
    // A private window can refuse storage. The booking itself does not depend on it.
  }
}

const StepCard = ({ number, title, titleId, aside, children }) => (
  <Card as='section' variant='raised' aria-labelledby={titleId}>
    <CardBody>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
        <h2 id={titleId} className='flex items-center gap-2.5 text-title font-semibold text-ink'>
          <span aria-hidden='true' className='flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-body-sm font-semibold text-brand'>{number}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </CardBody>
  </Card>
)

const ChoiceCard = ({ selected, disabled, onClick, icon, label, hint, trailing }) => (
  <button
    type='button'
    role='radio'
    aria-checked={selected}
    disabled={disabled}
    onClick={onClick}
    className={cx(
      'flex min-w-0 items-start gap-3 rounded-control border p-3 text-start transition-colors duration-(--duration-fast)',
      disabled && 'cursor-not-allowed border-line bg-surface-sunken text-ink-3 opacity-70',
      !disabled && !selected && 'border-field bg-surface text-ink hover:border-primary',
      selected && 'border-primary bg-primary-soft text-ink'
    )}
  >
    <span className={cx('mt-0.5 shrink-0 [&>svg]:h-5 [&>svg]:w-5', selected ? 'text-brand' : 'text-ink-2')} aria-hidden='true'>{icon}</span>
    <span className='min-w-0 flex-1'>
      <span className='block text-body-sm font-semibold'>{label}</span>
      {hint && <span className='mt-0.5 block text-caption text-ink-2'>{hint}</span>}
    </span>
    {trailing}
  </button>
)

/** Live badge: the patient can see the slots are current, not a page they loaded minutes ago. */
const LiveBadge = () => {
  const { t } = useLanguage()
  return (
    <span className='flex items-center gap-1.5 text-caption font-semibold text-success-ink'>
      <Radio className='h-3.5 w-3.5' aria-hidden='true' />
      {t('Live availability')}
    </span>
  )
}

const SoonerElsewhere = ({ doctors, thisDoctorNext, appointmentType, timeZone }) => {
  const { t, language, localizeDigits } = useLanguage()
  const { displayPersonName } = useContext(AppContext)
  const sooner = doctors.filter((row) => !thisDoctorNext || row.startsAt < thisDoctorNext.startsAt).slice(0, 2)
  if (!sooner.length) return null

  return (
    <div className='mt-4 rounded-control border border-line bg-surface-sunken p-3'>
      <p className='mb-2 text-caption font-semibold text-ink-2'>{t('Sooner with another doctor')}</p>
      <ul className='space-y-2'>
        {sooner.map((row) => {
          const params = new URLSearchParams({
            type: appointmentType,
            slotDate: row.slotDate,
            slotTime: row.slotTime,
            ...(row.clinicLocation ? { location: row.clinicLocation } : {})
          })
          return (
            <li key={row.docId}>
              <Link to={`/appointment/${row.docId}?${params.toString()}`} className='flex items-center gap-3 rounded-control bg-surface p-2 transition-colors duration-(--duration-fast) hover:bg-primary-soft'>
                <img src={row.image} alt='' className='h-10 w-10 rounded-full object-cover' loading='lazy' />
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-body-sm font-semibold text-ink'>{displayPersonName(row.name)}</span>
                  <span className='block text-caption text-ink-2'>
                    {formatRelativeDay(row.startsAt, language, undefined, timeZone)} · {formatSlotTime(row.slotTime, language, localizeDigits)}
                  </span>
                </span>
                <span className='text-caption font-semibold text-brand'>{t('View')}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const PriceLines = ({ quote, formatMoney, visitFeeType }) => {
  const { t } = useLanguage()
  if (!quote) {
    return (
      <div className='space-y-2'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-6 w-2/3' />
      </div>
    )
  }
  return (
    <dl className='space-y-1.5 text-body-sm'>
      <div className='flex justify-between gap-4 text-ink-2'>
        <dt>{visitFeeType === 'consultation' ? t('Follow-up consultation fee label') : t('Examination fee label')}</dt>
        <dd className='font-semibold text-ink'>{formatMoney(quote.baseAmount)}</dd>
      </div>
      {quote.discountAmount > 0 && (
        <div className='flex justify-between gap-4 text-success-ink'>
          <dt className='flex items-center gap-1.5'><Tag className='h-3.5 w-3.5' aria-hidden='true' />{fill(t('Promo {{code}}'), { code: quote.promoCode })}</dt>
          <dd className='font-semibold'>−{formatMoney(quote.discountAmount)}</dd>
        </div>
      )}
      {quote.homeVisitSurcharge > 0 && (
        <div className='flex justify-between gap-4 text-ink-2'>
          <dt>{t('Home visit fee')}</dt>
          <dd className='font-semibold text-ink'>+{formatMoney(quote.homeVisitSurcharge)}</dd>
        </div>
      )}
      <div className='flex items-baseline justify-between gap-4 border-t border-line pt-2'>
        <dt className='font-semibold text-ink'>{t('Total to pay')}</dt>
        <dd className='text-title font-semibold text-brand'>{formatMoney(quote.amount)}</dd>
      </div>
    </dl>
  )
}

const BookingFlow = ({ docId, docInfo }) => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    formatMoney,
    backendUrl,
    token,
    userData,
    getDoctorRatings,
    getDoctorsData,
    getUserAppointments,
    displayPersonName,
    placeTranslationOverrides,
    textTranslationOverrides
  } = useContext(AppContext)
  const { t, tc, language, localizeDigits } = useLanguage()

  const whenTitleId = useId()
  const howTitleId = useId()
  const payTitleId = useId()

  const initial = useMemo(() => {
    const draft = readDraft(docId)
    const urlType = searchParams.get('type') || TYPE_FROM_LEGACY_PARAM[searchParams.get('consultation')]
    const urlSlot = searchParams.get('slotDate') && searchParams.get('slotTime')
      ? { slotDate: searchParams.get('slotDate'), slotTime: searchParams.get('slotTime') }
      : null
    return {
      appointmentType: urlType || draft?.appointmentType || 'Clinic',
      clinicLocation: searchParams.get('location') || draft?.clinicLocation || '',
      visitFeeType: draft?.visitFeeType || 'examination',
      paymentMethod: draft?.paymentMethod || 'Cash',
      homeVisitAddress: draft?.homeVisitAddress || emptyHomeVisitAddress,
      selection: urlSlot || draft?.selection || null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  const [appointmentType, setAppointmentType] = useState(initial.appointmentType)
  const [clinicLocation, setClinicLocation] = useState(initial.clinicLocation)
  const [visitFeeType, setVisitFeeType] = useState(initial.visitFeeType)
  const [paymentMethod, setPaymentMethod] = useState(initial.paymentMethod)
  const [homeVisitAddress, setHomeVisitAddress] = useState(initial.homeVisitAddress)
  const [selection, setSelection] = useState(initial.selection)

  const [quote, setQuote] = useState(null)
  const [canBookConsultation, setCanBookConsultation] = useState(false)
  const [checkout, setCheckout] = useState(null)
  const [booking, setBooking] = useState(false)
  const [confirmed, setConfirmed] = useState(null)
  const [elsewhere, setElsewhere] = useState([])
  const [waitlistEntries, setWaitlistEntries] = useState([])
  const [joiningWaitlist, setJoiningWaitlist] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [ratingsOpen, setRatingsOpen] = useState(false)
  const [ratingsData, setRatingsData] = useState({ summary: { averageRating: 0, ratingCount: 0 }, ratings: [] })
  const paymentRef = useRef(null)

  const hasClinicHours = hasDoctorPublishedSchedule(docInfo)
  const bookable = isDoctorBookableForPatients(docInfo) && docInfo.available !== false
  const typeAvailable = useCallback((type) => {
    if (!bookable) return false
    if (type === 'Clinic') return hasClinicHours
    if (type === 'Voice Call') return hasClinicHours && docInfo.acceptsVoiceCall !== false
    if (type === 'Video Call') return hasClinicHours && docInfo.acceptsVideoCall !== false
    if (type === 'Home Visit') return doctorOffersHomeVisit(docInfo)
    return false
  }, [bookable, hasClinicHours, docInfo])

  const activeType = typeAvailable(appointmentType) ? appointmentType : (APPOINTMENT_TYPES.find((row) => typeAvailable(row.value))?.value || 'Clinic')
  const usesBranches = usesClinicWeeklySchedule(activeType)
  const branches = useMemo(() => (docInfo.locations || []).map((location) => String(location || '').trim()).filter(Boolean), [docInfo.locations])
  const homeAreas = useMemo(() => getDoctorHomeVisitAreas(docInfo), [docInfo])
  const selectedBranch = usesBranches ? (clinicLocation && branches.includes(clinicLocation) ? clinicLocation : branches.length === 1 ? branches[0] : '') : ''
  const offeredEntry = waitlistEntries.find((entry) => entry.docId === docId && entry.status === 'offered' && entry.appointmentType === activeType)
  const waitingEntry = waitlistEntries.find((entry) => entry.docId === docId && entry.status === 'waiting' && entry.appointmentType === activeType)
  const reservedSlot = offeredEntry?.offer?.slotDate ? { slotDate: offeredEntry.offer.slotDate, slotTime: offeredEntry.offer.slotTime } : null

  const { availability, loading, failed, refresh } = useLiveAvailability({
    backendUrl,
    docId,
    appointmentType: activeType,
    clinicLocation: selectedBranch,
    enabled: bookable && !confirmed
  })

  const isFree = quote && quote.amount <= 0
  const insuranceReady = Boolean(userData?.insurance?.enabled)
  const canUseCash = docInfo.acceptsCash !== false
  const canUseCard = docInfo.acceptsOnlinePayment !== false && !isFree
  const activeMethod = isFree
    ? 'Cash'
    : paymentMethod === 'Insurance' && insuranceReady
      ? 'Insurance'
      : paymentMethod === 'Visa' && canUseCard
        ? 'Visa'
        : canUseCash
          ? 'Cash'
          : canUseCard
            ? 'Visa'
            : ''
  const needsAddress = activeType === 'Home Visit'
  const addressReady = !needsAddress || (homeVisitAddress.area && homeVisitAddress.street.trim())
  const readyToBook = Boolean(selection?.startsAt && activeMethod && addressReady && bookable && quote)

  const stopCheckout = useCallback(async () => {
    const current = checkout
    setCheckout(null)
    if (current?.paymentIntentId && token) {
      try {
        await releaseCheckout(backendUrl, token, current.paymentIntentId)
      } catch {
        // It expires on its own within ten minutes either way.
      }
    }
  }, [checkout, token, backendUrl])

  const changeBooking = useCallback((apply) => {
    if (checkout) stopCheckout()
    apply()
  }, [checkout, stopCheckout])

  useEffect(() => {
    let cancelled = false
    setQuote(null)
    fetchQuote(backendUrl, docId, { appointmentType: activeType, visitFeeType })
      .then((data) => {
        if (!cancelled && data.success) setQuote(data.quote)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [backendUrl, docId, activeType, visitFeeType, docInfo.promoCode?.code, docInfo.fees])

  useEffect(() => {
    if (!token) {
      setCanBookConsultation(false)
      return undefined
    }
    let cancelled = false
    fetchFeeEligibility(backendUrl, token, docId)
      .then((data) => {
        if (!cancelled) setCanBookConsultation(Boolean(data.success && data.canBookConsultation))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [backendUrl, token, docId])

  useEffect(() => {
    if (!canBookConsultation && visitFeeType === 'consultation' && token) setVisitFeeType('examination')
  }, [canBookConsultation, visitFeeType, token])

  const loadWaitlist = useCallback(async () => {
    if (!token) return
    try {
      const data = await fetchWaitlist(backendUrl, token)
      if (data.success) setWaitlistEntries(data.entries)
    } catch {
      // Booking works without it.
    }
  }, [backendUrl, token])

  useEffect(() => {
    loadWaitlist()
  }, [loadWaitlist])

  useEffect(() => {
    getDoctorRatings(docId).then(setRatingsData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  useEffect(() => {
    let cancelled = false
    fetchNextAvailable(backendUrl, { speciality: docInfo.speciality, appointmentType: activeType, excludeDocId: docId })
      .then((data) => {
        if (!cancelled && data.success) setElsewhere(data.doctors)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [backendUrl, docId, docInfo.speciality, activeType])

  // Keeps the chosen time honest: fill in its instant from a deep link, and react if someone else takes it.
  useEffect(() => {
    if (!availability || !selection || checkout) return
    const day = availability.days.find((row) => row.slotDate === selection.slotDate)
    const slot = day?.slots.find((row) => row.time === selection.slotTime)
    const isReserved = reservedSlot?.slotDate === selection.slotDate && reservedSlot?.slotTime === selection.slotTime

    if (slot && (slot.available || isReserved)) {
      if (selection.startsAt !== slot.startsAt) setSelection({ ...selection, startsAt: slot.startsAt })
      return
    }

    const nearest = nearestOpenSlot(availability.days, slot?.startsAt ?? selection.startsAt ?? Date.now())
    setSelection(null)
    if (slot?.status === 'taken' || selection.startsAt) {
      notify.warning(nearest
        ? fill(t('That time was just taken. The closest open time is {{when}}.'), {
          when: `${formatRelativeDay(nearest.startsAt, language, undefined, availability.timeZone)} ${formatSlotTime(nearest.slotTime, language, localizeDigits)}`
        })
        : t('That time was just taken.'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, selection, checkout, reservedSlot?.slotDate, reservedSlot?.slotTime])

  useEffect(() => {
    if (confirmed) return
    writeDraft(docId, { appointmentType: activeType, clinicLocation: selectedBranch, visitFeeType, paymentMethod, homeVisitAddress: { ...homeVisitAddress, notes: '' }, selection })
  }, [docId, activeType, selectedBranch, visitFeeType, paymentMethod, homeVisitAddress, selection, confirmed])

  useEffect(() => {
    if (checkout) paymentRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [checkout])

  const bookingPayload = () => ({
    docId,
    slotDate: selection.slotDate,
    slotTime: selection.slotTime,
    clinicLocation: selectedBranch,
    appointmentType: activeType,
    visitFeeType,
    homeVisitAddress: needsAddress ? homeVisitAddress : undefined
  })

  const finishBooking = (appointment) => {
    writeDraft(docId, null)
    setCheckout(null)
    setConfirmed(appointment)
    window.scrollTo?.({ top: 0 })
    getUserAppointments()
    getDoctorsData({ background: true })
    window.dispatchEvent(new Event('clinic:notifications-refresh'))
  }

  const goToLogin = () => {
    notify.info(t('Log in to finish booking. We kept your choices.'))
    navigate(`/login?mode=login&next=${encodeURIComponent(`/appointment/${docId}`)}`)
  }

  const submit = async () => {
    if (booking) return
    if (!token) return goToLogin()
    if (!readyToBook) return

    setBooking(true)
    try {
      if (activeMethod === 'Visa') {
        const data = await startBookingCheckout(backendUrl, token, bookingPayload())
        if (data.success && data.alreadyBooked) finishBooking(data.appointment)
        else if (data.success) setCheckout(data)
        else {
          notify.error(t(data.message))
          refresh()
        }
      } else {
        const data = await bookWithoutCard(backendUrl, token, { ...bookingPayload(), paymentMethod: activeMethod })
        if (data.success) finishBooking(data.appointment)
        else {
          notify.error(t(data.message))
          refresh()
        }
      }
    } catch {
      notify.error(t('Something went wrong. Please try again.'))
    } finally {
      setBooking(false)
    }
  }

  const onPaid = async (paymentIntentId) => {
    try {
      const data = await confirmBookingCheckout(backendUrl, token, paymentIntentId)
      if (data.success) {
        finishBooking(data.appointment)
        return
      }
      notify.error(t(data.message))
      if (data.refunded) {
        setCheckout(null)
        setSelection(null)
        refresh()
      }
    } catch {
      // The money has moved. My Appointments recovers the booking, so send the patient there rather than to a retry.
      notify.info(t('Your payment went through and is still being confirmed. Please check back shortly.'))
      navigate('/my-appointments')
    }
  }

  const onHoldExpired = () => {
    setCheckout(null)
    setSelection(null)
    notify.warning(t('Your hold on this time ended. Please choose a time again.'))
    refresh()
  }

  const handleJoinWaitlist = async (fromSlotDate, extraDays) => {
    if (!token) return goToLogin()
    setJoiningWaitlist(true)
    try {
      const toDay = availability.days[availability.days.findIndex((day) => day.slotDate === fromSlotDate) + extraDays] || availability.days[availability.days.length - 1]
      const data = await joinWaitlist(backendUrl, token, {
        docId,
        appointmentType: activeType,
        clinicLocation: selectedBranch,
        visitFeeType,
        fromSlotDate,
        toSlotDate: toDay?.slotDate || fromSlotDate
      })
      if (data.success) {
        notify.success(t('You are on the waitlist'))
        await loadWaitlist()
      } else {
        notify.error(t(data.message))
        if (data.slotsOpen) refresh()
      }
    } catch {
      notify.error(t('Something went wrong. Please try again.'))
    } finally {
      setJoiningWaitlist(false)
    }
  }

  const experienceYears = parseExperienceYears(docInfo.experience)
  const experienceLabel = experienceYears === null
    ? String(docInfo.experience || '').trim()
    : language === 'ar'
      ? localizeDigits(fill(t('Years experience'), { n: experienceYears }))
      : formatExperienceEn(docInfo.experience)
  const summary = ratingsData.summary?.ratingCount ? ratingsData.summary : docInfo.ratingSummary
  const ctaLabel = !token
    ? t('Log in to book')
    : activeMethod === 'Visa'
      ? t('Continue to payment')
      : t('Confirm booking')
  const placeLabel = selectedBranch
    ? formatLocationLine(selectedBranch, language, t, placeTranslationOverrides)
    : needsAddress && homeVisitAddress.area
      ? `${translatePlaceSegment(homeVisitAddress.area, language, t, placeTranslationOverrides)}${homeVisitAddress.street ? `, ${homeVisitAddress.street}` : ''}`
      : ''
  const whenLabel = selection?.startsAt
    ? `${formatDayLong(selection.startsAt, language, availability?.timeZone)} · ${formatSlotTime(selection.slotTime, language, localizeDigits)}`
    : ''

  if (confirmed) {
    return (
      <BookingConfirmation
        appointment={confirmed}
        doctorName={displayPersonName(docInfo.name)}
        backendUrl={backendUrl}
        token={token}
        formatMoney={formatMoney}
        placeLabel={placeLabel}
      />
    )
  }

  const summaryPanel = (
    <>
      <p className='mb-3 text-subtitle font-semibold text-ink'>{t('Your visit')}</p>
      <dl className='mb-4 space-y-2 border-b border-line pb-4 text-body-sm'>
        <div className='flex justify-between gap-4'>
          <dt className='text-ink-2'>{t('How')}</dt>
          <dd className='text-end font-semibold text-ink'>{t(APPOINTMENT_TYPES.find((row) => row.value === activeType)?.labelKey || 'In clinic')}</dd>
        </div>
        <div className='flex justify-between gap-4'>
          <dt className='text-ink-2'>{t('When')}</dt>
          <dd className={cx('text-end', whenLabel ? 'font-semibold text-ink' : 'text-ink-3')}>{whenLabel || t('Pick a time')}</dd>
        </div>
        {placeLabel && (
          <div className='flex justify-between gap-4'>
            <dt className='text-ink-2'>{t('Where')}</dt>
            <dd className='text-end font-semibold text-ink'>{placeLabel}</dd>
          </div>
        )}
      </dl>
      <PriceLines quote={quote} formatMoney={formatMoney} visitFeeType={visitFeeType} />
      {!checkout && (
        <Button className='mt-4 hidden lg:inline-flex' fullWidth size='lg' loading={booking} disabled={token && !readyToBook} onClick={submit}>
          {ctaLabel}
        </Button>
      )}
    </>
  )

  return (
    <div className='pb-28 pt-6 lg:pb-10'>
      {/* The doctor, short enough that the calendar is in view without scrolling */}
      <Card variant='flat' className='mb-6'>
        <CardBody>
          <div className='flex gap-4'>
            <div className='relative shrink-0'>
              <img className='h-24 w-24 rounded-control bg-surface-sunken object-cover sm:h-28 sm:w-28' src={docInfo.image} alt={displayPersonName(docInfo.name)} />
              <RatingBadge summary={summary} className='absolute -bottom-2 start-1/2 -translate-x-1/2 rtl:translate-x-1/2' />
            </div>
            <div className='min-w-0 flex-1'>
              <h1 className='flex flex-wrap items-center gap-2 font-display text-display text-ink'>
                {displayPersonName(docInfo.name)}
                <img className='h-5 w-5' src={assets.verified_icon} alt={t('Verified')} />
              </h1>
              <p className='mt-1 text-body-sm text-ink-2'>{docInfo.degree} · {tc(docInfo.speciality)}</p>
              <div className='mt-2 flex flex-wrap items-center gap-2'>
                {experienceLabel && <Badge tone='neutral'>{experienceLabel}</Badge>}
                {bookable ? <Badge tone='success' dot>{t('Open for booking')}</Badge> : <Badge tone='warning'>{t('Coming Soon')}</Badge>}
              </div>
              {docInfo.about && (
                <button type='button' aria-expanded={aboutOpen} onClick={() => setAboutOpen((open) => !open)} className='mt-2 flex items-center gap-1 text-caption font-semibold text-brand'>
                  <Info className='h-3.5 w-3.5' aria-hidden='true' />
                  {aboutOpen ? t('Hide details') : t('About the doctor')}
                </button>
              )}
            </div>
          </div>
          {aboutOpen && (
            <div className='mt-4 animate-rise border-t border-line pt-4'>
              <p className='whitespace-pre-wrap text-body-sm text-ink-2'>{getTranslatedDoctorAbout(docInfo.about, language, textTranslationOverrides)}</p>
              <button type='button' aria-expanded={ratingsOpen} onClick={() => setRatingsOpen((open) => !open)} className='mt-3 flex items-center gap-2 text-body-sm font-semibold text-ink'>
                <StarRow value={summary?.averageRating} />
                {summary?.ratingCount
                  ? localizeDigits(fill(t('{{avg}} from {{count}} ratings'), { avg: Number(summary.averageRating).toFixed(1), count: summary.ratingCount }))
                  : t('No ratings yet')}
              </button>
              {ratingsOpen && <div className='mt-3'><RatingsList ratings={ratingsData.ratings} /></div>}
            </div>
          )}
        </CardBody>
      </Card>

      {!bookable ? (
        <EmptyState
          icon={<Stethoscope aria-hidden='true' />}
          title={t('Coming Soon')}
          description={t('This doctor is coming soon. Appointments will open after the doctor publishes their schedule.')}
          action={<Button as={Link} to='/doctors' variant='secondary'>{t('Find a doctor')}</Button>}
        />
      ) : (
        <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start'>
          <div className='space-y-4'>
            <StepCard number={localizeDigits('1')} title={t('How would you like to be seen?')} titleId={howTitleId}>
              <div role='radiogroup' aria-labelledby={howTitleId} className='grid grid-cols-2 gap-2 lg:grid-cols-4'>
                {APPOINTMENT_TYPES.map((option) => {
                  const enabled = typeAvailable(option.value)
                  return (
                    <ChoiceCard
                      key={option.value}
                      selected={activeType === option.value}
                      disabled={!enabled}
                      icon={<option.icon />}
                      label={t(option.labelKey)}
                      hint={enabled ? t(option.hintKey) : t('Not Available')}
                      onClick={() => changeBooking(() => {
                        setAppointmentType(option.value)
                        setSelection(null)
                      })}
                    />
                  )
                })}
              </div>

              {canBookConsultation && (
                <div role='radiogroup' aria-label={t('Visit type')} className='mt-3 grid gap-2 sm:grid-cols-2'>
                  <ChoiceCard
                    selected={visitFeeType === 'examination'}
                    icon={<Stethoscope />}
                    label={t('Examination (Kashf)')}
                    hint={t('Examination hint')}
                    onClick={() => changeBooking(() => setVisitFeeType('examination'))}
                  />
                  <ChoiceCard
                    selected={visitFeeType === 'consultation'}
                    icon={<MessageCircle />}
                    label={t('Follow-up consultation (Istishara)')}
                    hint={t('Follow-up consultation hint')}
                    onClick={() => changeBooking(() => setVisitFeeType('consultation'))}
                  />
                </div>
              )}

              {usesBranches && branches.length > 1 && (
                <div role='radiogroup' aria-label={t('Location')} className='mt-3 grid gap-2 sm:grid-cols-2'>
                  {branches.map((location) => {
                    const row = availability?.branches?.find((branch) => branch.location === location)
                    return (
                      <ChoiceCard
                        key={location}
                        selected={selectedBranch === location}
                        icon={<MapPin />}
                        label={formatLocationLine(location, language, t, placeTranslationOverrides)}
                        hint={row?.next
                          ? fill(t('Next: {{when}}'), { when: `${formatRelativeDay(row.next.startsAt, language, undefined, availability.timeZone)} ${formatSlotTime(row.next.slotTime, language, localizeDigits)}` })
                          : undefined}
                        onClick={() => changeBooking(() => {
                          setClinicLocation(location)
                          setSelection(null)
                        })}
                      />
                    )
                  })}
                </div>
              )}

              {needsAddress && (
                <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                  <Field label={t('Choose supported area')} required>
                    <Select
                      value={homeVisitAddress.area}
                      onChange={(event) => changeBooking(() => setHomeVisitAddress((previous) => ({ ...previous, area: event.target.value })))}
                    >
                      <option value=''>{t('Choose supported area')}</option>
                      {homeAreas.map((area) => (
                        <option key={area} value={area}>{translatePlaceSegment(area, language, t, placeTranslationOverrides)}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('Street name and number')} required>
                    <Input value={homeVisitAddress.street} onChange={(event) => changeBooking(() => setHomeVisitAddress((previous) => ({ ...previous, street: event.target.value })))} />
                  </Field>
                  <Field label={t('Building')}>
                    <Input value={homeVisitAddress.building} onChange={(event) => changeBooking(() => setHomeVisitAddress((previous) => ({ ...previous, building: event.target.value })))} />
                  </Field>
                  <div className='grid grid-cols-2 gap-3'>
                    <Field label={t('Floor')}>
                      <Input value={homeVisitAddress.floor} onChange={(event) => changeBooking(() => setHomeVisitAddress((previous) => ({ ...previous, floor: event.target.value })))} />
                    </Field>
                    <Field label={t('Apartment')}>
                      <Input value={homeVisitAddress.apartment} onChange={(event) => changeBooking(() => setHomeVisitAddress((previous) => ({ ...previous, apartment: event.target.value })))} />
                    </Field>
                  </div>
                  <div className='sm:col-span-2'>
                    <Field label={t('Landmark or notes')}>
                      <Textarea rows={2} maxLength={400} value={homeVisitAddress.notes} onChange={(event) => changeBooking(() => setHomeVisitAddress((previous) => ({ ...previous, notes: event.target.value })))} />
                    </Field>
                  </div>
                </div>
              )}
            </StepCard>

            <StepCard number={localizeDigits('2')} title={t('When works for you?')} titleId={whenTitleId} aside={<LiveBadge />}>
              <SlotPicker
                availability={availability}
                loading={loading}
                failed={failed}
                onRetry={refresh}
                selection={selection}
                onSelect={(slot) => changeBooking(() => setSelection(slot))}
                reservedSlot={reservedSlot}
                onJoinWaitlist={handleJoinWaitlist}
                waitlistEntry={waitingEntry}
                joiningWaitlist={joiningWaitlist}
                headingId={whenTitleId}
              />
              <SoonerElsewhere doctors={elsewhere} thisDoctorNext={availability?.nextAvailable} appointmentType={activeType} timeZone={availability?.timeZone} />
            </StepCard>

            <div ref={paymentRef} className='scroll-mt-24'>
              <StepCard number={localizeDigits('3')} title={isFree ? t('This visit is free') : t('How would you like to pay?')} titleId={payTitleId}>
                {isFree ? (
                  <p className='text-body-sm text-ink-2'>{t('Your promo covers the whole fee. There is nothing to pay.')}</p>
                ) : checkout ? (
                  <CheckoutForm
                    amountLabel={formatMoney(checkout.amount)}
                    clientSecret={checkout.clientSecret}
                    holdExpiresAt={checkout.holdExpiresAt}
                    payLabel={t('Pay and book')}
                    onConfirmed={onPaid}
                    onHoldExpired={onHoldExpired}
                    onBack={stopCheckout}
                  />
                ) : (
                  <>
                    <div role='radiogroup' aria-labelledby={payTitleId} className='grid gap-2 sm:grid-cols-3'>
                      <ChoiceCard
                        selected={activeMethod === 'Cash'}
                        disabled={!canUseCash}
                        icon={<Banknote />}
                        label={t('Cash')}
                        hint={canUseCash ? t('Pay at your visit') : t('Doctor does not accept cash')}
                        onClick={() => setPaymentMethod('Cash')}
                      />
                      <ChoiceCard
                        selected={activeMethod === 'Visa'}
                        disabled={!canUseCard}
                        icon={<CreditCard />}
                        label={t('Card')}
                        hint={canUseCard ? t('Pay now, securely') : t('Doctor does not accept card')}
                        onClick={() => setPaymentMethod('Visa')}
                      />
                      <ChoiceCard
                        selected={activeMethod === 'Insurance'}
                        disabled={Boolean(token) && !insuranceReady}
                        icon={<ShieldCheck />}
                        label={t('Insurance')}
                        hint={insuranceReady ? t('Reception confirms your cover') : t('Add your card in your profile')}
                        onClick={() => setPaymentMethod('Insurance')}
                      />
                    </div>
                    {!canUseCash && !canUseCard && <p className='mt-3 text-body-sm text-danger-ink'>{t('Doctor no payment methods')}</p>}
                    {needsAddress && !addressReady && <p className='mt-3 text-body-sm text-warning-ink'>{t('Please enter home visit street')}</p>}
                  </>
                )}
              </StepCard>
            </div>
          </div>

          <aside className='hidden lg:sticky lg:top-24 lg:block'>
            <Card variant='raised'><CardBody>{summaryPanel}</CardBody></Card>
          </aside>
        </div>
      )}

      {/* Phones: price and action always in reach, above the keyboard-safe area */}
      {bookable && !checkout && (
        <div className='fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-e3 lg:hidden'>
          <div className='mx-auto flex max-w-3xl items-center gap-3'>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-caption text-ink-2'>{whenLabel || t('Pick a time')}</p>
              <p className='text-subtitle font-semibold text-brand'>{quote ? formatMoney(quote.amount) : ' '}</p>
            </div>
            <Button size='lg' loading={booking} disabled={token && !readyToBook} onClick={submit}>{ctaLabel}</Button>
          </div>
        </div>
      )}

      <RelatedDoctors docId={docId} speciality={docInfo.speciality} />
    </div>
  )
}

const Appointment = () => {
  const { docId } = useParams()
  const { doctors, getDoctorsData } = useContext(AppContext)
  const docInfo = useMemo(() => doctors.find((doc) => doc._id === docId), [doctors, docId])

  useEffect(() => {
    if (!docInfo) getDoctorsData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  if (!docInfo) return null

  // Keyed by doctor, so moving to another doctor starts with a clean booking.
  return <BookingFlow key={docId} docId={docId} docInfo={docInfo} />
}

export default Appointment
