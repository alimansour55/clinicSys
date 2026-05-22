import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseMinutes, buildDoctorSlots, slotDateForCalendarOffset } from './schedule.js'

const baseDoctor = () => ({
  schedule: {
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    startTime: '09:00',
    endTime: '11:00',
    slotDuration: 30,
    breaks: [],
    blockedDates: [],
  },
  slots_booked: {},
  locations: ['Main'],
})

describe('schedule', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('parseMinutes', () => {
    it('parses 24h and 12h', () => {
      expect(parseMinutes('09:30')).toBe(570)
      expect(parseMinutes('09:30 PM')).toBe(1290)
    })
  })

  describe('slotDateForCalendarOffset', () => {
    it('formats calendar offset', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 4, 21, 10, 0, 0))
      expect(slotDateForCalendarOffset(0)).toBe('21_5_2026')
    })
  })

  describe('buildDoctorSlots', () => {
    it('returns empty when no published schedule', () => {
      expect(buildDoctorSlots({}, 2).every((r) => r.availableCount === 0)).toBe(true)
    })

    it('builds slots for published doctor', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 4, 21, 8, 0, 0))
      const rows = buildDoctorSlots(baseDoctor(), 2, 'Clinic', 'Main')
      expect(rows.some((r) => r.availableCount > 0)).toBe(true)
    })

    it('marks held slot at another branch unavailable', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 4, 21, 8, 0, 0))
      const doctor = { ...baseDoctor(), locations: ['A', 'B'] }
      const rows = buildDoctorSlots(doctor, 1, 'Clinic', 'A', {
        slotDate: slotDateForCalendarOffset(0),
        slotTime: '09:00 AM',
        sourceLocation: 'B',
      })
      const day = rows.find((r) => r.slots.length > 0)
      const held = day?.slots.find((s) => s.time === '09:00 AM')
      if (held) expect(held.available).toBe(false)
    })
  })
})
