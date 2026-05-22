import { describe, it, expect } from 'vitest'
import {
  sanitizeSchedule,
  getDoctorSchedule,
  getBookedSlotsField,
  isSlotAllowedBySchedule,
  validateDoctorNoScheduleOverlap,
  hasDoctorPublishedSchedule,
  isDoctorOpenForPatientBooking,
} from '../services/scheduleService.js'
import { doctorWithClinicSchedule, futureSlotOnWeekday } from './helpers/fixtures.js'

describe('scheduleService', () => {
  describe('sanitizeSchedule', () => {
    it('normalizes valid schedule', () => {
      const result = sanitizeSchedule({
        workingDays: [1, 2],
        startTime: '09:00',
        endTime: '12:00',
        slotDuration: 30,
        breaks: [{ startTime: '10:00', endTime: '10:30' }],
        blockedDates: ['2026-12-01'],
      })
      expect(result.workingDays).toEqual([1, 2])
      expect(result.slotDuration).toBe(30)
      expect(result.blockedDates).toEqual(['2026-12-01'])
    })

    it('throws when start is not before end', () => {
      expect(() => sanitizeSchedule({ startTime: '18:00', endTime: '09:00' })).toThrow(/start time/)
    })

    it('throws for invalid slot duration', () => {
      expect(() => sanitizeSchedule({ slotDuration: 3 })).toThrow(/Slot duration/)
    })
  })

  describe('getDoctorSchedule', () => {
    it('uses home visit schedule for home visits', () => {
      const doctor = doctorWithClinicSchedule()
      const schedule = getDoctorSchedule(doctor, 'Home Visit')
      expect(schedule.slotDuration).toBe(60)
      expect(schedule.workingDays).toEqual([1, 3])
    })

    it('merges branch schedule when location key provided', () => {
      const doctor = doctorWithClinicSchedule({
        locationSchedules: {
          'Main Branch': { workingDays: [2, 4], startTime: '08:00', endTime: '16:00' },
        },
      })
      const schedule = getDoctorSchedule(doctor, 'Clinic', 'Main Branch')
      expect(schedule.workingDays).toEqual([2, 4])
      expect(schedule.startTime).toBe('08:00')
    })
  })

  describe('getBookedSlotsField', () => {
    it('maps appointment type to booked slots field', () => {
      expect(getBookedSlotsField('Home Visit')).toBe('home_visit_slots_booked')
      expect(getBookedSlotsField('Clinic')).toBe('slots_booked')
    })
  })

  describe('isSlotAllowedBySchedule', () => {
    it('allows a valid future clinic slot', () => {
      const doctor = doctorWithClinicSchedule({
        schedule: {
          workingDays: [0, 1, 2, 3, 4, 5, 6],
          startTime: '09:00',
          endTime: '17:00',
          slotDuration: 30,
          breaks: [],
          blockedDates: [],
        },
        homeVisitSchedule: { workingDays: [], startTime: '10:00', endTime: '14:00', slotDuration: 60, breaks: [], blockedDates: [] },
      })
      const { slotDate, slotTime, date } = futureSlotOnWeekday(2)
      doctor.schedule.workingDays = [date.getDay()]

      const result = isSlotAllowedBySchedule(doctor, slotDate, slotTime, 'Clinic', 'Main Branch')
      expect(result.allowed).toBe(true)
    })

    it('rejects past slots', () => {
      const doctor = doctorWithClinicSchedule()
      const result = isSlotAllowedBySchedule(doctor, '1_1_2020', '10:00', 'Clinic')
      expect(result.allowed).toBe(false)
      expect(result.reason).toMatch(/past/)
    })

    it('rejects when doctor has no published schedule', () => {
      const result = isSlotAllowedBySchedule({ schedule: {} }, '1_6_2030', '10:00')
      expect(result.allowed).toBe(false)
      expect(result.reason).toMatch(/not published/)
    })
  })

  describe('validateDoctorNoScheduleOverlap', () => {
    it('detects clinic vs home visit overlap on same weekday', () => {
      const doctor = doctorWithClinicSchedule({
        schedule: {
          workingDays: [1],
          startTime: '09:00',
          endTime: '17:00',
          slotDuration: 30,
          breaks: [],
          blockedDates: [],
        },
        homeVisitSchedule: {
          workingDays: [1],
          startTime: '10:00',
          endTime: '14:00',
          slotDuration: 60,
          breaks: [],
          blockedDates: [],
        },
      })
      const msg = validateDoctorNoScheduleOverlap(doctor)
      expect(msg).toMatch(/Schedule overlap/)
    })

    it('returns null when only one layer exists', () => {
      const doctor = doctorWithClinicSchedule({ homeVisitSchedule: { workingDays: [] } })
      expect(validateDoctorNoScheduleOverlap(doctor)).toBeNull()
    })
  })

  describe('hasDoctorPublishedSchedule / isDoctorOpenForPatientBooking', () => {
    it('reflects whether weekly slots exist', () => {
      expect(hasDoctorPublishedSchedule(doctorWithClinicSchedule())).toBe(true)
      expect(isDoctorOpenForPatientBooking(doctorWithClinicSchedule())).toBe(true)
      expect(hasDoctorPublishedSchedule({})).toBe(false)
    })
  })
})
