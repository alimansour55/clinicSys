import { describe, it, expect } from 'vitest'
import {
  hasDoctorPublishedSchedule,
  isDoctorBookableForPatients,
  isDoctorComingSoon,
  usesClinicWeeklySchedule,
  resolveClinicLocationForSlots,
} from './doctorBooking.js'

describe('doctorBooking', () => {
  const doctor = {
    schedule: { workingDays: [1, 2, 3] },
    locations: ['Branch'],
  }

  it('detects published schedule', () => {
    expect(hasDoctorPublishedSchedule(doctor)).toBe(true)
    expect(isDoctorComingSoon({})).toBe(true)
  })

  it('respects patientBookable override', () => {
    expect(isDoctorBookableForPatients({ patientBookable: false, schedule: { workingDays: [1] } })).toBe(
      false
    )
    expect(isDoctorBookableForPatients(doctor)).toBe(true)
  })

  it('resolves clinic location for slots', () => {
    expect(resolveClinicLocationForSlots({ locations: ['Only'] }, '')).toBe('Only')
    expect(usesClinicWeeklySchedule('Video Call')).toBe(true)
    expect(usesClinicWeeklySchedule('Home Visit')).toBe(false)
  })
})
