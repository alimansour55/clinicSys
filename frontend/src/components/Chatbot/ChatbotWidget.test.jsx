import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../../i18n'
import { AppContext } from '../../context/AppContext'
import ChatbotWidget from './ChatbotWidget'
import { sendChatbotMessage, bookChatbotAppointment, fetchChatbotSlots } from '../../utils/chatbotApi'

vi.mock('../../utils/chatbotApi', () => ({
  sendChatbotMessage: vi.fn(),
  bookChatbotAppointment: vi.fn(),
  fetchChatbotSlots: vi.fn()
}))

vi.mock('axios', () => ({
  default: {
    get: vi.fn(async (url) =>
      url.includes('visit-fee-eligibility')
        ? { data: { success: true, canBookConsultation: false } }
        : { data: { success: true, doctors: [], appointments: [] } }
    )
  }
}))

const day = (offset) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`
}

const doctor = {
  _id: 'd1',
  name: 'Sara Ali',
  speciality: 'Dentist',
  fees: 300,
  available: true,
  patientBookable: true,
  locations: ['Maadi'],
  schedule: { workingDays: [0, 1, 2, 3, 4, 5, 6], startTime: '09:00', endTime: '17:00', slotDuration: 30, breaks: [], blockedDates: [] }
}

const slot = { slotDate: day(1), date: new Date().toISOString(), time: '10:00 AM', clinicLocation: 'Maadi', appointmentType: 'Clinic' }

const context = (overrides = {}) => ({
  backendUrl: 'http://api',
  token: 'tok',
  userData: { name: 'Mona Adel', phone: '01012345678' },
  doctors: [doctor],
  clinics: [],
  getDoctorsData: vi.fn(),
  getClinicsData: vi.fn(),
  placeTranslationOverrides: {},
  siteSettings: {},
  ...overrides
})

const server = (body) => ({ success: true, language: 'en', emergency: false, ...body })
const doctorsReply = server({
  reply: 'A dentist is the right place to start.',
  replyI18n: { en: 'A dentist is the right place to start.', ar: 'دكتور الأسنان هو الأنسب.' },
  intent: 'show_doctors',
  showDoctorPicker: true,
  suggestedSpecialty: 'Dentist',
  understood: { specialty: 'Dentist', dayPart: 'morning' },
  suggestedDoctors: [{ id: 'd1', nextSlots: [slot], slotsMatchRequest: true }]
})
const emergencyReply = server({
  reply: 'This could be a medical emergency. Call 123.',
  replyI18n: { en: 'This could be a medical emergency. Call 123.', ar: 'ده ممكن يكون طارئ. اتصل 123.' },
  intent: 'emergency',
  emergency: true,
  emergencyInfo: { category: 'cardiac', callNumber: '123', crisisNumber: null }
})

const mount = (overrides) =>
  render(
    <MemoryRouter>
      <LanguageProvider>
        <AppContext.Provider value={context(overrides)}>
          <ChatbotWidget />
        </AppContext.Provider>
      </LanguageProvider>
    </MemoryRouter>
  )

const openChat = () => fireEvent.click(screen.getByRole('button', { expanded: false }))
const box = () => screen.getByRole('textbox')
const type = async (text) => {
  fireEvent.change(box(), { target: { value: text } })
  await act(async () => {
    fireEvent.submit(box().closest('form'))
  })
}
const settled = () => waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 3000 })

describe('ChatbotWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
    sessionStorage.clear()
    localStorage.setItem('clinicSysLanguage', 'en')
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('puts an emergency first, with a call button and nothing bookable', async () => {
    sendChatbotMessage.mockResolvedValue(emergencyReply)
    mount()
    openChat()
    await type('chest pain')
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('link', { name: /123/ }).getAttribute('href')).toBe('tel:123')
    expect(screen.queryByText(/Next times/i)).toBeNull()
    expect(bookChatbotAppointment).not.toHaveBeenCalled()
  })

  it('still warns about a red flag when the server cannot be reached', async () => {
    sendChatbotMessage.mockRejectedValue(new Error('offline'))
    mount()
    openChat()
    await type('صدري بيوجعني جامد')
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('still warns when rate limited', async () => {
    sendChatbotMessage.mockRejectedValue({ response: { status: 429 } })
    mount()
    openChat()
    await type('I cannot breathe')
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('books in a sentence and a tap, only after confirming', async () => {
    sendChatbotMessage.mockResolvedValue(doctorsReply)
    bookChatbotAppointment.mockResolvedValue({ success: true, reservationNumber: 'R-77', appointment: { amount: 300 } })
    mount()
    openChat()
    await type('dentist tomorrow morning')
    await settled()

    fireEvent.click(await screen.findByRole('button', { name: /10:00/ }))
    await settled()
    expect(bookChatbotAppointment).not.toHaveBeenCalled()

    const confirm = await screen.findByRole('button', { name: 'Confirm booking' })
    await act(async () => fireEvent.click(confirm))

    await waitFor(() => expect(bookChatbotAppointment).toHaveBeenCalledTimes(1))
    const payload = bookChatbotAppointment.mock.calls[0][1]
    expect(payload).toMatchObject({ docId: 'd1', slotTime: '10:00 AM', slotDate: day(1), clinicLocation: 'Maadi', confirmed: true })
    expect(payload.symptoms).toBeUndefined()
    expect(payload.patientPhone).toBeUndefined()
    expect(await screen.findByText('R-77')).toBeTruthy()
  })

  it('a typed yes confirms only at the confirmation step', async () => {
    sendChatbotMessage.mockResolvedValue(server({ action: 'affirm', intent: 'affirm', reply: '', replyI18n: { en: '', ar: '' } }))
    mount()
    openChat()
    await type('yes')
    await settled()
    expect(bookChatbotAppointment).not.toHaveBeenCalled()
  })

  it('a typed yes under an emergency warning does not book', async () => {
    sendChatbotMessage.mockResolvedValueOnce(doctorsReply)
    mount()
    openChat()
    await type('dentist')
    await settled()
    fireEvent.click(await screen.findByRole('button', { name: /10:00/ }))
    await settled()
    await screen.findByRole('button', { name: 'Confirm booking' })

    sendChatbotMessage.mockResolvedValueOnce(emergencyReply)
    await type('chest pain')
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Confirm booking' })).toBeNull()

    sendChatbotMessage.mockResolvedValueOnce(server({ action: 'affirm', intent: 'affirm', replyI18n: { en: '', ar: '' } }))
    await type('yes')
    await settled()
    expect(bookChatbotAppointment).not.toHaveBeenCalled()
  })

  it('asks a logged-out patient to log in, and keeps their place', async () => {
    sendChatbotMessage.mockResolvedValue(doctorsReply)
    mount({ token: '', userData: null })
    openChat()
    await type('dentist')
    await settled()
    fireEvent.click(await screen.findByRole('button', { name: /10:00/ }))
    await screen.findByRole('button', { name: 'Log in to finish' })
    expect(bookChatbotAppointment).not.toHaveBeenCalled()
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem('clinivoAssistantSession')).chatStep).toBe('needs_login'))
  })

  it('offers the free times when a slot has just gone', async () => {
    sendChatbotMessage.mockResolvedValue(doctorsReply)
    bookChatbotAppointment.mockResolvedValue({ success: false, message: 'Slot not available' })
    fetchChatbotSlots.mockResolvedValue({ days: [{ slotDate: day(1), date: slot.date, slots: [{ time: '11:00 AM' }] }] })
    mount()
    openChat()
    await type('dentist')
    await settled()
    fireEvent.click(await screen.findByRole('button', { name: /10:00/ }))
    await settled()
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Confirm booking' })))
    expect(await screen.findByRole('button', { name: /11:00/ })).toBeTruthy()
  })

  it('sends only typed text to the server, with no patient details', async () => {
    sendChatbotMessage.mockResolvedValue(doctorsReply)
    mount()
    openChat()
    await type('dentist')
    await settled()
    fireEvent.click(await screen.findByRole('button', { name: /10:00/ }))
    await settled()
    await type('another thing')
    await settled()
    const request = sendChatbotMessage.mock.calls[1][1]
    expect(request.messages.map((m) => m.content)).toEqual(['dentist', 'another thing'])
    expect(JSON.stringify(request)).not.toContain('Mona')
    expect(JSON.stringify(request)).not.toContain('01012345678')
  })

  it('hides the microphone where the browser has no speech API', () => {
    mount()
    openChat()
    expect(screen.queryByRole('button', { name: /speak instead/i })).toBeNull()
  })

  it('writes what it hears into the box for review, in Egyptian Arabic', async () => {
    const instances = []
    window.SpeechRecognition = class {
      constructor() {
        instances.push(this)
      }
      start() {}
      stop() {
        this.onend?.()
      }
      abort() {}
    }
    localStorage.setItem('clinicSysLanguage', 'ar')
    mount()
    openChat()
    fireEvent.click(screen.getByRole('button', { name: /اتكلم بدل/ }))
    expect(instances[0].lang).toBe('ar-EG')

    act(() => instances[0].onresult({ results: [[{ transcript: 'ضرسي وجعني' }]] }))
    expect(box().value).toBe('ضرسي وجعني')
    expect(sendChatbotMessage).not.toHaveBeenCalled()
  })
})
