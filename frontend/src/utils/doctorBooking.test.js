import { describe, it, expect } from 'vitest'
import {
  hasDoctorPublishedSchedule,
  isDoctorBookableForPatients,
  isDoctorComingSoon,
  usesClinicWeeklySchedule,
  resolveClinicLocationForSlots,
} from './doctorBooking.js'

const doctorWithSchedule = (overrides = {}) => ({
  schedule: {
    workingDays: [1, 2, 3],
    startTime: '09:00',
    endTime: '17:00',
    slotDuration: 30,
    breaks: [],
    blockedDates: [],
  },
  locations: ['Branch A'],
  ...overrides,
})

describe('doctorBooking', () => {
  it('detects published clinic schedule', () => {
    expect(hasDoctorPublishedSchedule(doctorWithSchedule())).toBe(true)
    expect(hasDoctorPublishedSchedule({})).toBe(false)
  })

  it('uses patientBookable flag when provided', () => {
    expect(isDoctorBookableForPatients({ patientBookable: false, schedule: { workingDays: [1] } })).toBe(false)
    expect(isDoctorBookableForPatients(doctorWithSchedule())).toBe(true)
  })

  it('marks doctors without schedule as coming soon', () => {
    expect(isDoctorComingSoon({})).toBe(true)
    expect(isDoctorComingSoon(doctorWithSchedule())).toBe(false)
  })

  it('identifies clinic weekly schedule types', () => {
    expect(usesClinicWeeklySchedule('Clinic')).toBe(true)
    expect(usesClinicWeeklySchedule('Video Call')).toBe(true)
    expect(usesClinicWeeklySchedule('Home Visit')).toBe(false)
  })

  it('resolves single clinic location automatically', () => {
    const doctor = doctorWithSchedule({ locations: ['Only Branch'] })
    expect(resolveClinicLocationForSlots(doctor, '')).toBe('Only Branch')
    expect(resolveClinicLocationForSlots(doctor, 'Branch B')).toBe('Branch B')
    expect(resolveClinicLocationForSlots({ locations: ['A', 'B'] }, '')).toBe('')
  })
})
