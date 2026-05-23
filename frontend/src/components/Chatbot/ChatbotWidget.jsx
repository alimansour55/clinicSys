import React, { useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircle, X, Send, Loader2, Calendar, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
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
  const { backendUrl, token, userData, displayPersonName } = useContext(AppContext)
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
    setSuggestedDoctors([])
    setSelectedDoctor(null)
    setSlotDays([])
    setSelectedSlot(null)
    setLocations([])

    if (!symptoms && text.length > 3 && !/^(hi|hello|hey|مرحب|اهلا)/i.test(text)) {
      setSymptoms(text)
    }

    try {
      const data = await sendChatbotMessage(backendUrl, {
        messages: nextMessages.filter((m) => m.role === 'user' || m.role === 'assistant'),
        language: lang,
        bookingContext: {},
        token
      })

      if (!data.success) {
        toast.error(data.message || t('Something went wrong'))
        return
      }

      if (data.language) setChatLanguage(data.language)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])

      if (data.showDoctorPicker && data.suggestedDoctors?.length) {
        setSuggestedDoctors(data.suggestedDoctors)
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
        return
      }

      setLocations(data.locations || [])
      if (data.clinicLocation) setClinicLocation(data.clinicLocation)
      const days = data.days || []
      setSlotDays(days)

      if (!days.length) {
        toast.info(t('No times available for this doctor'))
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
          symptoms,
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
      weekday: 'long',
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
      className={`fixed bottom-24 right-4 z-[9998] flex w-[min(100vw-2rem,400px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition-all sm:bottom-6 sm:right-6 ${
        open ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
      }`}
      dir={isRtl ? 'rtl' : 'ltr'}
      aria-hidden={!open}
    >
      <header className="flex items-center justify-between gap-2 bg-primary px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate font-semibold">{t('Booking assistant')}</p>
          <p className="truncate text-xs text-white/80">{t('Chat with us to book')}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          aria-label={t('Close chat')}
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div ref={listRef} className="flex max-h-[min(56vh,440px)] min-h-[300px] flex-1 flex-col gap-3 overflow-y-auto bg-gray-50 p-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
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
          <div className="rounded-xl border border-blue-100 bg-white p-2.5">
            <p className="mb-2 text-xs font-semibold text-gray-700">{t('Choose a doctor')}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {suggestedDoctors.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => selectDoctor(doc)}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 text-left transition hover:border-primary hover:bg-blue-50"
                >
                  {doc.image ? (
                    <img src={doc.image} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-primary">
                      {displayPersonName(doc.name).charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0">
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
          <div className="rounded-xl border border-emerald-100 bg-white p-2.5">
            <p className="mb-2 text-xs font-semibold text-gray-700">{t('Select a clinic branch')}</p>
            <div className="flex flex-wrap gap-2">
              {locations.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => loadSlotsForBranch(loc)}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800"
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
        )}

        {slotDays.length > 0 && selectedDoctor && (
          <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-2.5">
            <p className="text-xs font-semibold text-gray-800">{t('Pick date and time')}</p>
            <p className="text-[11px] text-gray-500">{t('Tap a time below')}</p>

            {selectedSlot && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-2 text-xs font-medium text-primary">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {t('Selected appointment')}: {selectedSlotLabel}
                </span>
              </div>
            )}

            <div className="max-h-44 space-y-3 overflow-y-auto pr-0.5">
              {slotDays.slice(0, 7).map((day) => (
                <div key={day.slotDate} className="border-b border-gray-100 pb-2 last:border-0">
                  <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-gray-600">
                    <Calendar className="h-3 w-3" />
                    {formatDayLabel(day.date)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {day.slots.map((slot) => (
                      <button
                        key={`${day.slotDate}-${slot.time}`}
                        type="button"
                        onClick={() => setSelectedSlot({ slotDate: day.slotDate, time: slot.time })}
                        className={`min-w-[4.5rem] rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                          selectedSlot?.slotDate === day.slotDate && selectedSlot?.time === slot.time
                            ? 'bg-primary text-white shadow-sm'
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
          <div className="space-y-2 rounded-xl border border-primary/25 bg-white p-3 shadow-sm">
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

      <form
        className="flex items-end gap-2 border-t border-gray-200 bg-white p-3"
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
          className="max-h-24 min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
          dir={messageLooksArabic(input) ? 'rtl' : isRtl ? 'rtl' : 'ltr'}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-50"
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
        className={`fixed bottom-6 right-4 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:scale-105 hover:bg-primary/90 sm:right-6 ${
          open ? 'ring-4 ring-primary/30' : ''
        }`}
        aria-label={open ? t('Close chat') : t('Open booking assistant')}
        aria-expanded={open}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
      {panel}
    </>
  )

  return createPortal(fab, document.body)
}

export default ChatbotWidget
