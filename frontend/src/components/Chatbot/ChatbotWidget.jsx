import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, Mic, MicOff, Send, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AppContext } from '../../context/AppContext'
import { translateString, useLanguage } from '../../i18n'
import { Button, IconButton, notify } from '../ui'
import { localizeWesternDigits } from '../../utils/arabicNumerals'
import { displayPersonName } from '../../utils/personNameArabic'
import { formatLocationLine } from '../../utils/placeTranslations'
import { isValidEgyptPhone, normalizeEgyptPhone } from '../../utils/egyptPhone'
import { formatMoney as formatMoneyAmount } from '../../utils/arabicMedicalUi'
import {
  hasDoctorPublishedSchedule,
  isDoctorBookableForPatients,
  isDoctorComingSoon,
  isTeleconsultationType
} from '../../utils/doctorBooking'
import { doctorBelongsToClinicSection } from '../../utils/doctorClinicPlaces'
import { doctorOffersHomeVisit, getDoctorHomeVisitAreas } from '../../utils/homeVisitAreas'
import {
  detectSpecialtyFromMessage,
  filterDoctorsBySpecialty,
  getDoctorLocations,
  getDoctorPrimaryLocation,
  getDoctorSpecialty
} from '../../utils/chatbotSpecialty'
import { findDoctorsByNameQuery, shouldUseDoctorNameSearch } from '../../utils/chatbotDoctorMatch'
import {
  CHATBOT_APPOINTMENT_TYPES,
  CHATBOT_VISIT_FEE_TYPES,
  computeChatbotTotalPrice,
  getDoctorAppointmentTypeOptions,
  probeDoctorBranchesForType
} from '../../utils/chatbotBookingHelpers'
import { bookChatbotAppointment, fetchChatbotSlots, sendChatbotMessage } from '../../utils/chatbotApi'
import { useMediaQuery } from '../../utils/useMediaQuery'
import {
  buildClinicSectionSuggestions,
  buildFallbackOpeningSuggestions,
  resolveClinicSectionLabel
} from '../../utils/chatbotOpeningSuggestions'
import { buildEmptySpecialtyGuidance, specialtyToClinicName } from '../../utils/chatbotEmptySpecialty'
import {
  captureChatSnapshot,
  canGoBack as navCanGoBack,
  canShowNavControls,
  emptyBookingData,
  getChangeSelectionStep
} from '../../utils/chatbotNavigation'
import { CHAT_STEPS } from '../../utils/chatbotSteps'
import {
  AppointmentTicket,
  EmergencyCard,
  JourneyRibbon,
  RevealText,
  SuccessActions,
  ThinkingBubble,
  UnderstoodChips
} from './AssistantParts'
import DoctorChatCard from './DoctorChatCard'
import HomeAddressForm from './HomeAddressForm'
import {
  buildCalendarFile,
  downloadCalendarFile,
  fillTemplate,
  formatDayLabel,
  formatLongDay,
  formatSlotTime,
  journeyStage
} from './assistantFormat'
import { isLocalRedFlag } from './localSafety'
import { useSpeechInput } from './useSpeechInput'
import './assistant.css'

const STEP_NEEDS_LOGIN = 'needs_login'
const SESSION_KEY = 'clinivoAssistantSession'
const MAX_TURNS_SENT = 8
const MIN_THINKING_MS = 450
const EMERGENCY_NUMBER = '123'

const EXAMPLES = ['assistant.example.tooth', 'assistant.example.child', 'assistant.example.skin']

const readSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const writeSession = (value) => {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* Private windows can refuse storage. The chat still works, it just will not survive a reload. */
  }
}

const greetingKey = (hour) =>
  hour < 12 ? 'assistant.greetMorning' : hour < 17 ? 'assistant.greetDay' : 'assistant.greetEvening'

