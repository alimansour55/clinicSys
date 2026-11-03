import { describe, it, expect, vi } from 'vitest'

vi.mock('../models/healthReminderModel.js', () => ({ default: {} }))
vi.mock('../services/notificationService.js', () => ({ pushNotification: vi.fn() }))

import { applyReminderAction, computeNextDue } from '../services/healthReminderService.js'

const CAIRO = -120 // Date.getTimezoneOffset() for UTC+2
const at = (iso) => new Date(iso).getTime()

describe('computeNextDue', () => {
  const daily = { frequency: 'daily', times: ['08:00', '20:00'], startDate: '2026-03-10', tzOffsetMinutes: CAIRO }

  it('converts the patient\'s local time to UTC', () => {
    expect(computeNextDue(daily, at('2026-03-10T00:00:00Z'))).toBe(at('2026-03-10T06:00:00Z'))
  })

  it('moves through doses in a day, then to the next day', () => {
    expect(computeNextDue(daily, at('2026-03-10T06:00:00Z'))).toBe(at('2026-03-10T18:00:00Z'))
    expect(computeNextDue(daily, at('2026-03-10T18:00:00Z'))).toBe(at('2026-03-11T06:00:00Z'))
  })

  it('does not fire before the start date', () => {
    expect(computeNextDue(daily, at('2026-01-01T00:00:00Z'))).toBe(at('2026-03-10T06:00:00Z'))
  })

  it('finds the next dose long after the start', () => {
    expect(computeNextDue(daily, at('2027-03-10T07:00:00Z'))).toBe(at('2027-03-10T18:00:00Z'))
  })

  it('stops after the end date', () => {
    const course = { ...daily, endDate: '2026-03-11' }
    expect(computeNextDue(course, at('2026-03-11T17:00:00Z'))).toBe(at('2026-03-11T18:00:00Z'))
    expect(computeNextDue(course, at('2026-03-11T18:00:00Z'))).toBe(0)
  })

  it('once fires a single time', () => {
    const once = { frequency: 'once', times: ['10:00'], startDate: '2026-03-10', tzOffsetMinutes: CAIRO }
    expect(computeNextDue(once, at('2026-03-01T00:00:00Z'))).toBe(at('2026-03-10T08:00:00Z'))
    expect(computeNextDue(once, at('2026-03-10T08:00:00Z'))).toBe(0)
  })

  it('weekly keeps its weekday', () => {
    const weekly = { frequency: 'weekly', times: ['09:00'], startDate: '2026-03-10', tzOffsetMinutes: CAIRO }
    expect(computeNextDue(weekly, at('2026-03-10T07:00:00Z'))).toBe(at('2026-03-17T07:00:00Z'))
    expect(computeNextDue(weekly, at('2026-06-01T00:00:00Z'))).toBe(at('2026-06-02T07:00:00Z'))
  })

  it('monthly clamps to a short month', () => {
    const monthly = { frequency: 'monthly', times: ['09:00'], startDate: '2026-01-31', tzOffsetMinutes: CAIRO }
    expect(computeNextDue(monthly, at('2026-01-31T07:00:00Z'))).toBe(at('2026-02-28T07:00:00Z'))
    expect(computeNextDue(monthly, at('2026-02-28T07:00:00Z'))).toBe(at('2026-03-31T07:00:00Z'))
  })

  it('returns 0 for a schedule it cannot read', () => {
    expect(computeNextDue({ frequency: 'daily', times: [], startDate: '2026-03-10' }, 0)).toBe(0)
    expect(computeNextDue({ frequency: 'daily', times: ['08:00'], startDate: 'nope' }, 0)).toBe(0)
  })
})

describe('applyReminderAction', () => {
  it('records the action and moves to the next dose', () => {
    const reminder = { frequency: 'daily', times: ['08:00'], startDate: '2026-03-10', tzOffsetMinutes: CAIRO, nextDueAt: at('2026-03-10T06:00:00Z'), active: true, history: [] }
    applyReminderAction(reminder, 'taken', at('2026-03-10T06:05:00Z'))
    expect(reminder.history[0]).toMatchObject({ action: 'taken', dueAt: at('2026-03-10T06:00:00Z') })
    expect(reminder.nextDueAt).toBe(at('2026-03-11T06:00:00Z'))
  })

  it('taking a dose early does not fire the same dose again', () => {
    const reminder = { frequency: 'daily', times: ['08:00'], startDate: '2026-03-10', tzOffsetMinutes: CAIRO, nextDueAt: at('2026-03-10T06:00:00Z'), active: true, history: [] }
    applyReminderAction(reminder, 'taken', at('2026-03-10T05:00:00Z'))
    expect(reminder.nextDueAt).toBe(at('2026-03-11T06:00:00Z'))
  })

  it('finishes a one-time reminder', () => {
    const reminder = { frequency: 'once', times: ['08:00'], startDate: '2026-03-10', tzOffsetMinutes: CAIRO, nextDueAt: at('2026-03-10T06:00:00Z'), active: true, history: [] }
    applyReminderAction(reminder, 'taken', at('2026-03-10T07:00:00Z'))
    expect(reminder.active).toBe(false)
    expect(reminder.nextDueAt).toBe(0)
  })
})
