import { describe, expect, it } from 'vitest'
import { adherence, buildAttention, dueReminders, nextUpcomingVisit, passportText, reminderFromMedication, suggestEndDate, suggestTimes, vitalSeries } from './hubLogic'

const NOW = new Date('2026-06-15T10:00:00Z').getTime()

describe('nextUpcomingVisit', () => {
  it('picks the soonest visit and ignores stale ones nobody closed', () => {
    const events = [
      { type: 'visit', status: 'upcoming', date: '2026-07-01', time: '10:00', id: 'later' },
      { type: 'visit', status: 'upcoming', date: '2026-06-20', time: '10:00', id: 'soon' },
      { type: 'visit', status: 'upcoming', date: '2026-01-01', time: '10:00', id: 'stale' },
      { type: 'visit', status: 'cancelled', date: '2026-06-16', time: '10:00', id: 'cancelled' }
    ]
    expect(nextUpcomingVisit(events, '2026-06-15').id).toBe('soon')
    expect(nextUpcomingVisit([], '2026-06-15')).toBeNull()
  })
})

describe('buildAttention', () => {
  const complete = {
    userData: { medicalHistory: { allergies: 'None known' }, mfa: { enabled: true }, insurance: {} },
    hub: { reminders: [], events: [], emergency: { contactPhone: '010' }, phoneVerified: true },
    now: NOW
  }
  const keys = (input) => buildAttention(input).map((item) => item.key)

  it('asks for nothing when everything is in place', () => {
    expect(keys(complete)).toEqual([])
  })

  it('puts due reminders first', () => {
    const input = { ...complete, hub: { ...complete.hub, phoneVerified: false, reminders: [{ active: true, nextDueAt: NOW - 1 }] } }
    expect(keys(input)[0]).toBe('reminders-due')
  })

  it('flags an expired or declined card, not a healthy one', () => {
    const withCard = (insurance) => ({ ...complete, userData: { ...complete.userData, insurance } })
    expect(keys(withCard({ enabled: true, expiryDate: '2026-01-01' }))).toContain('insurance-expired')
    expect(keys(withCard({ enabled: true, expiryDate: '2026-06-30' }))).toContain('insurance-expiring')
    expect(keys(withCard({ enabled: true, expiryDate: '2026-01-01', verificationStatus: 'declined' }))).toContain('insurance-declined')
    expect(keys(withCard({ enabled: true, expiryDate: '2030-01-01' }))).toEqual([])
  })

  it('nudges for a follow-up only when it is due and not already booked', () => {
    const finished = { type: 'visit', status: 'finished', date: '2026-06-01', docId: 'd1', prescription: { nextVisit: '2026-06-20' } }
    const withEvents = (events) => ({ ...complete, hub: { ...complete.hub, events } })
    expect(keys(withEvents([finished]))).toContain('follow-up')
    expect(keys(withEvents([finished, { type: 'visit', status: 'upcoming', date: '2026-06-20', docId: 'd1' }]))).not.toContain('follow-up')
    expect(keys(withEvents([{ ...finished, prescription: { nextVisit: 'when needed' } }]))).not.toContain('follow-up')
  })
})

describe('reminder suggestions from a prescription', () => {
  it('reads common frequencies in English and Arabic', () => {
    expect(suggestTimes('3 times a day')).toHaveLength(3)
    expect(suggestTimes('twice daily')).toHaveLength(2)
    expect(suggestTimes('every 8 hours')).toHaveLength(3)
    expect(suggestTimes('مرتين يوميا')).toHaveLength(2)
    expect(suggestTimes('as needed')).toEqual(['09:00'])
  })

  it('turns a duration into an end date, counting the first day', () => {
    expect(suggestEndDate('7 days', '2026-06-01')).toBe('2026-06-07')
    expect(suggestEndDate('2 weeks', '2026-06-01')).toBe('2026-06-14')
    expect(suggestEndDate('ongoing', '2026-06-01')).toBe('')
  })

  it('builds a complete reminder', () => {
    const reminder = reminderFromMedication({ name: 'Amoxicillin', dosage: '500mg', frequency: '3 times a day', duration: '5 days' }, '2026-06-01')
    expect(reminder).toMatchObject({ title: 'Amoxicillin 500mg', endDate: '2026-06-05', kind: 'medication' })
    expect(reminder.times).toHaveLength(3)
  })
})

describe('small helpers', () => {
  it('dueReminders skips paused ones', () => {
    expect(dueReminders([{ active: false, nextDueAt: 1 }, { active: true, nextDueAt: 1 }, { active: true, nextDueAt: NOW + 1 }], NOW)).toHaveLength(1)
  })

  it('adherence reports the taken share, or nothing yet', () => {
    expect(adherence({ history: [] })).toBeNull()
    expect(adherence({ history: [{ action: 'taken' }, { action: 'missed' }] })).toBe(50)
  })

  it('vitalSeries keeps only entries with that reading', () => {
    const series = vitalSeries([{ date: 'a', vitals: { weight: 70 } }, { date: 'b', vitals: { glucose: 90 } }, { date: 'c', vitals: { weight: 71 } }], 'weight')
    expect(series.points).toHaveLength(2)
    expect(series.latest).toBe(71)
  })

  it('passportText leaves out empty lines and holds the facts', () => {
    const text = passportText({
      labels: { title: 'CARD', name: 'Name', dob: 'Born', blood: 'Blood', allergies: 'Allergies', conditions: 'Conditions', medications: 'Medicines', contact: 'Call' },
      name: 'Mona', bloodType: 'O+', allergies: 'Penicillin', contactName: 'Ali', contactPhone: '010'
    })
    expect(text).toBe('CARD\nName: Mona\nBlood: O+\nAllergies: Penicillin\nCall: Ali 010')
  })
})