const ChatbotWidget = () => {
  const {
    backendUrl,
    token,
    userData,
    doctors,
    clinics,
    getDoctorsData,
    getClinicsData,
    placeTranslationOverrides,
    siteSettings
  } = useContext(AppContext)
  const isLaptopUp = useMediaQuery('(min-width: 1024px)')
  const { language: siteLanguage, tc } = useLanguage()
  const navigate = useNavigate()

  const [saved] = useState(readSession)
  const [firstLiveMessageId] = useState(() => (saved?.messages || []).reduce((max, m) => Math.max(max, m.id || 0), 0) + 1)

  const [open, setOpen] = useState(saved?.chatStep === STEP_NEEDS_LOGIN)
  const [chatLang, setChatLang] = useState(saved?.chatLang || siteLanguage)
  const [chatStep, setChatStep] = useState(saved?.chatStep || CHAT_STEPS.WAITING_SYMPTOMS)
  const [messages, setMessages] = useState(saved?.messages || [])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [booking, setBooking] = useState(false)
  const [matchedDoctors, setMatchedDoctors] = useState(saved?.matchedDoctors || [])
  const [slotHints, setSlotHints] = useState(saved?.slotHints || {})
  const [quickReplies, setQuickReplies] = useState(saved?.quickReplies || [])
  const [slotDays, setSlotDays] = useState(saved?.slotDays || [])
  const [dateOptions, setDateOptions] = useState(saved?.dateOptions || [])
  const [timeOptions, setTimeOptions] = useState(saved?.timeOptions || [])
  const [locationOptions, setLocationOptions] = useState(saved?.locationOptions || [])
  const [appointmentTypeOptions, setAppointmentTypeOptions] = useState(saved?.appointmentTypeOptions || [])
  const [canBookConsultation, setCanBookConsultation] = useState(Boolean(saved?.canBookConsultation))
  const [selectedClinicSection, setSelectedClinicSection] = useState(saved?.selectedClinicSection || null)
  const [bookingData, setBookingData] = useState(saved?.bookingData || emptyBookingData())
  const [emergencyHold, setEmergencyHold] = useState(false)
  const [ticket, setTicket] = useState(null)
  const [voiceNotice, setVoiceNotice] = useState('')
  const [rebookDoctorId, setRebookDoctorId] = useState('')
  const [navDepth, setNavDepth] = useState(0)

  const listRef = useRef(null)
  const inputRef = useRef(null)
  const navStackRef = useRef([])
  const nextMessageId = useRef(firstLiveMessageId)
  const hadToken = useRef(Boolean(token))
  const bookingLock = useRef(false)
  const conversationStart = useRef(0)

  const isRtl = chatLang === 'ar'

  /* The chat can differ from the site's language: it answers in whichever language was just written. */
  const t = useCallback((key) => translateString(key, chatLang), [chatLang])

  const scrollToEnd = useCallback(() => {
    const list = listRef.current
    if (list?.scrollTo) list.scrollTo({ top: list.scrollHeight })
  }, [])

  const addMessage = (message) => {
    const id = nextMessageId.current
    nextMessageId.current += 1
    setMessages((prev) => [...prev, { id, ...message }])
  }

  /** A bot line from the area file. Stored as a key, so it follows the language toggle. */
  const say = (key, vars, extra = {}) => addMessage({ role: 'assistant', key, vars, ...extra })

  /** A bot line from the server: both languages from the rules, or one from the model. */
  const sayFromServer = (res, extra = {}) =>
    addMessage({
      role: 'assistant',
      ...(res.replyI18n ? { i18n: res.replyI18n } : { content: res.reply }),
      ...extra
    })

  const pushUser = (content, extra = {}) => addMessage({ role: 'user', content, ...extra })
  const pushUserKey = (key, vars) => addMessage({ role: 'user', key, vars })

  const withThinking = async (work) => {
    setTyping(true)
    const startedAt = Date.now()
    try {
      await work()
    } finally {
      const remaining = MIN_THINKING_MS - (Date.now() - startedAt)
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
      setTyping(false)
    }
  }

  const translateLoc = useCallback(
    (loc, lang = chatLang) =>
      formatLocationLine(loc, lang === 'ar' ? 'ar' : 'en', (key) => translateString(key, lang), placeTranslationOverrides),
    [chatLang, placeTranslationOverrides]
  )

  const sectionLabel = useCallback(
    (name) => resolveClinicSectionLabel(name, chatLang, t, tc, placeTranslationOverrides),
    [chatLang, t, tc, placeTranslationOverrides]
  )

  const personName = useCallback((name) => displayPersonName(name, chatLang), [chatLang])

  const resolveVars = (vars = {}) =>
    Object.fromEntries(
      Object.entries(vars).map(([name, value]) => {
        if (value?.person !== undefined) return [name, personName(value.person)]
        if (value?.place !== undefined) return [name, translateLoc(value.place)]
        if (value?.section !== undefined) return [name, sectionLabel(value.section)]
        if (value?.key !== undefined) return [name, t(value.key)]
        if (value?.day !== undefined) return [name, formatDayLabel(value.day, chatLang, t)]
        if (value?.time !== undefined) return [name, formatSlotTime(value.time, chatLang, t)]
        return [name, value]
      })
    )

  const messageBody = (message) => {
    if (message.i18n) return message.i18n[chatLang] || message.i18n.en
    if (message.key) return localizeWesternDigits(fillTemplate(t(message.key), resolveVars(message.vars)), chatLang)
    return message.content ?? ''
  }

  const slotLabel = useCallback(
    (slot) => `${formatDayLabel(slot.slotDate, chatLang, t)} · ${formatSlotTime(slot.time, chatLang, t)}`,
    [chatLang, t]
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

  const openingSections = clinicSectionSuggestions.length
    ? clinicSectionSuggestions
    : buildFallbackOpeningSuggestions(chatLang)

  const quickReplyLabel = (reply) => {
    if (reply.kind === 'clinic' && reply.clinicName) return sectionLabel(reply.clinicName)
    if (reply.i18n) return reply.i18n[chatLang] || reply.i18n.en
    return reply.label || ''
  }

  useEffect(() => {
    if (!open) return
    if (!messages.length) {
      const name = String(userData?.name || '').trim().split(/\s+/)[0]
      say(name ? 'assistant.welcomeBack' : 'assistant.welcome', {
        greeting: { key: greetingKey(new Date().getHours()) },
        ...(name ? { name: { person: name } } : {})
      })
    }
    getDoctorsData?.()
    getClinicsData?.()
    // Only on opening. Names and doctors refresh on their own afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    setChatLang(siteLanguage)
  }, [siteLanguage])

  /* Remembers the doctor a returning patient last saw, for a one-tap rebooking. */
  useEffect(() => {
    if (!open || !token || rebookDoctorId) return undefined
    let cancelled = false
    axios
      .get(`${backendUrl}/api/user/appointments`, { headers: { token } })
      .then(({ data }) => {
        if (cancelled || !data?.success) return
        const latest = (data.appointments || [])
          .filter((item) => item.appointmentStatus !== 'Cancelled' && item.docId)
          .sort((a, b) => Number(b.date || 0) - Number(a.date || 0))[0]
        if (latest) setRebookDoctorId(String(latest.docId))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, token, backendUrl, rebookDoctorId])

  const rebookDoctor = useMemo(() => {
    if (!rebookDoctorId) return null
    const doctor = (doctors || []).find((d) => String(d._id) === rebookDoctorId)
    return doctor && isDoctorBookableForPatients(doctor) && !isDoctorComingSoon(doctor) ? doctor : null
  }, [doctors, rebookDoctorId])

  /* Keep the conversation across a login redirect or a reload, but only for this tab and not once booked. */
  useEffect(() => {
    if (!messages.length || chatStep === CHAT_STEPS.SUCCESS) {
      writeSession(null)
      return
    }
    writeSession({
      chatLang,
      chatStep,
      messages,
      matchedDoctors,
      slotHints,
      quickReplies,
      slotDays,
      dateOptions,
      timeOptions,
      locationOptions,
      appointmentTypeOptions,
      canBookConsultation,
      selectedClinicSection,
      bookingData
    })
  }, [
    chatLang,
    chatStep,
    messages,
    matchedDoctors,
    slotHints,
    quickReplies,
    slotDays,
    dateOptions,
    timeOptions,
    locationOptions,
    appointmentTypeOptions,
    canBookConsultation,
    selectedClinicSection,
    bookingData
  ])

  const getSnapshot = () => ({
    ...captureChatSnapshot({
      chatStep,
      bookingData,
      matchedDoctors,
      quickReplies,
      slotDays,
      dateOptions,
      timeOptions,
      locationOptions,
      appointmentTypeOptions,
      canBookConsultation,
      selectedClinicSection
    }),
    slotHints
  })

  const pushHistory = () => {
    navStackRef.current.push(getSnapshot())
    setNavDepth(navStackRef.current.length)
  }

  const restoreSnapshot = (snap) => {
    setChatStep(snap.chatStep)
    setBookingData(snap.bookingData)
    setMatchedDoctors(snap.matchedDoctors || [])
    setSlotHints(snap.slotHints || {})
    setQuickReplies(snap.quickReplies || [])
    setSlotDays(snap.slotDays || [])
    setDateOptions(snap.dateOptions || [])
    setTimeOptions(snap.timeOptions || [])
    setLocationOptions(snap.locationOptions || [])
    setAppointmentTypeOptions(snap.appointmentTypeOptions || [])
    setCanBookConsultation(Boolean(snap.canBookConsultation))
    setSelectedClinicSection(snap.selectedClinicSection || null)
    setNavDepth(navStackRef.current.length)
  }

  const clearChoices = () => {
    setMatchedDoctors([])
    setSlotHints({})
    setQuickReplies([])
    setSlotDays([])
    setDateOptions([])
    setTimeOptions([])
    setLocationOptions([])
    setAppointmentTypeOptions([])
    setCanBookConsultation(false)
  }

  const resetFlow = () => {
    conversationStart.current = nextMessageId.current
    navStackRef.current = []
    setNavDepth(0)
    clearChoices()
    setSelectedClinicSection(null)
    setBookingData(emptyBookingData())
    setTicket(null)
    setEmergencyHold(false)
    setChatStep(CHAT_STEPS.WAITING_SYMPTOMS)
  }

  /* Logging out ends the conversation: the next person at this computer must not see it. */
  useEffect(() => {
    if (hadToken.current && !token) {
      resetFlow()
      setMessages([])
      writeSession(null)
      setRebookDoctorId('')
    }
    hadToken.current = Boolean(token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleStartOver = () => {
    pushUserKey('assistant.startOver')
    resetFlow()
    say('assistant.startedOver')
  }

  const handleGoBack = () => {
    const prev = navStackRef.current.pop()
    if (!prev) return
    pushUserKey('assistant.back')
    restoreSnapshot(prev)
    say('assistant.backDone')
  }

  const resolveDoctorsList = async () => {
    if (doctors?.length) return doctors
    try {
      const { data } = await axios.get(`${backendUrl}/api/doctor/list`, { params: { _t: Date.now() } })
      if (data?.success && Array.isArray(data.doctors)) return data.doctors
    } catch {
      /* The caller says so in the chat. */
    }
    return []
  }

  const offerAlternatives = (emptyClinicName, emptyClinicId = null, messageKey, messageVars) => {
    const guidance = buildEmptySpecialtyGuidance({
      doctors,
      clinics,
      emptyClinicName,
      emptyClinicId,
      t,
      tc,
      language: chatLang,
      placeTranslationOverrides,
      messageOverride: ' '
    })
    setMatchedDoctors([])
    setQuickReplies(guidance.suggestions)
    setChatStep(guidance.suggestions.length ? CHAT_STEPS.SUGGESTING_ALTERNATIVES : CHAT_STEPS.WAITING_SYMPTOMS)
    if (messageKey) say(messageKey, messageVars)
    if (!guidance.suggestions.length) say('assistant.noDoctorsAnywhere')
  }

  const showDoctorList = (list, { hints = {}, messageKey, skipHistory = false, extra = {} } = {}) => {
    if (!skipHistory) pushHistory()
    clearChoices()
    setMatchedDoctors(list)
    setSlotHints(hints)
    setChatStep(CHAT_STEPS.SHOWING_DOCTORS)
    if (messageKey) say(messageKey, undefined, extra)
  }

  const showDoctorsForClinic = async (clinicName, clinicId, options = {}) => {
    if (!options.skipHistory) pushHistory()
    setSelectedClinicSection({ name: clinicName, id: clinicId })
    const source = await resolveDoctorsList()
    const list = source.filter(
      (doctor) =>
        isDoctorBookableForPatients(doctor) &&
        !isDoctorComingSoon(doctor) &&
        doctorBelongsToClinicSection(doctor, clinicName, { clinicId })
    )

    if (!list.length) {
      offerAlternatives(clinicName, clinicId, 'assistant.noDoctorsInSection', { section: { section: clinicName } })
      return
    }

    setBookingData((b) => ({ ...b, detectedSpecialty: '' }))
    showDoctorList(list, {
      skipHistory: true,
      messageKey: list.length === 1 ? 'assistant.doctorsFoundOne' : 'assistant.doctorsFound'
    })
  }

  const showDoctorsForService = async (service) => {
    const source = await resolveDoctorsList()
    const bookable = source.filter((doctor) => isDoctorBookableForPatients(doctor) && !isDoctorComingSoon(doctor))
    const list = bookable.filter((doctor) =>
      service === 'home'
        ? doctorOffersHomeVisit(doctor)
        : hasDoctorPublishedSchedule(doctor) && (doctor.acceptsVoiceCall !== false || doctor.acceptsVideoCall !== false)
    )
    if (!list.length) {
      offerAlternatives('', null, 'assistant.noDoctorsForService')
      return
    }
    showDoctorList(list, { messageKey: 'assistant.doctorsFound' })
  }

  const openDatesFrom = (days) => {
    setSlotDays(days)
    setDateOptions(days.map((d) => ({ slotDate: d.slotDate, date: d.date })))
  }

  const updateBooking = (next) => {
    setBookingData(next)
    return next
  }

  /** After the visit type is known: ask for the address, a branch or a day, whichever comes next. */
  const continueToScheduling = (next) => {
    const doctor = next.selectedDoctor
    const type = next.appointmentType

    if (type === 'Home Visit' && !next.homeVisitAddress?.street) {
      setChatStep(CHAT_STEPS.WAITING_HOME_AREA)
      say('assistant.homeAddress')
      return
    }

    if (next.time) {
      proceedToCheckout(next)
      return
    }

    const result = probeDoctorBranchesForType(doctor, type, 14)

    if (result.mode === 'empty') {
      setAppointmentTypeOptions(getDoctorAppointmentTypeOptions(doctor))
      setChatStep(CHAT_STEPS.WAITING_APPOINTMENT_TYPE)
      say('assistant.noSlotsForType')
      return
    }

    if (result.mode === 'pick_branch') {
      setLocationOptions(result.branches)
      setChatStep(CHAT_STEPS.WAITING_LOCATION)
      say('assistant.chooseBranch', { doctor: { person: doctor.name } })
      return
    }

    updateBooking({ ...next, clinicLocation: result.branch || '' })
    openDatesFrom(result.days)
    setChatStep(CHAT_STEPS.WAITING_DATE)
    say('assistant.pickDate')
  }

  const chooseAppointmentType = async (type) => {
    if (!bookingData.selectedDoctor) return
    pushHistory()
    const labelKey = CHATBOT_APPOINTMENT_TYPES.find((o) => o.value === type)?.labelKey || type
    pushUserKey(labelKey)
    setAppointmentTypeOptions([])
    const next = updateBooking({ ...bookingData, appointmentType: type, slotDate: '', date: null, time: '', clinicLocation: '' })
    await withThinking(async () => continueToScheduling(next))
  }

  const submitHomeAddress = (address) => {
    pushHistory()
    pushUser([address.street, address.area].filter(Boolean).join(', '))
    continueToScheduling(updateBooking({ ...bookingData, homeVisitArea: address.area, homeVisitAddress: address }))
  }

  const chooseLocation = (branch) => {
    if (!bookingData.selectedDoctor) return
    pushHistory()
    pushUser(translateLoc(branch.loc))
    setLocationOptions([])
    updateBooking({ ...bookingData, clinicLocation: branch.loc })
    openDatesFrom(branch.days)
    setChatStep(CHAT_STEPS.WAITING_DATE)
    say('assistant.pickDate')
  }

  const chooseDoctor = async (doctor) => {
    if (isDoctorComingSoon(doctor)) return
    pushHistory()
    pushUser(personName(doctor.name))
    clearChoices()
    const next = updateBooking({
      ...emptyBookingData(),
      detectedSpecialty: bookingData.detectedSpecialty,
      selectedDoctor: doctor
    })

    await withThinking(async () => {
      const options = getDoctorAppointmentTypeOptions(doctor)
      if (!options.length) {
        setChatStep(CHAT_STEPS.WAITING_SYMPTOMS)
        say('assistant.noVisitOptions')
        return
      }
      if (options.length === 1) {
        continueToScheduling(updateBooking({ ...next, appointmentType: options[0].value }))
        return
      }
      setAppointmentTypeOptions(options)
      setChatStep(CHAT_STEPS.WAITING_APPOINTMENT_TYPE)
      say('assistant.howVisit', { doctor: { person: doctor.name } })
    })
  }

  const showTimesForDay = (day, options = {}) => {
    const times = day?.slots || []
    if (!times.length) {
      say('assistant.noTimesThatDay')
      return
    }
    setBookingData((b) => ({ ...b, slotDate: day.slotDate, date: day.date, time: '' }))
    setDateOptions([])
    setTimeOptions(times)
    setChatStep(CHAT_STEPS.WAITING_TIME)
    if (!options.silent) say('assistant.pickTime')
  }

  const chooseDate = (opt) => {
    pushHistory()
    pushUserKey('{day}', { day: { day: opt.slotDate } })
    showTimesForDay(slotDays.find((d) => d.slotDate === opt.slotDate))
  }

  /** Moves on towards confirmation, stopping for a login or a missing profile on the way. */
  const proceedToCheckout = async (next) => {
    if (!token) {
      updateBooking(next)
      setChatStep(STEP_NEEDS_LOGIN)
      say('assistant.loginNeeded')
      return
    }

    const name = String(userData?.name || '').trim()
    const phone = String(userData?.phone || '').trim()
    if (!name || !phone) {
      updateBooking(next)
      setChatStep(CHAT_STEPS.FAILED)
      say('assistant.profileIncomplete', undefined, { link: { to: '/my-profile', key: 'assistant.openProfile' } })
      return
    }

    const withPatient = updateBooking({ ...next, patientName: name, phone, visitFeeType: 'examination' })

    let canConsult = false
    try {
      const { data } = await axios.get(
        `${backendUrl}/api/user/visit-fee-eligibility/${withPatient.selectedDoctor._id}`,
        { headers: { token } }
      )
      canConsult = Boolean(data?.canBookConsultation)
    } catch {
      canConsult = false
    }
    setCanBookConsultation(canConsult)

    if (canConsult) {
      setChatStep(CHAT_STEPS.WAITING_VISIT_FEE)
      say('assistant.pickVisitFee')
      return
    }
    goToConfirm()
  }

  const chooseVisitFeeType = (visitFeeType) => {
    pushHistory()
    const labelKey = CHATBOT_VISIT_FEE_TYPES.find((o) => o.value === visitFeeType)?.labelKey || visitFeeType
    pushUserKey(labelKey)
    setBookingData((b) => ({ ...b, visitFeeType }))
    goToConfirm()
  }

  const chooseTime = (slot) => {
    pushHistory()
    pushUserKey('{time}', { time: { time: slot.time } })
    setTimeOptions([])
    proceedToCheckout(
      updateBooking({
        ...bookingData,
        time: slot.time,
        ...(slot.branch ? { clinicLocation: slot.branch } : {})
      })
    )
  }

  /** One tap on a doctor card's time: everything else is already known. */
  const pickSlot = async (doctor, slot) => {
    pushHistory()
    pushUser(`${personName(doctor.name)} · ${slotLabel(slot)}`)
    clearChoices()
    const next = updateBooking({
      ...emptyBookingData(),
      detectedSpecialty: bookingData.detectedSpecialty,
      selectedDoctor: doctor,
      appointmentType: slot.appointmentType || 'Clinic',
      slotDate: slot.slotDate,
      date: slot.date,
      time: slot.time,
      clinicLocation: slot.clinicLocation || ''
    })
    await withThinking(async () => continueToScheduling(next))
  }

  const goToConfirm = () => {
    setChatStep(CHAT_STEPS.CONFIRMING)
    say('assistant.summaryIntro')
  }

  const ensureSlotDays = (data) => {
    if (slotDays.length) return slotDays
    const result = probeDoctorBranchesForType(data.selectedDoctor, data.appointmentType, 14)
    if (result.mode === 'ready') return result.days
    const branch = result.branches?.find((b) => b.loc === data.clinicLocation)
    return branch?.days || []
  }

  const backToDates = () => {
    const days = ensureSlotDays(bookingData)
    setTimeOptions([])
    setBookingData((b) => ({ ...b, slotDate: '', date: null, time: '' }))
    openDatesFrom(days)
    setChatStep(CHAT_STEPS.WAITING_DATE)
    say('assistant.pickDate')
  }

  const backToTimes = () => {
    const days = ensureSlotDays(bookingData)
    const day = days.find((d) => d.slotDate === bookingData.slotDate)
    if (!day) {
      backToDates()
      return
    }
    setSlotDays(days)
    setBookingData((b) => ({ ...b, time: '' }))
    setDateOptions([])
    setTimeOptions(day.slots)
    setChatStep(CHAT_STEPS.WAITING_TIME)
    say('assistant.pickTime')
  }

  const backToDoctors = async () => {
    setBookingData((b) => ({ ...emptyBookingData(), detectedSpecialty: b.detectedSpecialty }))
    clearChoices()
    if (selectedClinicSection) {
      await showDoctorsForClinic(selectedClinicSection.name, selectedClinicSection.id, { skipHistory: true })
      return
    }
    if (bookingData.detectedSpecialty) {
      const source = await resolveDoctorsList()
      const list = filterDoctorsBySpecialty(source, bookingData.detectedSpecialty).filter(
        (doctor) => isDoctorBookableForPatients(doctor) && !isDoctorComingSoon(doctor)
      )
      if (list.length) {
        showDoctorList(list, { skipHistory: true, messageKey: 'assistant.doctorsFound' })
        return
      }
    }
    setChatStep(CHAT_STEPS.WAITING_SYMPTOMS)
    say('assistant.chooseSection')
  }

  const handleChangeSelection = async () => {
    pushUserKey('assistant.change')
    const from = chatStep === STEP_NEEDS_LOGIN ? CHAT_STEPS.CONFIRMING : chatStep
    const target = getChangeSelectionStep(from)

    await withThinking(async () => {
      if (target === CHAT_STEPS.SHOWING_DOCTORS) await backToDoctors()
      else if (target === CHAT_STEPS.WAITING_DATE) backToDates()
      else if (target === CHAT_STEPS.WAITING_TIME) backToTimes()
      else if (target === CHAT_STEPS.WAITING_APPOINTMENT_TYPE) {
        const doctor = bookingData.selectedDoctor
        if (!doctor) {
          resetFlow()
          say('assistant.chooseSection')
          return
        }
        clearChoices()
        setAppointmentTypeOptions(getDoctorAppointmentTypeOptions(doctor))
        setChatStep(CHAT_STEPS.WAITING_APPOINTMENT_TYPE)
        say('assistant.howVisit', { doctor: { person: doctor.name } })
      } else {
        resetFlow()
        say('assistant.chooseSection')
      }
    })
  }

  /* Back from logging in: carry on from where the booking stopped. */
  useEffect(() => {
    if (chatStep !== STEP_NEEDS_LOGIN || !token || !userData?.name) return
    say('assistant.loginBack')
    continueToScheduling(bookingData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userData?.name, chatStep])

  const recoverFromTakenSlot = async () => {
    getDoctorsData?.()
    const { selectedDoctor, appointmentType, clinicLocation, slotDate } = bookingData
    let days = []
    try {
      const data = await fetchChatbotSlots(backendUrl, {
        docId: selectedDoctor._id,
        clinicLocation,
        appointmentType
      })
      days = data?.days || []
    } catch {
      days = []
    }
    setSlotDays(days)
    const sameDay = days.find((d) => d.slotDate === slotDate)
    setBookingData((b) => ({ ...b, time: '' }))
    say('assistant.slotTaken')
    if (sameDay) {
      setDateOptions([])
      setTimeOptions(sameDay.slots)
      setChatStep(CHAT_STEPS.WAITING_TIME)
    } else {
      setTimeOptions([])
      setDateOptions(days.map((d) => ({ slotDate: d.slotDate, date: d.date })))
      setChatStep(CHAT_STEPS.WAITING_DATE)
    }
  }

  const submitBooking = async () => {
    const { selectedDoctor, slotDate, time, clinicLocation, appointmentType, visitFeeType, homeVisitAddress } = bookingData
    if (!selectedDoctor || !slotDate || !time || emergencyHold || bookingLock.current) return

    if (!token) {
      setChatStep(STEP_NEEDS_LOGIN)
      say('assistant.loginNeeded')
      return
    }

    const profilePhone = String(userData?.phone || '').trim()
    if (profilePhone && !isValidEgyptPhone(normalizeEgyptPhone(profilePhone) || profilePhone)) {
      say('assistant.phoneInvalid', undefined, { link: { to: '/my-profile', key: 'assistant.openProfile' } })
      return
    }

    bookingLock.current = true
    setBooking(true)
    try {
      const data = await bookChatbotAppointment(
        backendUrl,
        {
          docId: selectedDoctor._id,
          slotDate,
          slotTime: time,
          clinicLocation,
          appointmentType: appointmentType || 'Clinic',
          visitFeeType: visitFeeType || 'examination',
          homeVisitAddress: appointmentType === 'Home Visit' ? homeVisitAddress || {} : {},
          paymentMethod: 'Cash',
          confirmed: true
        },
        token
      )

      if (data.needLogin) {
        setChatStep(STEP_NEEDS_LOGIN)
        say('assistant.loginNeeded')
        return
      }

      if (!data.success) {
        if (/slot not available|already booked|past time|overlaps|outside doctor/i.test(data.message || '')) {
          await recoverFromTakenSlot()
          return
        }
        if (/does not accept cash/i.test(data.message || '')) {
          say('assistant.bookFailedReason', { reason: { key: 'assistant.reason.cash' } }, {
            link: { to: `/appointment/${selectedDoctor._id}`, key: 'assistant.openDoctorPage' }
          })
          return
        }
        say('assistant.bookFailed')
        return
      }

      setTicket({ reservationNumber: data.reservationNumber, amount: data.appointment?.amount })
      setChatStep(CHAT_STEPS.SUCCESS)
      navStackRef.current = []
      setNavDepth(0)
      say('assistant.success')
      notify.success(t('assistant.successTitle'))
      getDoctorsData?.()
    } catch {
      say('assistant.bookFailed')
    } finally {
      bookingLock.current = false
      setBooking(false)
    }
  }

  const offlineFallback = async (text) => {
    // The server is out of reach, so the safety check it would have made happens here.
    if (isLocalRedFlag(text)) {
      setEmergencyHold(true)
      addMessage({
        role: 'assistant',
        emergency: { category: 'unknown', callNumber: EMERGENCY_NUMBER, crisisNumber: null },
        key: 'assistant.offlineEmergency'
      })
      return
    }

    const source = await resolveDoctorsList()
    const byName = findDoctorsByNameQuery(source, text)
    if (shouldUseDoctorNameSearch(text, byName)) {
      showDoctorList(byName, { messageKey: byName.length === 1 ? 'assistant.doctorsFoundOne' : 'assistant.doctorsFound' })
      return
    }

    const { specialty } = detectSpecialtyFromMessage(text)
    const list = specialty ? filterDoctorsBySpecialty(source, specialty) : []
    if (list.length) {
      setBookingData((b) => ({ ...b, detectedSpecialty: specialty }))
      showDoctorList(list, { messageKey: 'assistant.doctorsFound' })
      return
    }
    say('assistant.offlineUnclear')
  }

  const understoodChips = (understood) => {
    if (!understood) return []
    const chips = []
    if (understood.specialty) chips.push(sectionLabel(understood.specialty))
    if (understood.visitType) {
      const key = CHATBOT_APPOINTMENT_TYPES.find((o) => o.value === understood.visitType)?.labelKey
      if (key) chips.push(t(key))
    }
    if (understood.day?.slotDate) chips.push(formatDayLabel(understood.day.slotDate, chatLang, t))
    if (understood.dayPart) chips.push(t(`assistant.dayPart.${understood.dayPart}`))
    if (understood.preference) chips.push(t(`assistant.preference.${understood.preference}`))
    if (understood.soonest) chips.push(t('assistant.soonest'))
    return chips
  }

  const showServerDoctors = async (res) => {
    const source = await resolveDoctorsList()
    const hints = {}
    const list = res.suggestedDoctors
      .map((doc) => {
        const full = source.find((d) => String(d._id) === String(doc.id))
        if (!full) return null
        hints[String(doc.id)] = { slots: doc.nextSlots || [], matched: doc.slotsMatchRequest !== false }
        return full
      })
      .filter(Boolean)

    if (!list.length) {
      sayFromServer(res)
      say('assistant.cantLoadDoctors')
      return
    }

    pushHistory()
    clearChoices()
    setSelectedClinicSection(null)
    setBookingData((b) => ({
      ...emptyBookingData(),
      patientName: b.patientName,
      phone: b.phone,
      detectedSpecialty: res.suggestedSpecialty || ''
    }))
    setMatchedDoctors(list)
    setSlotHints(hints)
    setChatStep(CHAT_STEPS.SHOWING_DOCTORS)
    sayFromServer(res, { understood: res.understood })
  }

  /** "5:30", "tomorrow", "the evening" while choosing a time. */
  const applyServerSlots = (res) => {
    const days = res.slotDays || []
    if (res.clinicLocation) setBookingData((b) => ({ ...b, clinicLocation: res.clinicLocation }))
    setSlotDays(days)

    const candidates = res.understood?.timeCandidates
    const wantedDay = res.understood?.day?.slotDate
    const searchDays = wantedDay
      ? days.filter((d) => d.slotDate === wantedDay)
      : bookingData.slotDate
        ? days.filter((d) => d.slotDate === bookingData.slotDate)
        : days

    if (candidates?.length) {
      for (const day of searchDays) {
        const slot = day.slots.find((s) => candidates.includes(slotClockMinutes(s.time)))
        if (slot) {
          pushHistory()
          proceedToCheckout(
            updateBooking({
              ...bookingData,
              slotDate: day.slotDate,
              date: day.date,
              time: slot.time,
              clinicLocation: res.clinicLocation || bookingData.clinicLocation || ''
            })
          )
          setTimeOptions([])
          setDateOptions([])
          return
        }
      }
    }

    pushHistory()
    if (wantedDay && res.requestedDayAvailable !== false && days[0]) {
      showTimesForDay(days[0], { silent: true })
      sayFromServer(res)
      return
    }
    if (wantedDay && res.requestedDayAvailable === false) say('assistant.dayNotAvailable')
    else if (!wantedDay) sayFromServer(res)
    setTimeOptions([])
    openDatesFrom(days)
    setChatStep(CHAT_STEPS.WAITING_DATE)
  }

  const answerAction = async (res) => {
    const inFlow = Boolean(bookingData.selectedDoctor)
    switch (res.action) {
      case 'restart':
        resetFlow()
        say('assistant.startedOver')
        return true
      case 'decline':
        resetFlow()
        sayFromServer(res)
        return true
      case 'back':
        if (navStackRef.current.length) {
          const prev = navStackRef.current.pop()
          restoreSnapshot(prev)
          say('assistant.backDone')
        } else {
          say('assistant.notFollowing')
        }
        return true
      case 'change_doctor':
        pushHistory()
        await backToDoctors()
        return true
      case 'change_time':
        if (!inFlow) {
          say('assistant.notFollowing')
          return true
        }
        pushHistory()
        backToDates()
        return true
      case 'open_appointments':
        sayFromServer(res, { link: { to: '/my-appointments', key: 'assistant.openAppointments' } })
        return true
      case 'open_contact':
        sayFromServer(res, { link: { to: '/contact', key: 'assistant.openContact' } })
        return true
      case 'affirm':
        if (chatStep === CHAT_STEPS.CONFIRMING) {
          await submitBooking()
          return true
        }
        say('assistant.notFollowing')
        return true
      case 'negative':
        say(chatStep === CHAT_STEPS.CONFIRMING ? 'assistant.notBooked' : 'assistant.notFollowing')
        return true
      default:
        return false
    }
  }

  const applyResponse = async (res, text) => {
    if (res.language) setChatLang(res.language)

    if (res.emergency) {
      setEmergencyHold(true)
      addMessage({ role: 'assistant', emergency: res.emergencyInfo, i18n: res.replyI18n })
      return
    }

    const wasHeld = emergencyHold
    setEmergencyHold(false)

    // Never let "yes" typed under an emergency warning complete a booking.
    if (wasHeld && res.action === 'affirm') {
      say('assistant.emergency.unsure', { number: EMERGENCY_NUMBER })
      setEmergencyHold(true)
      return
    }

    if (await answerAction(res)) return

    if (res.showDoctorPicker && res.suggestedDoctors?.length) {
      await showServerDoctors(res)
      return
    }

    if (res.noDoctors) {
      sayFromServer(res, { understood: res.understood })
      offerAlternatives(specialtyToClinicName(res.suggestedSpecialty))
      return
    }

    if (res.showSlotPicker) {
      applyServerSlots(res)
      return
    }

    if (res.needsClinicLocation) {
      sayFromServer(res)
      return
    }

    if (res.followUp?.options?.length) {
      setQuickReplies(
        res.followUp.options.map((option) => ({
          id: option.id,
          kind: 'say',
          i18n: { en: option.en, ar: option.ar },
          text: { en: option.en, ar: option.ar }
        }))
      )
      sayFromServer(res)
      return
    }

    const chose = chooseFromTypedText(res, text)
    if (chose) return

    if (res.intent === 'unclear' || !res.intent) {
      const source = await resolveDoctorsList()
      const byName = findDoctorsByNameQuery(source, text)
      if (shouldUseDoctorNameSearch(text, byName)) {
        showDoctorList(byName, { messageKey: byName.length === 1 ? 'assistant.doctorsFoundOne' : 'assistant.doctorsFound' })
        return
      }
    }

    sayFromServer(res)
    if (chatStep === CHAT_STEPS.WAITING_LOCATION) say('assistant.tapBranch')
    else if (chatStep === CHAT_STEPS.WAITING_APPOINTMENT_TYPE) say('assistant.tapVisitType')
    else if (chatStep === CHAT_STEPS.WAITING_VISIT_FEE) say('assistant.tapVisitFee')
    else if (chatStep === CHAT_STEPS.WAITING_HOME_AREA) say('assistant.tapAddress')
  }

  /** Lets people type an option as well as tap it. */
  const chooseFromTypedText = (res, text) => {
    const wanted = res.understood?.visitType
    if (chatStep === CHAT_STEPS.WAITING_APPOINTMENT_TYPE && wanted) {
      const match = appointmentTypeOptions.find((o) => o.value === wanted)
      if (match) {
        chooseAppointmentType(match.value)
        return true
      }
    }
    if (chatStep === CHAT_STEPS.WAITING_LOCATION) {
      const lower = text.trim().toLowerCase()
      const match = locationOptions.find(
        (b) => b.loc.toLowerCase().includes(lower) || translateLoc(b.loc).toLowerCase().includes(lower)
      )
      if (match && lower.length > 1) {
        chooseLocation(match)
        return true
      }
    }
    if (chatStep === CHAT_STEPS.WAITING_VISIT_FEE) {
      if (/متابع|استشار|follow|consult/i.test(text) && canBookConsultation) {
        chooseVisitFeeType('consultation')
        return true
      }
      if (/كشف|examin|new|جديد/i.test(text)) {
        chooseVisitFeeType('examination')
        return true
      }
    }
    return false
  }

  const sendText = async (text) => {
    if (chatStep === CHAT_STEPS.SUCCESS) resetFlow()

    // Only what the person typed since the last fresh start. Tapped options name doctors and dates, and add nothing.
    const history = messages
      .filter((m) => m.typed && m.id >= conversationStart.current)
      .map((m) => ({ role: 'user', content: m.content }))
    const conversation = [...history, { role: 'user', content: text }].slice(-MAX_TURNS_SENT)
    pushUser(text, { typed: true })

    await withThinking(async () => {
      let res = null
      let rateLimited = false
      try {
        res = await sendChatbotMessage(backendUrl, {
          messages: conversation,
          language: chatLang,
          bookingContext: {
            docId: bookingData.selectedDoctor?._id,
            clinicLocation: bookingData.clinicLocation,
            specialty: bookingData.detectedSpecialty || getDoctorSpecialty(bookingData.selectedDoctor),
            appointmentType: bookingData.appointmentType,
            step: chatStep
          }
        })
      } catch (error) {
        rateLimited = error?.response?.status === 429
      }

      if (res?.success) {
        await applyResponse(res, text)
        return
      }
      if (rateLimited && !isLocalRedFlag(text)) {
        say('assistant.tooMany')
        return
      }
      await offlineFallback(text)
    })
  }

  const handleTextSubmit = () => {
    const text = input.trim()
    if (!text || typing || booking) return
    speech.stop()
    setVoiceNotice('')
    setInput('')
    sendText(text)
  }

  const handleQuickReply = async (reply) => {
    if (reply.kind === 'say') {
      setQuickReplies([])
      sendText(reply.text?.[chatLang] || reply.text?.en || '')
      return
    }

    pushUser(quickReplyLabel(reply))
    setQuickReplies([])

    await withThinking(async () => {
      if (reply.kind === 'clinic') {
        await showDoctorsForClinic(reply.clinicName, reply.clinicId)
        return
      }
      if (reply.kind === 'doctor') {
        const source = await resolveDoctorsList()
        const doctor = source.find((d) => String(d._id) === String(reply.doctorId))
        if (doctor) showDoctorList([doctor], { messageKey: 'assistant.doctorsFoundOne' })
        else say('assistant.doctorUnavailable')
        return
      }
      if (reply.kind === 'service') await showDoctorsForService(reply.service)
    })
  }

  const handleEmergencyContinue = () => {
    setEmergencyHold(false)
    say('assistant.emergency.continued', { number: EMERGENCY_NUMBER })
  }

  const speech = useSpeechInput({
    language: chatLang,
    getBaseText: () => inputRef.current?.value || '',
    onText: (text) => {
      setVoiceNotice('')
      setInput(text)
    },
    onError: (key) => setVoiceNotice(key)
  })

  const toggleVoice = () => {
    if (speech.listening) {
      speech.stop()
      return
    }
    setVoiceNotice('')
    speech.start()
  }

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    if (!open || !isLaptopUp) {
      document.body.classList.remove('chatbot-open')
      return undefined
    }
    document.body.classList.add('chatbot-open')
    return () => document.body.classList.remove('chatbot-open')
  }, [open, isLaptopUp])

  useEffect(() => {
    if (open && isLaptopUp) inputRef.current?.focus({ preventScroll: true })
  }, [open, isLaptopUp])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    scrollToEnd()
  }, [
    messages,
    typing,
    matchedDoctors,
    quickReplies,
    dateOptions,
    timeOptions,
    locationOptions,
    appointmentTypeOptions,
    chatStep,
    emergencyHold,
    scrollToEnd
  ])

  const ticketRows = (data) => {
    const doctor = data.selectedDoctor
    if (!doctor) return []
    const typeKey = CHATBOT_APPOINTMENT_TYPES.find((o) => o.value === data.appointmentType)?.labelKey || 'In clinic'
    const feeKey = CHATBOT_VISIT_FEE_TYPES.find((o) => o.value === data.visitFeeType)?.labelKey || 'Examination (Kashf)'
    const isTele = isTeleconsultationType(data.appointmentType)
    const place =
      data.appointmentType === 'Home Visit'
        ? [data.homeVisitAddress?.street, data.homeVisitAddress?.area && translateLoc(data.homeVisitAddress.area)].filter(Boolean).join(', ')
        : !isTele && (data.clinicLocation || getDoctorPrimaryLocation(doctor))
          ? translateLoc(data.clinicLocation || getDoctorPrimaryLocation(doctor))
          : ''
    return [
      { label: t('assistant.ticket.patient'), value: personName(data.patientName || userData?.name || '') },
      { label: t('assistant.ticket.doctor'), value: `${personName(doctor.name)} · ${sectionLabel(getDoctorSpecialty(doctor))}` },
      { label: t('assistant.ticket.visit'), value: t(typeKey) },
      { label: t('assistant.ticket.kind'), value: t(feeKey) },
      { label: t('assistant.ticket.place'), value: place },
      {
        label: t('assistant.ticket.when'),
        value: `${formatLongDay(data.slotDate, chatLang)} · ${formatSlotTime(data.time, chatLang, t)}`
      }
    ]
  }

  const ticketTotal = (data, amount) => {
    const total =
      amount ??
      (data.selectedDoctor
        ? computeChatbotTotalPrice({
            doctor: data.selectedDoctor,
            visitFeeType: data.visitFeeType,
            appointmentType: data.appointmentType,
            siteSettings
          }).total
        : 0)
    return total > 0
      ? formatMoneyAmount(total, chatLang, (value) => localizeWesternDigits(value, chatLang))
      : t('assistant.ticket.free')
  }

  const addToCalendar = () => {
    const content = buildCalendarFile({
      title: fillTemplate(t('assistant.calendarTitle'), { doctor: personName(bookingData.selectedDoctor?.name) }),
      slotDate: bookingData.slotDate,
      time: bookingData.time,
      location: isTeleconsultationType(bookingData.appointmentType)
        ? ''
        : bookingData.appointmentType === 'Home Visit'
          ? [bookingData.homeVisitAddress?.street, bookingData.homeVisitAddress?.area].filter(Boolean).join(', ')
          : bookingData.clinicLocation || getDoctorPrimaryLocation(bookingData.selectedDoctor),
      reservationNumber: ticket?.reservationNumber
    })
    if (content) downloadCalendarFile(content)
  }

  const showNavBar = (canShowNavControls(chatStep) || chatStep === CHAT_STEPS.FAILED) && !emergencyHold
  const backEnabled = navCanGoBack(chatStep, navDepth)
  const showChoices = !emergencyHold
  const atOpening = chatStep === CHAT_STEPS.WAITING_SYMPTOMS && !matchedDoctors.length && !quickReplies.length
  const isOpeningScreen = atOpening && messages.filter((m) => m.role === 'user').length === 0
  const stage = journeyStage(chatStep, CHAT_STEPS)

  const optionClass =
    'cursor-pointer rounded-control border border-line-strong bg-surface text-ink shadow-e1 transition duration-(--duration-fast) ease-standard hover:border-primary hover:bg-primary-soft active:scale-[0.98] assistant-chip'

  const renderMessage = (message) => {
    const body = messageBody(message)
    const animate = message.role === 'assistant' && message.id >= firstLiveMessageId

    if (message.emergency) {
      const isLatest = message.id === messages.filter((m) => m.emergency).at(-1)?.id
      return (
        <EmergencyCard
          key={message.id}
          info={message.emergency}
          text={body}
          t={t}
          canContinue={emergencyHold && isLatest}
          onContinue={handleEmergencyContinue}
        />
      )
    }

    if (message.role === 'user') {
      return (
        <div key={message.id} className='flex animate-rise justify-end'>
          <div dir='auto' className='max-w-[88%] whitespace-pre-wrap break-words rounded-card rounded-ee-control bg-primary px-3 py-2 text-body-sm text-on-primary'>
            {body}
          </div>
        </div>
      )
    }

    return (
      <div key={message.id} className='flex animate-rise flex-col items-start'>
        <div dir='auto' className='max-w-[92%] whitespace-pre-wrap break-words rounded-card rounded-es-control border border-line bg-surface px-3 py-2 text-body-sm text-ink shadow-e1'>
          <RevealText text={body} animate={animate} onProgress={scrollToEnd} />
          {message.link && (
            <Link
              to={message.link.to}
              onClick={() => setOpen(false)}
              className='mt-2 block font-semibold text-brand underline underline-offset-2'
            >
              {t(message.link.key)}
            </Link>
          )}
        </div>
        <UnderstoodChips chips={understoodChips(message.understood)} t={t} />
      </div>
    )
  }

  const panel = (
    <div
      role='dialog'
      aria-label={t('assistant.name')}
      aria-hidden={!open}
      className={`chatbot-panel fixed z-[9998] flex flex-col overflow-hidden border border-line bg-canvas shadow-e3 transition-all duration-(--duration-base) ease-standard
        start-2 end-2 h-[min(85dvh,700px)] min-h-[min(520px,85dvh)] max-h-[min(85dvh,calc(100dvh-5rem))] rounded-sheet
        sm:start-auto sm:end-6 sm:w-[min(100%,420px)]
        ${open ? 'bottom-[5rem] opacity-100 sm:bottom-6' : 'invisible pointer-events-none bottom-[5.75rem] opacity-0 sm:bottom-24'}
      `}
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={chatLang}
    >
      <header className='flex shrink-0 items-center gap-3 border-b border-line bg-surface px-4 py-3'>
        <span
          data-busy={typing || booking}
          aria-hidden='true'
          className='assistant-orb block size-9 shrink-0 rounded-full rounded-se-none bg-gradient-to-br from-primary to-primary-dark'
        />
        <div className='min-w-0 flex-1'>
          <h2 className='truncate text-subtitle font-bold text-ink'>{t('assistant.name')}</h2>
          <p className='truncate text-caption text-ink-2'>{t('assistant.tagline')}</p>
        </div>
        <IconButton label={t('assistant.close')} variant='ghost' size='sm' onClick={() => setOpen(false)}>
          <X className='size-5' />
        </IconButton>
      </header>

      <JourneyRibbon stage={stage} t={t} />

      <div ref={listRef} role='log' aria-live='polite' className='min-h-0 flex-1 overflow-y-auto overscroll-contain p-3'>
        <div className='flex flex-col gap-2.5'>
          {messages.map(renderMessage)}

          {typing && <ThinkingBubble t={t} />}

          {isOpeningScreen && !typing && (
            <div className='animate-rise space-y-3 pt-1'>
              {rebookDoctor && (
                <button
                  type='button'
                  onClick={() => handleQuickReply({ kind: 'doctor', doctorId: rebookDoctor._id, label: fillTemplate(t('assistant.rebook'), { doctor: personName(rebookDoctor.name) }) })}
                  className='w-full cursor-pointer rounded-control bg-primary-soft px-3 py-2.5 text-start text-body-sm font-semibold text-brand transition duration-(--duration-fast) hover:brightness-95'
                >
                  {fillTemplate(t('assistant.rebook'), { doctor: personName(rebookDoctor.name) })}
                </button>
              )}
              <div>
                <p className='mb-1.5 text-caption font-medium text-ink-3'>{t('assistant.tryLabel')}</p>
                <div className='flex flex-wrap gap-1.5'>
                  {EXAMPLES.map((key, index) => (
                    <button
                      key={key}
                      type='button'
                      style={{ animationDelay: `${index * 70}ms` }}
                      onClick={() => sendText(t(key))}
                      className={`${optionClass} rounded-full! px-3 py-1.5 text-caption font-medium`}
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showChoices && atOpening && !typing && (
            <div className='space-y-1.5 pt-1'>
              <p className='text-caption font-medium text-ink-3'>{t('assistant.sectionsLabel')}</p>
              <div className='grid grid-cols-2 gap-1.5'>
                {openingSections.map((q) => (
                  <button
                    key={q.id}
                    type='button'
                    onClick={() => handleQuickReply(q)}
                    className={`${optionClass} min-h-11 px-2.5 py-2 text-start text-caption font-semibold`}
                  >
                    <span className='line-clamp-2'>{quickReplyLabel(q)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showChoices && matchedDoctors.length > 0 && (
            <div className='space-y-2'>
              {matchedDoctors.map((doc, index) => {
                const hint = slotHints[String(doc._id)]
                return (
                  <DoctorChatCard
                    key={doc._id}
                    style={{ animationDelay: `${index * 80}ms` }}
                    doctor={doc}
                    displayName={personName(doc.name)}
                    specialtyLabel={sectionLabel(getDoctorSpecialty(doc))}
                    locationsLabel={getDoctorLocations(doc).map((loc) => translateLoc(loc)).join(' · ') || translateLoc(getDoctorPrimaryLocation(doc))}
                    feesLabel={
                      Number(doc.fees) > 0
                        ? formatMoneyAmount(Number(doc.fees), chatLang, (value) => localizeWesternDigits(value, chatLang))
                        : ''
                    }
                    nextSlots={hint?.slots || []}
                    slotsMatchRequest={hint?.matched !== false}
                    slotLabel={slotLabel}
                    onPickSlot={pickSlot}
                    onChoose={chooseDoctor}
                    t={t}
                  />
                )
              })}
            </div>
          )}

          {showChoices && quickReplies.length > 0 && (
            <div className='space-y-1.5'>
              {chatStep === CHAT_STEPS.SUGGESTING_ALTERNATIVES && (
                <p className='text-caption font-medium text-ink-3'>{t('assistant.suggestedLabel')}</p>
              )}
              <div className='flex flex-wrap gap-1.5'>
                {quickReplies.map((q) => (
                  <button
                    key={q.id}
                    type='button'
                    onClick={() => handleQuickReply(q)}
                    className={`${optionClass} px-3 py-2 text-caption font-semibold ${q.isFallback ? 'border-primary! bg-primary-soft! text-brand!' : ''}`}
                  >
                    {quickReplyLabel(q)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showChoices && appointmentTypeOptions.length > 0 && (
            <div className='grid grid-cols-2 gap-1.5'>
              {appointmentTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type='button'
                  onClick={() => chooseAppointmentType(opt.value)}
                  className={`${optionClass} min-h-11 px-3 py-2 text-start text-body-sm font-semibold`}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          )}

          {showChoices && chatStep === CHAT_STEPS.WAITING_HOME_AREA && bookingData.selectedDoctor && (
            <HomeAddressForm
              areas={getDoctorHomeVisitAreas(bookingData.selectedDoctor)}
              initial={bookingData.homeVisitAddress}
              areaLabel={(area) => translateLoc(area)}
              onSubmit={submitHomeAddress}
              t={t}
            />
          )}

          {showChoices && chatStep === CHAT_STEPS.WAITING_VISIT_FEE && (
            <div className='flex flex-col gap-1.5'>
              {CHATBOT_VISIT_FEE_TYPES.map((opt) => {
                const disabled = opt.value === 'consultation' && !canBookConsultation
                return (
                  <button
                    key={opt.value}
                    type='button'
                    disabled={disabled}
                    onClick={() => chooseVisitFeeType(opt.value)}
                    className={`${optionClass} min-h-11 px-3 py-2 text-start text-body-sm font-semibold disabled:pointer-events-none disabled:opacity-50`}
                  >
                    {t(opt.labelKey)}
                    {disabled && <span className='mt-0.5 block text-caption font-normal'>{t('assistant.followUpHint')}</span>}
                  </button>
                )
              })}
            </div>
          )}

          {showChoices && locationOptions.length > 0 && (
            <div className='flex flex-col gap-1.5'>
              {locationOptions.map((branch) => (
                <button
                  key={branch.loc}
                  type='button'
                  onClick={() => chooseLocation(branch)}
                  className={`${optionClass} px-3 py-2 text-start text-body-sm font-semibold`}
                >
                  <span className='block'>{translateLoc(branch.loc)}</span>
                  {branch.slotCount > 0 && (
                    <span className='mt-0.5 block text-caption font-normal text-ink-3'>
                      {localizeWesternDigits(fillTemplate(t('assistant.branchSlots'), { count: branch.slotCount }), chatLang)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {showChoices && dateOptions.length > 0 && (
            <div className='flex flex-wrap gap-1.5'>
              {dateOptions.map((d, index) => (
                <button
                  key={d.slotDate}
                  type='button'
                  style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                  onClick={() => chooseDate(d)}
                  className={`${optionClass} min-h-9 px-3 py-1.5 text-caption font-semibold`}
                >
                  {formatDayLabel(d.slotDate, chatLang, t)}
                </button>
              ))}
            </div>
          )}

          {showChoices && timeOptions.length > 0 && (
            <div className='flex flex-wrap gap-1.5'>
              {timeOptions.map((slot, index) => (
                <button
                  key={`${slot.time}-${slot.branch || ''}`}
                  type='button'
                  style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}
                  onClick={() => chooseTime(slot)}
                  className={`${optionClass} min-h-9 min-w-16 px-2.5 py-1.5 text-caption font-semibold`}
                >
                  {formatSlotTime(slot.time, chatLang, t)}
                </button>
              ))}
            </div>
          )}

          {showChoices && chatStep === STEP_NEEDS_LOGIN && (
            <Button
              fullWidth
              onClick={() => {
                setOpen(false)
                navigate('/login')
              }}
            >
              {t('assistant.login')}
            </Button>
          )}

          {showChoices && chatStep === CHAT_STEPS.CONFIRMING && (
            <AppointmentTicket rows={ticketRows(bookingData)} total={ticketTotal(bookingData)} t={t}>
              <Button fullWidth size='lg' loading={booking} onClick={submitBooking}>
                {t('assistant.confirm')}
              </Button>
              <div className='grid grid-cols-2 gap-2'>
                <Button
                  variant='ghost'
                  size='sm'
                  disabled={booking || typing}
                  onClick={() => {
                    pushHistory()
                    pushUserKey('assistant.changeTime')
                    backToDates()
                  }}
                >
                  {t('assistant.changeTime')}
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  disabled={booking || typing}
                  onClick={() => {
                    pushHistory()
                    pushUserKey('assistant.changeDoctor')
                    withThinking(backToDoctors)
                  }}
                >
                  {t('assistant.changeDoctor')}
                </Button>
              </div>
            </AppointmentTicket>
          )}

          {chatStep === CHAT_STEPS.SUCCESS && ticket && (
            <AppointmentTicket
              rows={ticketRows(bookingData)}
              total={ticketTotal(bookingData, ticket.amount)}
              reservationNumber={localizeWesternDigits(String(ticket.reservationNumber || ''), chatLang)}
              confirmed
              t={t}
            >
              <SuccessActions
                t={t}
                onCalendar={addToCalendar}
                onLeave={() => setOpen(false)}
                onNewBooking={() => {
                  resetFlow()
                  say('assistant.startedOver')
                }}
              />
            </AppointmentTicket>
          )}
        </div>
      </div>

      {showNavBar && (
        <div className='flex shrink-0 gap-1.5 border-t border-line bg-surface px-3 py-1.5'>
          <Button variant='ghost' size='sm' className='flex-1' disabled={!backEnabled || typing || booking} onClick={handleGoBack}>
            {t('assistant.back')}
          </Button>
          <Button variant='ghost' size='sm' className='flex-1' disabled={typing || booking} onClick={handleChangeSelection}>
            {t('assistant.change')}
          </Button>
          <Button variant='ghost' size='sm' className='flex-1' disabled={typing || booking} onClick={handleStartOver}>
            {t('assistant.startOver')}
          </Button>
        </div>
      )}

      <form
        className='shrink-0 border-t border-line bg-surface px-3 pb-2 pt-2.5'
        onSubmit={(e) => {
          e.preventDefault()
          handleTextSubmit()
        }}
      >
        {(speech.listening || voiceNotice) && (
          <p role='status' className={`mb-1.5 text-caption ${voiceNotice ? 'text-accent-ink' : 'text-ink-2'}`}>
            {t(voiceNotice || 'assistant.voice.listening')}
          </p>
        )}
        <div className='flex items-end gap-2'>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleTextSubmit()
              }
            }}
            aria-label={t('assistant.inputPlaceholder')}
            placeholder={t('assistant.inputPlaceholder')}
            maxLength={800}
            dir='auto'
            className='chatbot-input max-h-28 min-h-11 flex-1 resize-none rounded-control border border-field bg-surface px-3 py-2.5 leading-snug text-ink outline-none placeholder:text-ink-3 focus:border-primary'
          />
          {speech.supported && (
            <IconButton
              type='button'
              label={t(speech.listening ? 'assistant.voice.stop' : 'assistant.voice.start')}
              aria-pressed={speech.listening}
              variant={speech.listening ? 'accent' : 'secondary'}
              onClick={toggleVoice}
              className={speech.listening ? 'assistant-listening rounded-full!' : ''}
            >
              {speech.listening ? <MicOff className='size-5' /> : <Mic className='size-5' />}
            </IconButton>
          )}
          <IconButton
            type='submit'
            label={t('assistant.send')}
            variant='primary'
            disabled={typing || booking || !input.trim()}
          >
            <Send className='size-5 rtl:-scale-x-100' />
          </IconButton>
        </div>
        <p className='mt-1.5 text-center text-caption text-ink-3'>{t('assistant.disclaimer')}</p>
      </form>
    </div>
  )

  return createPortal(
    <>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={translateString(open ? 'Close chat' : 'Open booking assistant', siteLanguage)}
        className={
          open
            ? 'chatbot-launcher chatbot-launcher--open fixed bottom-4 end-3 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-brand transition-all duration-300 hover:bg-primary-dark active:scale-95 sm:hidden'
            : 'chatbot-launcher chatbot-launcher--closed group fixed bottom-4 end-3 z-[9999] flex h-[3.75rem] items-center gap-3 overflow-hidden rounded-full border border-white/20 bg-gradient-to-br from-primary to-primary-dark px-1.5 py-1.5 text-on-primary shadow-brand transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:border-white/35 active:scale-[0.98] max-[380px]:h-14 max-[380px]:w-14 max-[380px]:justify-center max-[380px]:p-0 sm:bottom-6 sm:end-6 sm:h-16 sm:gap-3.5 sm:ps-2 sm:pe-5'
        }
      >
        {open ? (
          <X className='h-5 w-5 sm:h-6 sm:w-6' />
        ) : (
          <>
            <span className='relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/25 backdrop-blur-sm transition duration-300 group-hover:bg-white/25 group-hover:ring-white/40 sm:h-12 sm:w-12'>
              <CalendarClock className='h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]' strokeWidth={2.25} />
              <span className='absolute -end-0.5 -top-0.5 flex h-3 w-3'>
                <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70' />
                <span className='relative inline-flex h-3 w-3 rounded-full border-2 border-primary-dark bg-success' />
              </span>
            </span>
            <span className='chatbot-launcher-copy min-w-0 flex-1 text-start max-[380px]:hidden'>
              <span className='block truncate text-sm font-bold leading-tight sm:text-[0.9375rem]'>
                {translateString('assistant.name', siteLanguage)}
              </span>
              <span className='mt-0.5 block truncate text-[11px] font-medium text-white/85 sm:text-xs'>
                {translateString('Start Chat', siteLanguage)}
              </span>
            </span>
          </>
        )}
      </button>
      {panel}
    </>,
    document.body
  )
}

/** Minutes since midnight for "05:30 PM", to match the server's reading of a typed time. */
const slotClockMinutes = (time = '') => {
  const match = String(time).match(/^(\d{1,2}):(\d{2})\s*([AP])M$/i)
  if (!match) return -1
  return ((Number(match[1]) % 12) + (match[3].toUpperCase() === 'P' ? 12 : 0)) * 60 + Number(match[2])
}

export default ChatbotWidget
