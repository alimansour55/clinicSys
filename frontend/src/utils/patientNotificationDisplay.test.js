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
})
