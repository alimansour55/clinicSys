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
    it('parses 24h and 12h times', () => {
      expect(parseMinutes('09:30')).toBe(570)
      expect(parseMinutes('09:30 AM')).toBe(570)
      expect(parseMinutes('09:30 PM')).toBe(1290)
    })

    it('returns null for invalid input', () => {
      expect(parseMinutes('')).toBeNull()
      expect(parseMinutes('invalid')).toBeNull()
    })
  })

  describe('slotDateForCalendarOffset', () => {
    it('formats today offset as d_m_y', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 4, 21, 12, 0, 0))
      expect(slotDateForCalendarOffset(0)).toBe('21_5_2026')
      expect(slotDateForCalendarOffset(1)).toBe('22_5_2026')
    })
  })

  describe('buildDoctorSlots', () => {
    it('returns empty rows when doctor has no published schedule', () => {
      const rows = buildDoctorSlots({}, 3)
      expect(rows).toHaveLength(3)
      expect(rows.every((r) => r.availableCount === 0)).toBe(true)
    })

    it('builds available slots on working days', () => {
      vi.useFakeTimers()
      const now = new Date(2026, 4, 21, 8, 0, 0)
      vi.setSystemTime(now)

      const doctor = baseDoctor()
      const rows = buildDoctorSlots(doctor, 2, 'Clinic', 'Main')
      const withSlots = rows.filter((r) => r.slots.length > 0)
      expect(withSlots.length).toBeGreaterThan(0)
      expect(withSlots.some((r) => r.availableCount > 0)).toBe(true)
    })

    it('requires clinic location when multiple branches exist', () => {
      const doctor = {
        ...baseDoctor(),
        locations: ['A', 'B'],
      }
      const rows = buildDoctorSlots(doctor, 2, 'Clinic', '')
      expect(rows.every((r) => r.availableCount === 0)).toBe(true)
    })
  })
})
