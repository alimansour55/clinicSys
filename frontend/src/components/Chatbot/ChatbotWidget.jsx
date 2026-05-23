import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircle, X, Send, Loader2, Calendar, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import { translatePlaceSegment } from '../../utils/placeTranslations'
import {
  sendChatbotMessage,
  fetchChatbotSlots,
  bookChatbotAppointment,
  messageLooksArabic
} from '../../utils/chatbotApi'

const GREETING_KEY = 'Hello! How can I help you today? Please tell me your symptoms or health concern.'

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-3 py-2">
    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
  </div>
)

const ChatbotWidget = () => {
  const { backendUrl, token, userData, displayPersonName, placeTranslationOverrides } =
    useContext(AppContext)
  const { language: siteLanguage, t, tc, localizeDigits } = useLanguage()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState(false)
  const [chatLanguage, setChatLanguage] = useState(siteLanguage)
  const [messages, setMessages] = useState([])
  const [suggestedDoctors, setSuggestedDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [slotDays, setSlotDays] = useState([])
  const [locations, setLocations] = useState([])
  const [clinicLocation, setClinicLocation] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [symptoms, setSymptoms] = useState('')

  const listRef = useRef(null)
  const initialized = useRef(false)

  const isRtl = chatLanguage === 'ar'

  const translateLocation = (loc) =>
    translatePlaceSegment(loc, isRtl ? 'ar' : 'en', t, placeTranslationOverrides)

  const symptomsSummary = useMemo(() => {
    const parts = messages
      .filter((m) => m.role === 'user')
      .map((m) => String(m.content || '').trim())
      .filter((c) => c && !/^(hi|hello|hey|مرحب|اهلا)/i.test(c))
    return symptoms || parts.join(' · ')
  }, [messages, symptoms])

  const bookingContext = useMemo(
    () => ({
      docId: selectedDoctor?.id || '',
      specialty: selectedDoctor?.speciality || '',
      clinicLocation,
      stage: selectedDoctor ? (selectedSlot ? 'slot_selected' : 'doctor_selected') : 'intake',
      symptoms: symptomsSummary
    }),
    [selectedDoctor, clinicLocation, selectedSlot, symptomsSummary]
  )

  useEffect(() => {
    if (userData?.name) setPatientName(userData.name)
    if (userData?.phone) setPatientPhone(userData.phone)
  }, [userData])

  useEffect(() => {
    setChatLanguage(siteLanguage)
  }, [siteLanguage])

  useEffect(() => {
    if (!open || initialized.current) return
    initialized.current = true
    setMessages([{ role: 'assistant', content: t(GREETING_KEY) }])
  }, [open, t])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, slotDays, suggestedDoctors, selectedSlot])

  const resolveLang = (text) => {
    if (messageLooksArabic(text)) return 'ar'
    if (/[a-z]/i.test(text)) return 'en'
    return chatLanguage || siteLanguage
  }

  const handleSend = async (textOverride) => {
    const text = String(textOverride ?? input).trim()
    if (!text || loading) return

    const lang = resolveLang(text)
    setChatLanguage(lang)
    setInput('')

    const userMsg = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setLoading(true)

    // Only reset doctor list when still choosing a doctor (not during scheduling)
    if (!selectedDoctor) {
      setSuggestedDoctors([])
      setSlotDays([])
      setSelectedSlot(null)
      setLocations([])
    }

    if (!symptoms && text.length > 3 && !/^(hi|hello|hey|مرحب|اهلا|صباح)/i.test(text)) {
      setSymptoms((prev) => (prev ? `${prev} · ${text}` : text))
    }

    try {
      const data = await sendChatbotMessage(backendUrl, {
        messages: nextMessages.filter((m) => m.role === 'user' || m.role === 'assistant'),
        language: lang,
        bookingContext,
        token
      })

      if (!data.success) {
        toast.error(data.message || t('Something went wrong'))
        return
      }

      if (data.language) setChatLanguage(data.language)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])

      if (data.selectedDoctor) {
        setSelectedDoctor(data.selectedDoctor)
      }

      if (data.showSlotPicker && data.slotDays) {
        setSlotDays(data.slotDays)
        if (data.clinicLocation) setClinicLocation(data.clinicLocation)
        if (data.locations?.length) setLocations(data.locations)
        setSuggestedDoctors([])
      } else if (data.showDoctorPicker && data.suggestedDoctors?.length) {
        setSuggestedDoctors(data.suggestedDoctors)
      } else if (!selectedDoctor) {
        setSuggestedDoctors([])
      }

      if (data.needsClinicLocation && data.locations?.length) {
        setLocations(data.locations)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectDoctor = async (doctor) => {
    setSelectedDoctor(doctor)
    setSelectedSlot(null)
    setSlotDays([])
    setLocations([])
    setSuggestedDoctors([])
    setLoading(true)

    try {
      const data = await fetchChatbotSlots(backendUrl, {
        docId: doctor.id,
        days: 10,
        clinicLocation
      })

      if (!data.success) {
        toast.error(data.message)
        return
      }

      if (data.needsClinicLocation && data.locations?.length) {
        setLocations(data.locations)
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: isRtl
              ? `اختر فرع العيادة لـ ${displayPersonName(doctor.name)}:`
              : `Choose a clinic branch for ${displayPersonName(doctor.name)}:`
          }
        ])
        return
      }

      setLocations(data.locations || [])
      if (data.clinicLocation) setClinicLocation(data.clinicLocation)
      const days = data.days || []
      setSlotDays(days)

      if (!days.length) {
        toast.info(t('No times available for this doctor'))
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: isRtl
              ? `اختر الموعد المناسب مع ${displayPersonName(doctor.name)} من الأوقات أدناه، أو اكتب "غداً" / يوماً محدداً.`
              : `Pick a time with ${displayPersonName(doctor.name)} below, or type "tomorrow" / a specific day.`
          }
        ])
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadSlotsForBranch = async (branch) => {
    setClinicLocation(branch)
    if (!selectedDoctor) return
    setLoading(true)
    try {
      const data = await fetchChatbotSlots(backendUrl, {
        docId: selectedDoctor.id,
        clinicLocation: branch,
        days: 10
      })
      if (data.success) setSlotDays(data.days || [])
    } finally {
      setLoading(false)
    }
  }

  const confirmBooking = async () => {
    if (!selectedDoctor || !selectedSlot) return

    if (!token && (!patientName.trim() || !patientPhone.trim())) {
      toast.info(t('Please log in to complete booking'))
      navigate('/login')
      return
    }

    setBooking(true)
    try {
      const data = await bookChatbotAppointment(
        backendUrl,
        {
          docId: selectedDoctor.id,
          slotDate: selectedSlot.slotDate,
          slotTime: selectedSlot.time,
          clinicLocation,
          paymentMethod: 'Cash',
          symptoms: symptomsSummary,
          patientName: patientName.trim(),
          patientPhone: patientPhone.trim()
        },
        token
      )

      if (data.needLogin || data.needRegistration) {
        toast.info(data.message || t('Please log in to complete booking'))
        navigate('/login')
        return
      }

      if (!data.success) {
        toast.error(data.message)
        return
      }

      const confirmMsg = isRtl
        ? `${t('Booking complete message')} ${t('Reservation number')}: ${localizeDigits(String(data.reservationNumber || ''))}`
        : `${t('Booking complete message')} ${t('Reservation number')}: ${data.reservationNumber}`

      setMessages((prev) => [...prev, { role: 'assistant', content: confirmMsg }])
      toast.success(t('Booking confirmed'))
      setSuggestedDoctors([])
      setSelectedDoctor(null)
      setSelectedSlot(null)
      setSlotDays([])
    } catch (err) {
      toast.error(err.response?.data?.message || err.message)
    } finally {
      setBooking(false)
    }
  }

  const formatDayLabel = (isoDate) => {
    const d = new Date(isoDate)
    return d.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const selectedSlotLabel =
    selectedSlot && selectedDoctor
      ? `${formatDayLabel(slotDays.find((d) => d.slotDate === selectedSlot.slotDate)?.date || new Date())} · ${localizeDigits(selectedSlot.time)}`
      : ''

  const panel = (
    <div
      className={`fixed z-[9998] flex flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl transition-all
        inset-x-2 bottom-[4.75rem] max-h-[min(82dvh,calc(100dvh-5.5rem))] w-auto rounded-2xl
        sm:inset-x-auto sm:bottom-6 sm:right-6 sm:left-auto sm:w-[min(calc(100vw-1.5rem),400px)] sm:max-h-[min(85dvh,640px)]
        ${open ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}
      `}
      dir={isRtl ? 'rtl' : 'ltr'}
      aria-hidden={!open}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 bg-primary px-3 py-2.5 text-white sm:px-4 sm:py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold sm:text-base">{t('Booking assistant')}</p>
          <p className="truncate text-[11px] text-white/80 sm:text-xs">{t('Chat with us to book')}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 sm:h-9 sm:w-9"
          aria-label={t('Close chat')}
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gray-50 p-2.5 sm:p-3"
      >
        <div className="flex flex-col gap-2.5 sm:gap-3">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13px] leading-relaxed sm:max-w-[88%] sm:text-sm ${
                  msg.role === 'user'
                    ? 'rounded-br-md bg-primary text-white'
                    : 'rounded-bl-md border border-gray-200 bg-white text-gray-800'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-gray-200 bg-white">
                <TypingIndicator />
                <span className="sr-only">{t('Assistant is typing')}</span>
              </div>
            </div>
          )}

          {suggestedDoctors.length > 0 && !selectedDoctor && (
            <div className="rounded-xl border border-blue-100 bg-white p-2">
              <p className="mb-2 text-xs font-semibold text-gray-700">{t('Choose a doctor')}</p>
              <div className="grid grid-cols-1 gap-1.5">
                {suggestedDoctors.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => selectDoctor(doc)}
                    className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 text-left transition hover:border-primary hover:bg-blue-50"
                  >
                    {doc.image ? (
                      <img src={doc.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-primary">
                        {displayPersonName(doc.name).charAt(0)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-gray-900">
                        {displayPersonName(doc.name)}
                      </span>
                      <span className="block truncate text-[11px] text-gray-500">{tc(doc.speciality)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {locations.length > 1 && selectedDoctor && !slotDays.length && (
            <div className="rounded-xl border border-emerald-100 bg-white p-2">
              <p className="mb-2 text-xs font-semibold text-gray-700">{t('Select a clinic branch')}</p>
              <div className="flex flex-wrap gap-1.5">
                {locations.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => loadSlotsForBranch(loc)}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800"
                  >
                    {translateLocation(loc)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {slotDays.length > 0 && selectedDoctor && (
            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-2">
              <p className="text-xs font-semibold text-gray-800">
                {t('Pick date and time')} — {displayPersonName(selectedDoctor.name)}
              </p>

              {selectedSlot && (
                <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1.5 text-[11px] font-medium text-primary">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {t('Selected appointment')}: {selectedSlotLabel}
                  </span>
                </div>
              )}

              <div className="max-h-36 space-y-2 overflow-y-auto">
                {slotDays.slice(0, 7).map((day) => (
                  <div key={day.slotDate}>
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      <Calendar className="h-3 w-3" />
                      {formatDayLabel(day.date)}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {day.slots.map((slot) => (
                        <button
                          key={`${day.slotDate}-${slot.time}`}
                          type="button"
                          onClick={() => setSelectedSlot({ slotDate: day.slotDate, time: slot.time })}
                          className={`rounded-md px-2 py-1 text-[10px] font-semibold sm:text-[11px] ${
                            selectedSlot?.slotDate === day.slotDate && selectedSlot?.time === slot.time
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-800 hover:bg-blue-100'
                          }`}
                        >
                          {localizeDigits(slot.time)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedSlot && selectedDoctor && (
            <div className="space-y-2 rounded-xl border border-primary/25 bg-white p-2.5">
              {!token && (
                <>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder={t('Your name')}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    dir={isRtl ? 'rtl' : 'ltr'}
                  />
                  <input
                    type="tel"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    placeholder={t('Your phone')}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    dir="ltr"
                  />
                </>
              )}
              <input
                type="text"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder={t('Reason for visit')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                dir={isRtl ? 'rtl' : 'ltr'}
              />
              <button
                type="button"
                disabled={booking}
                onClick={confirmBooking}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('Confirm booking')}
              </button>
            </div>
          )}
        </div>
      </div>

      <form
        className="flex shrink-0 items-end gap-2 border-t border-gray-200 bg-white p-2.5 sm:p-3"
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          rows={1}
          placeholder={t('Type your symptoms or question...')}
          className="max-h-20 min-h-[40px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          dir={messageLooksArabic(input) ? 'rtl' : isRtl ? 'rtl' : 'ltr'}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-50 sm:h-11 sm:w-11"
          aria-label={t('Send message')}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
    </div>
  )

  const fab = (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-4 right-3 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:bg-primary/90 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14 ${
          open ? 'ring-4 ring-primary/30' : ''
        }`}
        aria-label={open ? t('Close chat') : t('Open booking assistant')}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />}
      </button>
      {panel}
    </>
  )

  return createPortal(fab, document.body)
}

export default ChatbotWidget
