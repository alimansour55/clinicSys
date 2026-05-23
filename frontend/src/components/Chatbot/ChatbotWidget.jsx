import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import { formatLocationLine } from '../../utils/placeTranslations'
import { isValidEgyptPhone, normalizeEgyptPhone } from '../../utils/egyptPhone'
import {
  isDoctorComingSoon,
  isDoctorBookableForPatients,
  isTeleconsultationType,
  usesClinicWeeklySchedule,
  hasDoctorPublishedSchedule
} from '../../utils/doctorBooking'
import { doctorBelongsToClinicSection } from '../../utils/doctorClinicPlaces'
import { doctorOffersHomeVisit, getDoctorHomeVisitAreas } from '../../utils/homeVisitAreas'
import {
  detectLanguage,
  detectSpecialtyFromMessage,
  filterDoctorsBySpecialty,
  getDoctorLocations,
  getDoctorPrimaryLocation,
  getDoctorSpecialty,
  SPECIALTY_IDS
} from '../../utils/chatbotSpecialty'
import {
  findDoctorsByNameQuery,
  shouldUseDoctorNameSearch
} from '../../utils/chatbotDoctorMatch'
import {
  CHATBOT_APPOINTMENT_TYPES,
  CHATBOT_VISIT_FEE_TYPES,
  computeChatbotTotalPrice,
  getDoctorAppointmentTypeOptions,
  probeDoctorBranchesForType
} from '../../utils/chatbotBookingHelpers'
import axios from 'axios'
import { bookChatbotAppointment } from '../../utils/chatbotApi'
import { useMediaQuery } from '../../utils/useMediaQuery'
import {
  buildClinicSectionSuggestions,
  buildFallbackOpeningSuggestions
} from '../../utils/chatbotOpeningSuggestions'
import {
  buildEmptySpecialtyGuidance,
  specialtyToClinicName
} from '../../utils/chatbotEmptySpecialty'
import {
  captureChatSnapshot,
  canGoBack as navCanGoBack,
  canShowNavControls,
  emptyBookingData,
  getChangeSelectionStep
} from '../../utils/chatbotNavigation'
import { CHAT_STEPS } from '../../utils/chatbotSteps'
import DoctorChatCard from './DoctorChatCard'

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-3 py-2">
    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
  </div>
)

