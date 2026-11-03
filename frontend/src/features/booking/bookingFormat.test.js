import { describe, expect, it } from 'vitest'
import {
  appointmentBucket,
  availabilityLevel,
  fill,
  formatRelativeDay,
  formatSlotTime,
  groupSlotsByPart,
  localTimeIfAbroad,
  nearestOpenSlot,
  shouldHighlightJoin,
  splitAppointments
} from './bookingFormat'

const slot = (minutes, available = true, status = available ? 'available' : 'taken') => ({ minutes, time: 'x', startsAt: minutes, available, status })

describe('bookingFormat', () => {
  it('fills every placeholder', () => {
    expect(fill('{{a}} and {{a}} and {{b}}', { a: 1, b: 2 })).toBe('1 and 1 and 2')
  })

  it('formats slot times for each language', () => {
    expect(formatSlotTime('02:30 PM', 'en')).toBe('2:30 PM')
    expect(formatSlotTime('12:00 PM', 'en')).toBe('12:00 PM')
    expect(formatSlotTime('09:00 AM', 'ar')).toBe('9:00 ص')
    expect(formatSlotTime('02:30 PM', 'ar')).toBe('2:30 م')
  })

  it('groups slots by part of the day and drops empty parts', () => {
    const groups = groupSlotsByPart([slot(9 * 60), slot(13 * 60)])
    expect(groups.map((group) => group.part)).toEqual(['morning', 'afternoon'])
  })

  it('counts Today and Tomorrow in clinic days, not the browser day', () => {
    // 23:30 UTC on the 15th is 01:30 on the 16th in Cairo.
    const now = Date.UTC(2030, 0, 15, 23, 30)
    const laterThatCairoDay = Date.UTC(2030, 0, 16, 10, 0)
    const nextCairoDay = Date.UTC(2030, 0, 17, 10, 0)
    expect(formatRelativeDay(laterThatCairoDay, 'en', now)).toBe('Today')
    expect(formatRelativeDay(nextCairoDay, 'en', now)).toBe('Tomorrow')
  })

  it('shows local time only to patients outside the clinic zone', () => {
    const at = Date.UTC(2030, 0, 16, 10, 0)
    expect(localTimeIfAbroad(at, 'en', 'Africa/Cairo', 'Africa/Cairo')).toBeNull()
    expect(localTimeIfAbroad(at, 'en', 'Africa/Cairo', 'Asia/Dubai')).toContain('14:00')
  })

  it('rates how full a day is', () => {
    expect(availabilityLevel({ slots: [], availableCount: 0 })).toBe('closed')
    expect(availabilityLevel({ slots: [slot(1, false, 'past')], availableCount: 0 })).toBe('closed')
    expect(availabilityLevel({ slots: [slot(1, false)], availableCount: 0 })).toBe('full')
    expect(availabilityLevel({ slots: [slot(1)], availableCount: 1 })).toBe('few')
    expect(availabilityLevel({ slots: [slot(1)], availableCount: 4 })).toBe('open')
  })

  it('suggests the open slot nearest to the one lost', () => {
    const days = [{ slotDate: 'a', slots: [{ ...slot(100), startsAt: 100, time: 'early' }, { ...slot(500), startsAt: 500, time: 'near' }, { ...slot(450, false), startsAt: 450, time: 'taken' }] }]
    expect(nearestOpenSlot(days, 460)).toMatchObject({ slotTime: 'near' })
    expect(nearestOpenSlot([], 460)).toBeNull()
  })

  it('sorts visits into the right tab', () => {
    const now = 1000
    expect(appointmentBucket({ cancelled: true }, now)).toBe('cancelled')
    expect(appointmentBucket({ isCompleted: true, appointmentStatus: 'Finished' }, now)).toBe('past')
    expect(appointmentBucket({ appointmentStatus: 'Booked', startsAt: 2000, endsAt: 2100 }, now)).toBe('upcoming')
    expect(appointmentBucket({ appointmentStatus: 'Booked', startsAt: 500, endsAt: 600 }, now)).toBe('past')
    expect(appointmentBucket({ appointmentStatus: 'Checked In', startsAt: 500, endsAt: 600 }, now)).toBe('upcoming')
  })

  it('puts the next visit first and the latest past visit first', () => {
    const { upcoming, past } = splitAppointments([
      { _id: 'later', appointmentStatus: 'Booked', startsAt: 3000, endsAt: 3100 },
      { _id: 'soon', appointmentStatus: 'Booked', startsAt: 2000, endsAt: 2100 },
      { _id: 'old', isCompleted: true, startsAt: 100 },
      { _id: 'recent', isCompleted: true, startsAt: 500 }
    ], 1000)
    expect(upcoming.map((row) => row._id)).toEqual(['soon', 'later'])
    expect(past.map((row) => row._id)).toEqual(['recent', 'old'])
  })

  it('opens the call button only in its window', () => {
    const appointment = { teleconsultationLink: 'x', joinOpensAt: 1000, endsAt: 2000 }
    expect(shouldHighlightJoin(appointment, 999)).toBe(false)
    expect(shouldHighlightJoin(appointment, 1500)).toBe(true)
    expect(shouldHighlightJoin(appointment, 2001)).toBe(false)
  })
})
