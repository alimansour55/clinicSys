import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatPatientNotification, formatNotificationRelativeTime } from './patientNotificationDisplay.js'

describe('patientNotificationDisplay', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns stored title/message when no i18n template', () => {
    const out = formatPatientNotification({ title: 'Hi', message: 'Body' }, 'en')
    expect(out).toEqual({ title: 'Hi', message: 'Body' })
  })

  it('renders booked appointment template in Arabic', () => {
    const out = formatPatientNotification(
      {
        title: 'fallback',
        message: 'fallback',
        meta: {
          i18n: {
            templateId: 'patient_appt_booked_self',
            params: { doctorName: 'Smith', when: '21 May · 10:00' },
          },
        },
      },
      'ar'
    )
    expect(out.title).toBe('تم تأكيد الموعد')
    expect(out.message).toContain('Smith')
  })

  it('enriches cancellation byKey in English', () => {
    const out = formatPatientNotification(
      {
        title: '',
        message: '',
        meta: {
          i18n: {
            templateId: 'patient_appt_cancelled',
            params: { doctorName: 'Jones', when: 'tomorrow', byKey: 'receptionist' },
          },
        },
      },
      'en'
    )
    expect(out.message).toContain('Reception')
  })

  it('formatNotificationRelativeTime returns localized relative string', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T12:00:00Z'))
    const iso = new Date('2026-05-21T11:59:00Z').toISOString()
    const en = formatNotificationRelativeTime(iso, 'en')
    expect(en.length).toBeGreaterThan(0)
  })

  it('renders the waitlist offer and rescheduled templates in both languages', () => {
    const offer = { meta: { docId: 'd1', i18n: { templateId: 'patient_waitlist_offer', params: { doctorName: 'Smith', when: '2026/11/04 10:00 AM' } } } }
    expect(formatPatientNotification(offer, 'en')).toEqual({
      title: 'A slot opened for you',
      message: 'Dr. Smith has an opening (2026/11/04 10:00 AM). It is held for you for 15 minutes.',
    })
    expect(formatPatientNotification(offer, 'ar').title).toBe('توفّر موعد لك')
    expect(formatPatientNotification(offer, 'ar').message).toContain('د. Smith')

    const moved = { meta: { i18n: { templateId: 'patient_appt_rescheduled', params: { doctorName: 'Jones', when: '4 11 2026 · 10:00 AM' } } } }
    expect(formatPatientNotification(moved, 'en').message).toBe('Your visit with Dr. Jones is now on 4 11 2026 · 10:00 AM.')
    expect(formatPatientNotification(moved, 'ar').title).toBe('تم تغيير الموعد')
  })

  it('shows the doctor name passed in for the current language', () => {
    const moved = { meta: { i18n: { templateId: 'patient_appt_rescheduled', params: { doctorName: 'Jones', when: 'soon' } } } }
    expect(formatPatientNotification(moved, 'ar', { doctorName: 'جونز' }).message).toContain('د. جونز')
    expect(formatPatientNotification(moved, 'ar', { doctorName: '' }).message).toContain('د. Jones')
  })
})