const ChatbotWidget = () => {
  const {
    backendUrl,
    token,
    userData,
    doctors,
    clinics,
    getDoctorsData,
    getClinicsData,
    displayPersonName,
    placeTranslationOverrides,
    currencySymbol,
    siteSettings
  } = useContext(AppContext)
  const isLaptopUp = useMediaQuery('(min-width: 1024px)')
  const { language: siteLanguage, t, tc, localizeDigits } = useLanguage()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [chatLang, setChatLang] = useState(siteLanguage)
  const [chatStep, setChatStep] = useState(CHAT_STEPS.WAITING_SYMPTOMS)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [booking, setBooking] = useState(false)
  const [matchedDoctors, setMatchedDoctors] = useState([])
  const [quickReplies, setQuickReplies] = useState([])
  const [slotDays, setSlotDays] = useState([])
  const [clinicLocation, setClinicLocation] = useState('')
  const [dateOptions, setDateOptions] = useState([])
  const [timeOptions, setTimeOptions] = useState([])
  const [locationOptions, setLocationOptions] = useState([])
  const [appointmentTypeOptions, setAppointmentTypeOptions] = useState([])
  const [homeVisitAreaOptions, setHomeVisitAreaOptions] = useState([])
  const [canBookConsultation, setCanBookConsultation] = useState(false)
  const [selectedClinicSection, setSelectedClinicSection] = useState(null)
  const [navRevision, setNavRevision] = useState(0)

  const [bookingData, setBookingData] = useState(emptyBookingData())

  const listRef = useRef(null)
  const booted = useRef(false)
  const navStackRef = useRef([])
  const skipHistoryRef = useRef(false)

  const isRtl = chatLang === 'ar'
  const L = useCallback(
    (en, ar) => (isRtl ? ar : en),
    [isRtl]
  )

  const pushBot = (content) => {
    setMessages((prev) => [...prev, { role: 'assistant', content }])
  }

  const pushUser = (content) => {
    setMessages((prev) => [...prev, { role: 'user', content }])
  }

  const withTyping = async (fn) => {
    setTyping(true)
    await new Promise((r) => setTimeout(r, 350))
    try {
      await fn()
    } finally {
      setTyping(false)
    }
  }

  const translateLoc = (loc) =>
    formatLocationLine(loc, isRtl ? 'ar' : 'en', t, placeTranslationOverrides)

  const formatDoctorFee = (doctor) => {
    const amount = Number(doctor?.fees)
    if (!Number.isFinite(amount) || amount <= 0) return ''
    return `${currencySymbol}${localizeDigits(String(amount))}`
  }

  const formatDoctorLocationsLine = (doctor) => {
    const locs = getDoctorLocations(doctor)
    if (!locs.length) {
      const fallback = getDoctorPrimaryLocation(doctor)
      return fallback ? translateLoc(fallback) : t('Clinic location')
    }
    return locs.map((loc) => translateLoc(loc)).join(' · ')
  }

  const initialGreeting = () =>
    L(
      'Hi 👋 Choose a clinic section below, or describe your symptoms to book.',
      'أهلاً 👋 اختار قسم العيادة من الأسفل، أو اكتب أعراضك للحجز.'
    )

  const clinicSectionSuggestions = useMemo(
    () =>
      buildClinicSectionSuggestions({
        doctors,
        clinics,
        t,
        tc,
        language: chatLang,
        placeTranslationOverrides
      }),
    [doctors, clinics, t, tc, chatLang, placeTranslationOverrides]
  )

  const fallbackQuickReplies = () =>
    clinicSectionSuggestions.length
      ? clinicSectionSuggestions
      : buildFallbackOpeningSuggestions(chatLang)

  const audienceQuickReplies = () => [
    { id: 'adult', label: L('Adult', 'شخص بالغ'), specialty: SPECIALTY_IDS.GENERAL },
    { id: 'child', label: L('Child', 'طفل'), specialty: SPECIALTY_IDS.PEDIATRICIANS }
  ]

  useEffect(() => {
    if (!open) return
    if (booted.current) return
    booted.current = true
    setChatLang(siteLanguage)
    setMessages([{ role: 'assistant', content: initialGreeting() }])
    setChatStep(CHAT_STEPS.WAITING_SYMPTOMS)
    setQuickReplies(buildFallbackOpeningSuggestions(siteLanguage))
    getDoctorsData?.()
    getClinicsData?.()
  }, [open, siteLanguage])

  useEffect(() => {
    if (!open || chatStep !== CHAT_STEPS.WAITING_SYMPTOMS) return
    if (matchedDoctors.length > 0 || typing || booking) return
    const next = clinicSectionSuggestions.length
      ? clinicSectionSuggestions
      : buildFallbackOpeningSuggestions(chatLang)
    setQuickReplies(next)
  }, [open, chatStep, clinicSectionSuggestions, matchedDoctors.length, typing, booking, chatLang])

  const getSnapshot = () =>
    captureChatSnapshot({
      chatStep,
      bookingData,
      matchedDoctors,
      quickReplies,
      slotDays,
      clinicLocation,
      dateOptions,
      timeOptions,
      locationOptions,
      appointmentTypeOptions,
      homeVisitAreaOptions,
      canBookConsultation,
      selectedClinicSection
    })

  const pushHistory = () => {
    if (skipHistoryRef.current) return
    navStackRef.current.push(getSnapshot())
    setNavRevision((n) => n + 1)
  }

  const restoreSnapshot = (snap) => {
    skipHistoryRef.current = true
    setChatStep(snap.chatStep)
    setBookingData(snap.bookingData)
    setMatchedDoctors(snap.matchedDoctors || [])
    setQuickReplies(snap.quickReplies || [])
    setSlotDays(snap.slotDays || [])
    setClinicLocation(snap.clinicLocation || '')
    setDateOptions(snap.dateOptions || [])
    setTimeOptions(snap.timeOptions || [])
    setLocationOptions(snap.locationOptions || [])
    setAppointmentTypeOptions(snap.appointmentTypeOptions || [])
    setHomeVisitAreaOptions(snap.homeVisitAreaOptions || [])
    setCanBookConsultation(Boolean(snap.canBookConsultation))
    setSelectedClinicSection(snap.selectedClinicSection || null)
    skipHistoryRef.current = false
    setNavRevision((n) => n + 1)
  }

  const clearBookingFlow = (keepProfile = true) => {
    setMatchedDoctors([])
    setSlotDays([])
    setClinicLocation('')
    setDateOptions([])
    setTimeOptions([])
    setLocationOptions([])
    setAppointmentTypeOptions([])
    setHomeVisitAreaOptions([])
    setCanBookConsultation(false)
    setSelectedClinicSection(null)
    setBookingData((b) => ({
      ...emptyBookingData(),
      patientName: keepProfile ? b.patientName : '',
      phone: keepProfile ? b.phone : ''
    }))
  }

  const resetToClinicSections = (botMessage) => {
    navStackRef.current = []
    setNavRevision((n) => n + 1)
    clearBookingFlow(true)
    setChatStep(CHAT_STEPS.WAITING_SYMPTOMS)
    setQuickReplies(fallbackQuickReplies())
    if (botMessage) pushBot(botMessage)
  }

  const handleStartOver = () => {
    pushUser(L('Start Over', 'البدء من جديد'))
    resetToClinicSections(
      L(
        'Starting fresh. Choose a clinic section or describe your symptoms.',
        'بدأنا من جديد. اختار قسم العيادة أو اكتب أعراضك.'
      )
    )
  }

  const handleGoBack = () => {
    const prev = navStackRef.current.pop()
    if (!prev) return
    setNavRevision((n) => n + 1)
    pushUser(L('⬅ Back', '⬅ الرجوع'))
    restoreSnapshot(prev)
    pushBot(
      L('Back to the previous step. You can adjust your choice.', 'رجعنا للخطوة السابقة. تقدر تعدّل اختيارك.')
    )
  }

  const reShowDoctorList = async () => {
    if (selectedClinicSection) {
      await showDoctorsForClinic(
        selectedClinicSection.name,
        selectedClinicSection.id,
        selectedClinicSection.label,
        { skipHistory: true }
      )
      return
    }
    if (bookingData.detectedSpecialty) {
      await showDoctorsForSpecialty(bookingData.detectedSpecialty, bookingData.symptoms, {
        skipHistory: true
      })
      return
    }
    resetToClinicSections(
      L('Choose a clinic section:', 'اختار قسم العيادة:')
    )
  }

  const rebuildAppointmentTypeStep = () => {
    const doctor = bookingData.selectedDoctor
    if (!doctor) {
      resetToClinicSections()
      return
    }
    const options = getDoctorAppointmentTypeOptions(doctor)
    setDateOptions([])
    setTimeOptions([])
    setLocationOptions([])
    setHomeVisitAreaOptions([])
    setAppointmentTypeOptions(options)
    setChatStep(CHAT_STEPS.WAITING_APPOINTMENT_TYPE)
    pushBot(
      L(
        `How would you like to visit ${displayPersonName(doctor.name)}?`,
        `إزاي تحب الزيارة مع ${displayPersonName(doctor.name)}؟`
      )
    )
  }

  const rebuildDateStep = () => {
    applySlotDays(slotDays)
    setTimeOptions([])
    setBookingData((b) => ({ ...b, time: '', slotDate: '', date: null }))
    setChatStep(CHAT_STEPS.WAITING_DATE)
    pushBot(L('Pick a date:', 'اختار التاريخ:'))
  }

  const rebuildTimeStep = () => {
    const day = slotDays.find((d) => d.slotDate === bookingData.slotDate)
    const times = day?.slots || []
    setDateOptions([])
    setTimeOptions(times)
    setBookingData((b) => ({ ...b, time: '' }))
    setChatStep(CHAT_STEPS.WAITING_TIME)
    pushBot(L('Please choose a time:', 'اختار الوقت المناسب:'))
  }

  const handleChangeSelection = async () => {
    pushUser(L('Change Selection', 'تغيير الاختيار'))
    const target = getChangeSelectionStep(chatStep)

    await withTyping(async () => {
      if (target === CHAT_STEPS.SHOWING_DOCTORS) {
        await reShowDoctorList()
        return
      }

      if (target === CHAT_STEPS.WAITING_SYMPTOMS) {
        resetToClinicSections(
          L('Choose a clinic section:', 'اختار قسم العيادة:')
        )
        return
      }

      if (target === CHAT_STEPS.WAITING_APPOINTMENT_TYPE) {
        rebuildAppointmentTypeStep()
        return
      }

      if (target === CHAT_STEPS.WAITING_DATE) {
        rebuildDateStep()
        return
      }

      if (target === CHAT_STEPS.WAITING_TIME) {
        rebuildTimeStep()
      }
    })
  }

  const showNavBar = canShowNavControls(chatStep)
  const backEnabled = navCanGoBack(chatStep, navStackRef.current.length)

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!open || !isLaptopUp) {
      document.body.classList.remove('chatbot-open')
      return
    }
    document.body.classList.add('chatbot-open')
    return () => document.body.classList.remove('chatbot-open')
  }, [open, isLaptopUp])

  useEffect(() => {
    if (userData?.name) {
      setBookingData((b) => ({ ...b, patientName: userData.name }))
    }
    if (userData?.phone) {
      setBookingData((b) => ({ ...b, phone: userData.phone }))
    }
  }, [userData])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [
    messages,
    typing,
    matchedDoctors,
    quickReplies,
    dateOptions,
    timeOptions,
    locationOptions,
    appointmentTypeOptions,
    homeVisitAreaOptions,
    chatStep
  ])

  const resolveDoctorsList = async () => {
    if (doctors?.length) return doctors
    try {
      await getDoctorsData?.()
      if (doctors?.length) return doctors
      const { data } = await axios.get(`${backendUrl}/api/doctor/list`, {
        params: { _t: Date.now() }
      })
      if (data?.success && Array.isArray(data.doctors)) return data.doctors
    } catch {
      /* handled below */
    }
    return []
  }

  const showNoDoctorsGuidance = (emptyClinicName, emptyClinicId = null, messageOverride = '') => {
    const guidance = buildEmptySpecialtyGuidance({
      doctors,
      clinics,
      emptyClinicName,
      emptyClinicId,
      language: chatLang,
      t,
      tc,
      placeTranslationOverrides,
      messageOverride
    })

    setMatchedDoctors([])
    setChatStep(CHAT_STEPS.SUGGESTING_ALTERNATIVES)

    if (guidance.suggestions.length) {
      setQuickReplies(guidance.suggestions)
      pushBot(guidance.message)
      return
    }

    pushBot(
      L(
        `${guidance.message}\n\nPlease try again later or contact the clinic.`,
        `${guidance.message}\n\nحاول مرة أخرى لاحقاً أو تواصل مع العيادة.`
      )
    )
    setQuickReplies(fallbackQuickReplies())
    setChatStep(CHAT_STEPS.WAITING_SYMPTOMS)
  }

  const showDoctorsForSpecialty = async (specialty, symptomsText, options = {}) => {
    if (!options.skipHistory) pushHistory()
    const source = await resolveDoctorsList()
    if (!source.length) {
      pushBot(
        L(
          'Sorry, I could not load doctors right now. Please try again later.',
          'آسف، لم أتمكن من تحميل الدكاترة حالياً. حاول مرة أخرى لاحقاً.'
        )
      )
      return
    }

    let list = filterDoctorsBySpecialty(source, specialty)

    if (!list.length) {
      showNoDoctorsGuidance(specialtyToClinicName(specialty))
      return
    }

    setBookingData((b) => ({
      ...b,
      symptoms: symptomsText || b.symptoms,
      detectedSpecialty: specialty
    }))
    setMatchedDoctors(list)
    setQuickReplies([])
    setChatStep(CHAT_STEPS.SHOWING_DOCTORS)
    pushBot(
      L(
        'I found doctors that match your case. Please choose one:',
        'لقيت دكاترة مناسبين لحالتك. اختار دكتور من القائمة:'
      )
    )
  }

  const showMatchedDoctors = (list, symptomsText = '', options = {}) => {
    if (!options.skipHistory) pushHistory()
    setBookingData((b) => ({
      ...b,
      symptoms: symptomsText || b.symptoms
    }))
    setMatchedDoctors(list)
    setQuickReplies([])
    setChatStep(CHAT_STEPS.SHOWING_DOCTORS)
    pushBot(
      list.length === 1
        ? L('Here is the doctor you asked for:', 'ده الدكتور اللي طلبته:')
        : L('I found these doctors. Please choose one:', 'لقيت الدكاترة دول. اختار واحد:')
    )
  }

  const handleSymptomMessage = async (text) => {
    const lang = detectLanguage(text)
    setChatLang(lang)

    const source = await resolveDoctorsList()
    const byName = findDoctorsByNameQuery(source, text)
    if (shouldUseDoctorNameSearch(text, byName)) {
      showMatchedDoctors(byName, text)
      return
    }

    const { specialty, needsClarification } = detectSpecialtyFromMessage(text)

    if (needsClarification === 'adult_or_child') {
      pushHistory()
      setChatStep(CHAT_STEPS.CLARIFY_AUDIENCE)
      setQuickReplies(audienceQuickReplies())
      pushBot(
        L('Is this for an adult or a child?', 'هل المشكلة لشخص بالغ أم لطفل؟')
      )
      return
    }

    if (!specialty) {
      setQuickReplies(fallbackQuickReplies())
      pushBot(
        L(
          'Can you describe your problem? Or choose a clinic section above.',
          'ممكن توضح المشكلة؟ أو اختار قسم العيادة من الأقسام بالأعلى.'
        )
      )
      return
    }

    await showDoctorsForSpecialty(specialty, text)
  }

  const showDoctorsForClinic = async (clinicName, clinicId, label, options = {}) => {
    if (!options.skipHistory) pushHistory()
    setSelectedClinicSection({ name: clinicName, id: clinicId, label })
    const source = await resolveDoctorsList()
    const list = source.filter(
      (doctor) =>
        isDoctorBookableForPatients(doctor) &&
        !isDoctorComingSoon(doctor) &&
        doctorBelongsToClinicSection(doctor, clinicName, { clinicId })
    )

    if (!list.length) {
      showNoDoctorsGuidance(clinicName, clinicId)
      return
    }

    setBookingData((b) => ({ ...b, symptoms: label, detectedSpecialty: '' }))
    showMatchedDoctors(list, label)
  }

  const showDoctorsForService = async (service, label) => {
    const source = await resolveDoctorsList()
    let list = []

    if (service === 'teleconsultation') {
      list = source.filter(
        (doctor) =>
          isDoctorBookableForPatients(doctor) &&
          !isDoctorComingSoon(doctor) &&
          hasDoctorPublishedSchedule(doctor) &&
          (doctor.acceptsVoiceCall !== false || doctor.acceptsVideoCall !== false)
      )
    } else if (service === 'home') {
      list = source.filter(
        (doctor) =>
          isDoctorBookableForPatients(doctor) &&
          !isDoctorComingSoon(doctor) &&
          doctorOffersHomeVisit(doctor)
      )
    }

    if (!list.length) {
      showNoDoctorsGuidance(
        '',
        null,
        L(
          'No doctors are available for this service right now. Here are other options:',
          'لا يوجد أطباء متاحين لهذه الخدمة حالياً. إليك خيارات أخرى:'
        )
      )
      return
    }

    setBookingData((b) => ({ ...b, symptoms: label }))
    showMatchedDoctors(list, label)
  }

  const handleQuickReply = async (reply) => {
    pushUser(reply.label)
    setQuickReplies([])

    await withTyping(async () => {
      if (reply.kind === 'clinic') {
        await showDoctorsForClinic(reply.clinicName, reply.clinicId, reply.label)
        return
      }

      if (reply.kind === 'doctor') {
        const source = await resolveDoctorsList()
        const doc = source.find((d) => String(d._id) === String(reply.doctorId))
        if (doc) showMatchedDoctors([doc], reply.label)
        else {
          pushBot(
            L('Sorry, that doctor is not available right now.', 'آسف، الدكتور ده مش متاح حالياً.')
          )
          setQuickReplies(fallbackQuickReplies())
        }
        return
      }

      if (reply.kind === 'service') {
        await showDoctorsForService(reply.service, reply.label)
        return
      }

      if (chatStep === CHAT_STEPS.CLARIFY_AUDIENCE) {
        await showDoctorsForSpecialty(reply.specialty, bookingData.symptoms)
        return
      }

      await showDoctorsForSpecialty(reply.specialty, reply.label)
    })
  }

  const applySlotDays = (days) => {
    setSlotDays(days)
    setDateOptions(
      days.map((d) => ({
        slotDate: d.slotDate,
        date: d.date,
        label: new Date(d.date).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
      }))
    )
  }

  const beginSlotSelection = (doctor, appointmentType, days, branch = '') => {
    pushHistory()
    if (branch && !isTeleconsultationType(appointmentType)) setClinicLocation(branch)
    else if (isTeleconsultationType(appointmentType)) setClinicLocation('')
    applySlotDays(days)
    setChatStep(CHAT_STEPS.WAITING_DATE)
    const typeLabel = t(
      CHATBOT_APPOINTMENT_TYPES.find((o) => o.value === appointmentType)?.labelKey || 'In clinic'
    )
    pushBot(
      L(
        `Available times for ${typeLabel}. What date works for you?`,
        `المواعيد المتاحة لـ ${typeLabel}. اختار اليوم المناسب:`
      )
    )
  }

  const afterAppointmentTypeChosen = async (doctor, appointmentType) => {
    if (appointmentType === 'Home Visit') {
      const areas = getDoctorHomeVisitAreas(doctor)
      if (areas.length > 1) {
        pushHistory()
        setHomeVisitAreaOptions(areas)
        setChatStep(CHAT_STEPS.WAITING_HOME_AREA)
        pushBot(L('Please choose your area for the home visit:', 'اختار المنطقة لزيارة المنزل:'))
        return
      }
      if (areas.length === 1) {
        setBookingData((b) => ({ ...b, homeVisitArea: areas[0] }))
      }
    }

    const result = probeDoctorBranchesForType(doctor, appointmentType, 14)

    if (result.mode === 'empty') {
      pushBot(
        L(
          'No available slots for this visit type right now. Try another option or doctor.',
          'مفيش مواعيد متاحة لنوع الزيارة ده حالياً. جرب خيار أو دكتور تاني.'
        )
      )
      setAppointmentTypeOptions(getDoctorAppointmentTypeOptions(doctor))
      setChatStep(CHAT_STEPS.WAITING_APPOINTMENT_TYPE)
      return
    }

    if (result.mode === 'pick_branch') {
      pushHistory()
      setLocationOptions(result.branches)
      setChatStep(CHAT_STEPS.WAITING_LOCATION)
      pushBot(
        L(
          `${displayPersonName(doctor.name)} works at more than one clinic. Please choose a location:`,
          `${displayPersonName(doctor.name)} متاح في أكثر من فرع. اختار فرع العيادة:`
        )
      )
      return
    }

    beginSlotSelection(doctor, appointmentType, result.days, result.branch || '')
  }

  const chooseAppointmentType = async (type) => {
    const doctor = bookingData.selectedDoctor
    if (!doctor) return
    pushHistory()
    const label = t(CHATBOT_APPOINTMENT_TYPES.find((o) => o.value === type)?.labelKey || type)
    pushUser(label)
    setAppointmentTypeOptions([])
    setBookingData((b) => ({
      ...b,
      appointmentType: type,
      date: null,
      slotDate: '',
      time: ''
    }))
    setLocationOptions([])
    setDateOptions([])
    setTimeOptions([])
    if (!usesClinicWeeklySchedule(type) || isTeleconsultationType(type)) setClinicLocation('')

    await withTyping(() => afterAppointmentTypeChosen(doctor, type))
  }

  const chooseHomeArea = async (area) => {
    pushUser(area)
    setHomeVisitAreaOptions([])
    setBookingData((b) => ({ ...b, homeVisitArea: area }))
    const doctor = bookingData.selectedDoctor
    if (!doctor) return

    await withTyping(() => {
      const result = probeDoctorBranchesForType(doctor, 'Home Visit', 14)
      if (result.mode === 'empty') {
        pushBot(
          L('No home visit slots available right now.', 'مفيش مواعيد زيارة منزلية متاحة حالياً.')
        )
        return
      }
      beginSlotSelection(doctor, 'Home Visit', result.days, result.branch || '')
    })
  }

  const chooseLocation = async (branch) => {
    const doctor = bookingData.selectedDoctor
    if (!doctor) return
    setClinicLocation(branch.loc)
    setLocationOptions([])
    pushUser(translateLoc(branch.loc))
    beginSlotSelection(doctor, bookingData.appointmentType, branch.days, branch.loc)
  }

  const chooseDoctor = async (doctor) => {
    if (isDoctorComingSoon(doctor)) return
    pushHistory()

    setBookingData((b) => ({
      ...b,
      selectedDoctor: doctor,
      appointmentType: 'Clinic',
      visitFeeType: 'examination',
      homeVisitArea: '',
      date: null,
      slotDate: '',
      time: ''
    }))
    setMatchedDoctors([])
    setLocationOptions([])
    setDateOptions([])
    setTimeOptions([])
    setHomeVisitAreaOptions([])
    setClinicLocation('')

    await withTyping(async () => {
      const options = getDoctorAppointmentTypeOptions(doctor)
      if (!options.length) {
        pushBot(
          L(
            'This doctor has no booking options available right now.',
            'الدكتور ده مش متاح للحجز حالياً.'
          )
        )
        setChatStep(CHAT_STEPS.WAITING_SYMPTOMS)
        return
      }

      if (options.length === 1) {
        setBookingData((b) => ({ ...b, appointmentType: options[0].value }))
        await afterAppointmentTypeChosen(doctor, options[0].value)
        return
      }

      setAppointmentTypeOptions(options)
      setChatStep(CHAT_STEPS.WAITING_APPOINTMENT_TYPE)
      pushBot(
        L(
          `You chose ${displayPersonName(doctor.name)}. How would you like to visit?`,
          `اخترت ${displayPersonName(doctor.name)}. إزاي تحب الزيارة تكون؟`
        )
      )
    })
  }

  const chooseDate = (opt) => {
    pushHistory()
    const day = slotDays.find((d) => d.slotDate === opt.slotDate)
    const times = day?.slots || []
    if (!times.length) {
      pushBot(L('No times on this day. Pick another date.', 'مفيش مواعيد في اليوم ده. اختار يوم تاني.'))
      return
    }

    setBookingData((b) => ({
      ...b,
      slotDate: opt.slotDate,
      date: opt.date,
      time: ''
    }))
    setDateOptions([])
    setTimeOptions(times)
    setChatStep(CHAT_STEPS.WAITING_TIME)
    pushUser(opt.label)
    pushBot(L('Please choose a time:', 'اختار الوقت المناسب:'))
  }

  const loadVisitFeeStep = async (next) => {
    if (!token) {
      pushBot(
        L('Please log in to complete your booking.', 'يرجى تسجيل الدخول لإتمام الحجز.')
      )
      toast.info(L('Please log in to complete booking', 'يرجى تسجيل الدخول لإتمام الحجز'))
      navigate('/login')
      return
    }

    const name = userData?.name || next.patientName || ''
    const phone = userData?.phone || next.phone || ''
    if (!name.trim() || !phone.trim()) {
      pushBot(
        L(
          'Your profile is missing name or phone. Please update your profile first.',
          'ملفك ناقص الاسم أو رقم الهاتف. حدّث بياناتك من الملف الشخصي أولاً.'
        )
      )
      return
    }

    setBookingData((b) => ({ ...b, ...next, patientName: name, phone }))

    let canConsult = false
    try {
      const { data } = await axios.get(
        `${backendUrl}/api/user/visit-fee-eligibility/${next.selectedDoctor._id}`,
        { headers: { token } }
      )
      canConsult = Boolean(data?.canBookConsultation)
    } catch {
      canConsult = false
    }
    setCanBookConsultation(canConsult)

    if (!canConsult) {
      const auto = { ...next, patientName: name, phone, visitFeeType: 'examination' }
      setBookingData((b) => ({ ...b, ...auto }))
      goToConfirm(auto, { skipHistory: true })
      return
    }

    pushHistory()
    setChatStep(CHAT_STEPS.WAITING_VISIT_FEE)
    pushBot(
      L(
        'Please choose visit type: examination or follow-up consultation.',
        'اختار نوع الزيارة: كشف أو استشارة متابعة.'
      )
    )
  }

  const chooseVisitFeeType = (visitFeeType) => {
    const label = t(
      CHATBOT_VISIT_FEE_TYPES.find((o) => o.value === visitFeeType)?.labelKey || 'Examination (Kashf)'
    )
    pushUser(label)
    const next = { ...bookingData, visitFeeType }
    setBookingData(next)
    goToConfirm(next)
  }

  const chooseTime = (slot) => {
    pushHistory()
    if (slot.branch) setClinicLocation(slot.branch)

    const next = {
      ...bookingData,
      time: slot.time,
      patientName: userData?.name || bookingData.patientName || '',
      phone: userData?.phone || bookingData.phone || ''
    }
    setBookingData(next)
    setTimeOptions([])
    pushUser(localizeDigits(slot.time))
    loadVisitFeeStep(next)
  }

  const goToConfirm = (data = bookingData, options = {}) => {
    if (!options.skipHistory) pushHistory()
    setChatStep(CHAT_STEPS.CONFIRMING)
    const d = data.selectedDoctor
    const dateLabel = data.date
      ? new Date(data.date).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        })
      : ''
    const branchLine =
      usesClinicWeeklySchedule(data.appointmentType) &&
      !isTeleconsultationType(data.appointmentType) &&
      clinicLocation
        ? translateLoc(clinicLocation)
        : ''
    const appointmentLabel = t(
      CHATBOT_APPOINTMENT_TYPES.find((o) => o.value === data.appointmentType)?.labelKey ||
        'In clinic'
    )
    const visitLabel = t(
      CHATBOT_VISIT_FEE_TYPES.find((o) => o.value === data.visitFeeType)?.labelKey ||
        'Examination (Kashf)'
    )
    const { total } = computeChatbotTotalPrice({
      doctor: d,
      visitFeeType: data.visitFeeType,
      appointmentType: data.appointmentType,
      siteSettings
    })
    const totalStr =
      total > 0 ? `${currencySymbol}${localizeDigits(String(total))}` : L('Free', 'مجاني')
    const homeLine =
      data.appointmentType === 'Home Visit' && data.homeVisitArea
        ? `\n• ${L('Area', 'المنطقة')}: ${data.homeVisitArea}`
        : ''

    pushBot(
      L(
        `Booking summary:\n• Patient: ${data.patientName}\n• Phone: ${data.phone}\n• Doctor: ${displayPersonName(d?.name)}\n• Specialty: ${tc(getDoctorSpecialty(d))}\n• Visit: ${appointmentLabel}\n• Visit type: ${visitLabel}${branchLine ? `\n• Clinic: ${branchLine}` : ''}${homeLine}\n• Date: ${dateLabel}\n• Time: ${data.time}\n• Total price: ${totalStr}\n\nTap Confirm to book.`,
        `ملخص الحجز:\n• المريض: ${data.patientName}\n• الهاتف: ${localizeDigits(data.phone)}\n• الدكتور: ${displayPersonName(d?.name)}\n• التخصص: ${tc(getDoctorSpecialty(d))}\n• الزيارة: ${appointmentLabel}\n• نوع الكشف: ${visitLabel}${branchLine ? `\n• الفرع: ${branchLine}` : ''}${homeLine}\n• التاريخ: ${dateLabel}\n• الوقت: ${localizeDigits(data.time)}\n• الإجمالي: ${totalStr}\n\nاضغط تأكيد لإتمام الحجز.`
      )
    )
  }

  const submitBooking = async () => {
    const { selectedDoctor, slotDate, time, patientName, phone, symptoms } = bookingData
    if (!selectedDoctor || !slotDate || !time) return

    if (!token) {
      toast.info(L('Please log in to complete booking', 'يرجى تسجيل الدخول لإتمام الحجز'))
      navigate('/login')
      return
    }

    const profileName = userData?.name || patientName || ''
    const profilePhone = userData?.phone || phone || ''
    if (!profileName.trim() || !profilePhone.trim()) {
      pushBot(
        L('Please complete your profile (name and phone) first.', 'أكمل بيانات ملفك (الاسم والهاتف) أولاً.')
      )
      return
    }

    if (!isValidEgyptPhone(profilePhone)) {
      pushBot(L('Your profile phone number is not valid.', 'رقم الهاتف في ملفك غير صحيح.'))
      return
    }

    setBooking(true)
    try {
      const data = await bookChatbotAppointment(
        backendUrl,
        {
          docId: selectedDoctor._id,
          slotDate,
          slotTime: time,
          clinicLocation,
          appointmentType: bookingData.appointmentType || 'Clinic',
          visitFeeType: bookingData.visitFeeType || 'examination',
          homeVisitAddress:
            bookingData.appointmentType === 'Home Visit' && bookingData.homeVisitArea
              ? { area: bookingData.homeVisitArea }
              : {},
          paymentMethod: 'Cash',
          symptoms,
          patientName: profileName.trim(),
          patientPhone: normalizeEgyptPhone(profilePhone) || profilePhone
        },
        token
      )

      if (data.needLogin || data.needRegistration) {
        toast.info(data.message)
        navigate('/login')
        return
      }

      if (!data.success) {
        setChatStep(CHAT_STEPS.FAILED)
        pushBot(
          L(
            'Sorry, the booking was not completed. Please try again.',
            'آسف، لم يتم تأكيد الحجز. حاول مرة أخرى.'
          )
        )
        return
      }

      setChatStep(CHAT_STEPS.SUCCESS)
      pushBot(
        L(
          `Booking confirmed! Reservation number: ${data.reservationNumber}`,
          `تم تأكيد الحجز! رقم الحجز: ${localizeDigits(String(data.reservationNumber || ''))}`
        )
      )
      toast.success(L('Booking confirmed', 'تم تأكيد الحجز'))
    } catch {
      setChatStep(CHAT_STEPS.FAILED)
      pushBot(
        L(
          'Sorry, the booking was not completed. Please try again.',
          'آسف، لم يتم تأكيد الحجز. حاول مرة أخرى.'
        )
      )
    } finally {
      setBooking(false)
    }
  }

  const handleTextSubmit = async () => {
    const text = input.trim()
    if (!text || typing) return
    setInput('')
    pushUser(text)

    await withTyping(async () => {
      switch (chatStep) {
        case CHAT_STEPS.WAITING_SYMPTOMS:
        case CHAT_STEPS.CLARIFY_AUDIENCE:
          await handleSymptomMessage(text)
          break

        case CHAT_STEPS.WAITING_DATE: {
          const match = dateOptions.find(
            (d) =>
              d.label.toLowerCase().includes(text.toLowerCase()) ||
              text.includes(d.slotDate)
          )
          if (match) chooseDate(match)
          else {
            pushBot(
              L('Please tap one of the date buttons below.', 'من فضلك اختار التاريخ من الأزرار بالأسفل.')
            )
          }
          break
        }

        case CHAT_STEPS.WAITING_LOCATION:
          pushBot(
            L(
              'Please tap one of the clinic locations below.',
              'من فضلك اختار فرع العيادة من الأزرار بالأسفل.'
            )
          )
          break

        case CHAT_STEPS.WAITING_TIME: {
          const match = timeOptions.find((s) =>
            s.time.toLowerCase().includes(text.toLowerCase())
          )
          if (match) chooseTime(match)
          else {
            pushBot(
              L('Please tap one of the time buttons below.', 'من فضلك اختار الوقت من الأزرار بالأسفل.')
            )
          }
          break
        }

        case CHAT_STEPS.WAITING_VISIT_FEE:
          pushBot(
            L(
              'Please tap examination or follow-up below.',
              'من فضلك اختار كشف أو استشارة من الأزرار بالأسفل.'
            )
          )
          break

        case CHAT_STEPS.WAITING_APPOINTMENT_TYPE:
          pushBot(
            L(
              'Please tap how you would like to visit (clinic, home, voice, or video).',
              'اختار نوع الزيارة من الأزرار (عيادة، منزل، صوت، فيديو).'
            )
          )
          break

        case CHAT_STEPS.WAITING_HOME_AREA:
          pushBot(
            L('Please tap your area below.', 'اختار المنطقة من الأزرار بالأسفل.')
          )
          break

        default:
          if (
            chatStep === CHAT_STEPS.SHOWING_DOCTORS ||
            chatStep === CHAT_STEPS.WAITING_SYMPTOMS
          ) {
            await handleSymptomMessage(text)
          }
          break
      }
    })
  }

  const showConfirmButton = chatStep === CHAT_STEPS.CONFIRMING

  const panel = (
    <div
      className={`chatbot-panel fixed z-[9998] flex flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl transition-all
        left-2 right-2 bottom-[4.5rem] h-[min(85dvh,680px)] min-h-[min(520px,85dvh)] max-h-[min(85dvh,calc(100dvh-5rem))] rounded-2xl
        sm:left-auto sm:right-6 sm:bottom-6 sm:w-[min(100%,400px)]
        ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}
      `}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900">
            {L('Clinic Assistant', 'مساعد العيادة')}
          </p>
          <p className="text-[11px] text-gray-500">{L('Online', 'متصل')}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label={L('Close', 'إغلاق')}
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div
        ref={listRef}
        className="min-h-[min(300px,45dvh)] flex-1 overflow-y-auto overscroll-contain bg-slate-50 p-3"
      >
        <div className="flex flex-col gap-2">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'rounded-br-md bg-primary text-white'
                    : 'rounded-bl-md border border-gray-200 bg-white text-gray-800 shadow-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <TypingIndicator />
              </div>
            </div>
          )}

          {matchedDoctors.length > 0 && (
            <div className="space-y-2">
              {matchedDoctors.map((doc) => (
                <DoctorChatCard
                  key={doc._id}
                  doctor={doc}
                  displayName={displayPersonName(doc.name)}
                  specialtyLabel={tc(getDoctorSpecialty(doc))}
                  locationLabel={translateLoc(getDoctorPrimaryLocation(doc))}
                  locationsLabel={formatDoctorLocationsLine(doc)}
                  feeHintLabel={L('Consultation fee', 'رسوم الكشف')}
                  feesLabel={formatDoctorFee(doc)}
                  chooseLabel={L('Choose this doctor', 'اختر هذا الطبيب')}
                  unavailableLabel={L(
                    'Not available for booking yet',
                    'غير متاح للحجز حالياً'
                  )}
                  comingSoonLabel={t('Coming Soon')}
                  availableLabel={t('Available')}
                  notAvailableLabel={t('Not Available')}
                  isRtl={isRtl}
                  onChoose={chooseDoctor}
                />
              ))}
            </div>
          )}

          {quickReplies.length > 0 && chatStep === CHAT_STEPS.SUGGESTING_ALTERNATIVES && (
            <div className="space-y-2.5 rounded-xl border border-amber-100 bg-gradient-to-b from-amber-50 to-white p-3 shadow-sm">
              <p className="text-xs font-bold text-amber-900">
                {L('Suggested options', 'خيارات مقترحة')}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {quickReplies.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleQuickReply(q)}
                    className={`rounded-xl border px-3 py-3 text-left text-xs font-semibold leading-snug shadow-sm transition ${
                      q.isFallback
                        ? 'border-primary bg-primary text-white hover:bg-primary/90'
                        : 'border-emerald-200 bg-white text-emerald-900 hover:border-emerald-400'
                    }`}
                  >
                    <span className="block">{q.label}</span>
                    {q.isFallback && (
                      <span
                        className={`mt-1 block text-[10px] font-medium ${
                          q.isFallback ? 'text-white/90' : 'text-gray-500'
                        }`}
                      >
                        {L('Initial evaluation', 'للتقييم المبدئي')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {quickReplies.length > 0 && chatStep === CHAT_STEPS.WAITING_SYMPTOMS && (
            <div className="space-y-2.5">
              <p className="px-0.5 text-xs font-bold text-gray-800">
                {L('Clinic sections', 'أقسام العيادات')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {quickReplies.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleQuickReply(q)}
                    className="min-h-[3.25rem] rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2.5 text-left text-xs font-semibold leading-snug text-emerald-900 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-100"
                  >
                    <span className="line-clamp-2">{q.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {quickReplies.length > 0 && chatStep !== CHAT_STEPS.WAITING_SYMPTOMS && (
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handleQuickReply(q)}
                  className="rounded-full border border-primary/30 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm hover:bg-primary/5"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {appointmentTypeOptions.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {appointmentTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => chooseAppointmentType(opt.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-xs font-semibold text-gray-800 shadow-sm hover:border-primary"
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          )}

          {homeVisitAreaOptions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {homeVisitAreaOptions.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => chooseHomeArea(area)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold shadow-sm hover:border-primary"
                >
                  {area}
                </button>
              ))}
            </div>
          )}

          {chatStep === CHAT_STEPS.WAITING_VISIT_FEE && (
            <div className="flex flex-col gap-2">
              {CHATBOT_VISIT_FEE_TYPES.map((opt) => {
                const disabled = opt.value === 'consultation' && !canBookConsultation
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && chooseVisitFeeType(opt.value)}
                    className={`rounded-xl border px-3 py-3 text-left text-xs font-semibold shadow-sm ${
                      disabled
                        ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                        : 'border-gray-200 bg-white text-gray-800 hover:border-primary'
                    }`}
                  >
                    {t(opt.labelKey)}
                    {disabled && (
                      <span className="mt-1 block text-[10px] font-normal">
                        {L(
                          'Available within 30 days after examination with this doctor',
                          'متاح خلال ٣٠ يوم من كشف مكتمل مع نفس الدكتور'
                        )}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {locationOptions.length > 0 && (
            <div className="flex flex-col gap-2">
              {locationOptions.map((branch) => (
                <button
                  key={branch.loc}
                  type="button"
                  onClick={() => chooseLocation(branch)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-sm font-semibold text-gray-800 shadow-sm hover:border-primary"
                >
                  <span className="block">{translateLoc(branch.loc)}</span>
                  {branch.slotCount > 0 && (
                    <span className="mt-0.5 block text-xs font-normal text-gray-500">
                      {L(
                        `${branch.slotCount} available slot(s)`,
                        `${localizeDigits(String(branch.slotCount))} موعد متاح`
                      )}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {dateOptions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {dateOptions.map((d) => (
                <button
                  key={d.slotDate}
                  type="button"
                  onClick={() => chooseDate(d)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm hover:border-primary"
                >
                  {localizeDigits(d.label)}
                </button>
              ))}
            </div>
          )}

          {timeOptions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {timeOptions.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => chooseTime(slot)}
                  className="min-w-[4.25rem] rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold shadow-sm hover:border-primary"
                >
                  {localizeDigits(slot.time)}
                </button>
              ))}
            </div>
          )}

          {showConfirmButton && (
            <button
              type="button"
              disabled={booking}
              onClick={submitBooking}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {L('Confirm booking', 'تأكيد الحجز')}
            </button>
          )}
        </div>
      </div>

      {(showNavBar || chatStep === CHAT_STEPS.SUCCESS || chatStep === CHAT_STEPS.FAILED) && (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-gray-100 bg-gray-50 px-3 py-2">
          {showNavBar && (
            <button
              type="button"
              disabled={!backEnabled || typing || booking}
              onClick={handleGoBack}
              className="min-h-[36px] flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {L('⬅ Back', '⬅ الرجوع')}
            </button>
          )}
          {showNavBar && (
            <button
              type="button"
              disabled={typing || booking}
              onClick={handleChangeSelection}
              className="min-h-[36px] flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40"
            >
              {L('Change Selection', 'تغيير الاختيار')}
            </button>
          )}
          <button
            type="button"
            disabled={typing || booking}
            onClick={handleStartOver}
            className="min-h-[36px] flex-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-40"
          >
            {L('Start Over', 'البدء من جديد')}
          </button>
        </div>
      )}

      <form
        className="flex shrink-0 items-end gap-2 border-t border-gray-100 bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault()
          handleTextSubmit()
        }}
      >
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleTextSubmit()
            }
          }}
          placeholder={L('Describe your symptoms or question...', 'اكتب أعراضك أو سؤالك...')}
          className="chatbot-input max-h-[120px] min-h-[48px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-base leading-snug outline-none focus:border-primary"
          dir={isRtl ? 'rtl' : 'ltr'}
          disabled={chatStep === CHAT_STEPS.SUCCESS}
        />
        <button
          type="submit"
          disabled={typing || !input.trim() || chatStep === CHAT_STEPS.SUCCESS}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-50"
        >
          {typing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
    </div>
  )

  return createPortal(
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-4 right-3 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg sm:bottom-6 sm:right-6 sm:h-14 sm:w-14 ${
          open ? 'ring-4 ring-primary/25' : ''
        }`}
        aria-label={L('Open chat', 'فتح المحادثة')}
      >
        {open ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />}
      </button>
      {panel}
    </>,
    document.body
  )
}

export default ChatbotWidget
