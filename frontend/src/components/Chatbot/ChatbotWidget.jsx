import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import { formatLocationLine } from '../../utils/placeTranslations'
import { isValidEgyptPhone, normalizeEgyptPhone } from '../../utils/egyptPhone'
import { isDoctorComingSoon } from '../../utils/doctorBooking'
import {
  detectLanguage,
  detectSpecialtyFromMessage,
  filterDoctorsBySpecialty,
  getDoctorPrimaryLocation,
  getDoctorSpecialty,
  SPECIALTY_IDS
} from '../../utils/chatbotSpecialty'
import axios from 'axios'
import { fetchChatbotSlots, bookChatbotAppointment } from '../../utils/chatbotApi'
import DoctorChatCard from './DoctorChatCard'

const CHAT_STEPS = {
  WAITING_SYMPTOMS: 'waiting_for_symptoms',
  CLARIFY_AUDIENCE: 'clarifying_audience',
  SHOWING_DOCTORS: 'showing_doctors',
  WAITING_DATE: 'waiting_for_date',
  WAITING_TIME: 'waiting_for_time',
  WAITING_NAME: 'waiting_for_patient_name',
  WAITING_PHONE: 'waiting_for_phone',
  CONFIRMING: 'confirming_booking',
  SUCCESS: 'booking_success',
  FAILED: 'booking_failed'
}

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
    getDoctorsData,
    displayPersonName,
    placeTranslationOverrides,
    currencySymbol
  } = useContext(AppContext)
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

  const [bookingData, setBookingData] = useState({
    symptoms: '',
    detectedSpecialty: '',
    selectedDoctor: null,
    date: null,
    slotDate: '',
    time: '',
    patientName: '',
    phone: ''
  })

  const listRef = useRef(null)
  const booted = useRef(false)

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

  const initialGreeting = () =>
    L(
      'Hi 👋 I can help you choose the right doctor and book an appointment. Tell me what problem you have.',
      'أهلاً 👋 أقدر أساعدك تختار الدكتور المناسب وتحجز موعد. اكتب لي ما المشكلة التي تعاني منها.'
    )

  const fallbackQuickReplies = () => [
    { id: 'skin', label: L('Skin problem', 'مشكلة جلدية'), specialty: SPECIALTY_IDS.DERMATOLOGIST },
    { id: 'child', label: L('Child doctor', 'طبيب أطفال'), specialty: SPECIALTY_IDS.PEDIATRICIANS },
    { id: 'headache', label: L('Headache', 'صداع'), specialty: SPECIALTY_IDS.NEUROLOGIST },
    { id: 'pregnancy', label: L('Pregnancy', 'حمل'), specialty: SPECIALTY_IDS.GYNECOLOGIST },
    { id: 'flu', label: L('Flu or fever', 'برد أو حرارة'), specialty: SPECIALTY_IDS.GENERAL }
  ]

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
    getDoctorsData?.()
  }, [open, siteLanguage])

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
  }, [messages, typing, matchedDoctors, quickReplies, dateOptions, timeOptions, chatStep])

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

  const showDoctorsForSpecialty = async (specialty, symptomsText) => {
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

    if (!list.length && specialty !== SPECIALTY_IDS.GENERAL) {
      pushBot(
        L(
          'I could not find doctors for this specialty. I can show you general physicians instead.',
          'مش لاقي دكاترة في التخصص ده حالياً. أقدر أعرض عليك أطباء عامين بدل ذلك.'
        )
      )
      list = filterDoctorsBySpecialty(source, SPECIALTY_IDS.GENERAL)
      specialty = SPECIALTY_IDS.GENERAL
    }

    if (!list.length) {
      pushBot(
        L(
          'No doctors are available for booking right now. Please try again later.',
          'لا يوجد أطباء متاحين للحجز حالياً. حاول مرة أخرى لاحقاً.'
        )
      )
      setMatchedDoctors([])
      setQuickReplies(fallbackQuickReplies())
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

  const handleSymptomMessage = async (text) => {
    const lang = detectLanguage(text)
    setChatLang(lang)

    const { specialty, needsClarification } = detectSpecialtyFromMessage(text)

    if (needsClarification === 'adult_or_child') {
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
          'Can you describe your problem more clearly? For example: skin problem, child fever, headache, pregnancy, or flu.',
          'ممكن توضح المشكلة أكثر؟ مثال: مشكلة جلدية، حرارة لطفل، صداع، حمل، أو برد.'
        )
      )
      return
    }

    await showDoctorsForSpecialty(specialty, text)
  }

  const handleQuickReply = async (reply) => {
    pushUser(reply.label)
    setQuickReplies([])

    if (chatStep === CHAT_STEPS.CLARIFY_AUDIENCE) {
      await showDoctorsForSpecialty(reply.specialty, bookingData.symptoms)
      return
    }

    await showDoctorsForSpecialty(reply.specialty, reply.label)
  }

  const loadSlotsForDoctor = async (doctor) => {
    const data = await fetchChatbotSlots(backendUrl, {
      docId: doctor._id,
      days: 14,
      clinicLocation
    })
    if (!data.success) throw new Error(data.message || 'Failed to load slots')
    if (data.clinicLocation) setClinicLocation(data.clinicLocation)
    const days = data.days || []
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
    return days
  }

  const chooseDoctor = async (doctor) => {
    if (isDoctorComingSoon(doctor)) return

    setBookingData((b) => ({
      ...b,
      selectedDoctor: doctor,
      date: null,
      slotDate: '',
      time: ''
    }))
    setMatchedDoctors([])
    setChatStep(CHAT_STEPS.WAITING_DATE)

    await withTyping(async () => {
      try {
        const days = await loadSlotsForDoctor(doctor)
        if (!days.length) {
          pushBot(
            L(
              'This doctor has no available slots right now. Please choose another doctor.',
              'لا توجد مواعيد متاحة لهذا الطبيب حالياً. اختار دكتوراً آخر.'
            )
          )
          setChatStep(CHAT_STEPS.WAITING_SYMPTOMS)
          return
        }
        pushBot(
          L(
            `Great. You chose ${displayPersonName(doctor.name)}. What date works for you?`,
            `تمام. اخترت ${displayPersonName(doctor.name)}. إيه اليوم المناسب ليك؟`
          )
        )
      } catch {
        pushBot(
          L(
            'Sorry, I could not load available times. Please try again.',
            'آسف، لم أتمكن من تحميل المواعيد. حاول مرة أخرى.'
          )
        )
      }
    })
  }

  const chooseDate = (opt) => {
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

  const chooseTime = (slot) => {
    const next = {
      ...bookingData,
      time: slot.time,
      patientName: bookingData.patientName || userData?.name || '',
      phone: bookingData.phone || userData?.phone || ''
    }
    setBookingData(next)
    setTimeOptions([])
    pushUser(localizeDigits(slot.time))

    if (token && next.patientName && next.phone) {
      goToConfirm(next)
      return
    }

    if (token && next.patientName) {
      setChatStep(CHAT_STEPS.WAITING_PHONE)
      pushBot(L('Please enter your phone number:', 'من فضلك أدخل رقم هاتفك:'))
      return
    }

    setChatStep(CHAT_STEPS.WAITING_NAME)
    pushBot(L('Please enter your full name:', 'من فضلك أدخل اسمك الكامل:'))
  }

  const goToConfirm = (data = bookingData) => {
    setChatStep(CHAT_STEPS.CONFIRMING)
    const d = data.selectedDoctor
    const dateLabel = data.date
      ? new Date(data.date).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        })
      : ''
    pushBot(
      L(
        `Booking summary:\n• Doctor: ${displayPersonName(d?.name)}\n• Specialty: ${tc(getDoctorSpecialty(d))}\n• Date: ${dateLabel}\n• Time: ${data.time}\n• Name: ${data.patientName}\n• Phone: ${data.phone}\n\nTap Confirm to book.`,
        `ملخص الحجز:\n• الدكتور: ${displayPersonName(d?.name)}\n• التخصص: ${tc(getDoctorSpecialty(d))}\n• التاريخ: ${dateLabel}\n• الوقت: ${localizeDigits(data.time)}\n• الاسم: ${data.patientName}\n• الهاتف: ${data.phone}\n\nاضغط تأكيد لإتمام الحجز.`
      )
    )
  }

  const submitBooking = async () => {
    const { selectedDoctor, slotDate, time, patientName, phone, symptoms } = bookingData
    if (!selectedDoctor || !slotDate || !time) return

    if (!token && (!patientName?.trim() || !phone?.trim())) {
      toast.info(L('Please log in to complete booking', 'يرجى تسجيل الدخول لإتمام الحجز'))
      navigate('/login')
      return
    }

    if (!isValidEgyptPhone(phone)) {
      pushBot(L('Please enter a valid phone number.', 'من فضلك أدخل رقم هاتف صحيح.'))
      setChatStep(CHAT_STEPS.WAITING_PHONE)
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
          paymentMethod: 'Cash',
          symptoms,
          patientName: patientName.trim(),
          patientPhone: normalizeEgyptPhone(phone) || phone
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

        case CHAT_STEPS.WAITING_NAME:
          setBookingData((b) => ({ ...b, patientName: text }))
          setChatStep(CHAT_STEPS.WAITING_PHONE)
          pushBot(L('Please enter your phone number:', 'من فضلك أدخل رقم هاتفك:'))
          break

        case CHAT_STEPS.WAITING_PHONE: {
          if (!isValidEgyptPhone(text)) {
            pushBot(L('Please enter a valid phone number.', 'من فضلك أدخل رقم هاتف صحيح.'))
            break
          }
          setBookingData((b) => {
            const next = { ...b, phone: normalizeEgyptPhone(text) || text }
            goToConfirm(next)
            return next
          })
          break
        }

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
      className={`fixed z-[9998] flex flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl transition-all
        left-2 right-2 bottom-[4.5rem] max-h-[min(85dvh,calc(100dvh-5rem))] rounded-2xl
        sm:left-auto sm:right-6 sm:bottom-6 sm:w-[min(100%,400px)] sm:max-h-[min(88dvh,680px)]
        ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}
      `}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-3 py-2.5">
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

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 p-2.5">
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
                  feesLabel={
                    doc.fees
                      ? `${currencySymbol}${localizeDigits(String(doc.fees))}`
                      : ''
                  }
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

          {quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {quickReplies.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handleQuickReply(q)}
                  className="rounded-full border border-primary/30 bg-white px-3 py-1.5 text-xs font-medium text-primary shadow-sm hover:bg-primary/5"
                >
                  {q.label}
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

      <form
        className="flex shrink-0 gap-2 border-t border-gray-100 bg-white p-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          handleTextSubmit()
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={L('Type your message...', 'اكتب رسالتك...')}
          className="min-h-[40px] flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          dir={isRtl ? 'rtl' : 'ltr'}
          disabled={chatStep === CHAT_STEPS.SUCCESS}
        />
        <button
          type="submit"
          disabled={typing || !input.trim() || chatStep === CHAT_STEPS.SUCCESS}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-50"
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
