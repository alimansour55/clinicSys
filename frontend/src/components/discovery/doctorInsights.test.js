import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  buildDoctorRow,
  catalogueStats,
  computeOpenings,
  EMPTY_FILTERS,
  facetCounts,
  filterRows,
  sortRows,
  suggestRelaxations,
  upcomingOpenings,
} from './doctorInsights'

const everyDay = { workingDays: [0, 1, 2, 3, 4, 5, 6], startTime: '09:00', endTime: '17:00', slotDuration: 60 }
const now = new Date(2026, 10, 3, 12, 0) // Tuesday, noon
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(now)
afterAll(() => vi.useRealTimers())

const make = (over) => ({
  _id: over.name,
  available: true,
  patientBookable: true,
  schedule: everyDay,
  locations: ['Maadi, Cairo'],
  fees: '400',
  ratingSummary: { averageRating: 0, ratingCount: 0 },
  ...over,
})

const doctors = [
  make({ name: 'A', speciality: 'Dermatologist', fees: '300', ratingSummary: { averageRating: 4.8, ratingCount: 5 } }),
  make({ name: 'B', speciality: 'Dermatologist', fees: '600', locations: ['New Cairo, Cairo'], acceptsVideoCall: false }),
  make({ name: 'C', speciality: 'Pediatricians', schedule: { ...everyDay, workingDays: [] }, patientBookable: false }),
  make({
    name: 'D',
    speciality: 'Pediatricians',
    locations: ['Nasr City, Cairo', 'Sheikh Zayed, Giza'],
    locationSchedules: { 'Sheikh Zayed, Giza': { workingDays: [4], startTime: '10:00', endTime: '12:00', slotDuration: 60 } },
    promoCode: { active: true, discountType: 'percentage', discountValue: 50 },
  }),
]

const rows = doctors.map((doctor) => buildDoctorRow(doctor, { now }))

describe('computeOpenings', () => {
  it('counts real future slots only', () => {
    const openings = computeOpenings(doctors[0], 'clinic', 14, now)
    expect(openings.next.getHours()).toBeGreaterThanOrEqual(12)
    expect(openings.today).toBeGreaterThan(0)
    expect(openings.week).toBeGreaterThan(openings.today)
  })

  it('looks at every branch of a multi-branch doctor', () => {
    expect(computeOpenings(doctors[3], 'clinic', 14, now).next).not.toBeNull()
  })

  it('returns null for a visit type the doctor does not offer', () => {
    expect(computeOpenings(doctors[1], 'tele', 14, now)).toBeNull()
    expect(computeOpenings(doctors[2], 'clinic', 14, now)).toBeNull()
  })
})

describe('filtering', () => {
  it('combines filters and applies offers to the price', () => {
    expect(filterRows(rows, { ...EMPTY_FILTERS, speciality: 'Dermatologist', maxPrice: 400 }).map((r) => r.id)).toEqual(['A'])
    expect(filterRows(rows, { ...EMPTY_FILTERS, maxPrice: 250 }).map((r) => r.id)).toEqual(['D'])
  })

  it('counts each option while keeping the other filters', () => {
    const { counts } = facetCounts(rows, { ...EMPTY_FILTERS, speciality: 'Dermatologist' }, 'mode', ['clinic', 'tele'])
    expect(counts).toEqual({ clinic: 2, tele: 1 })
  })

  it('suggests which filter to drop when nothing matches', () => {
    const filters = { ...EMPTY_FILTERS, speciality: 'Pediatricians', maxPrice: 100 }
    expect(filterRows(rows, filters)).toHaveLength(0)
    expect(suggestRelaxations(rows, filters)[0]).toEqual({ key: 'maxPrice', count: 2 })
  })
})

describe('sorting and stats', () => {
  it('puts bookable doctors first and coming-soon doctors last', () => {
    expect(sortRows(rows, 'recommended').at(-1).id).toBe('C')
    expect(sortRows(rows, 'rating')[0].id).toBe('A')
    expect(sortRows(rows, 'price-asc')[0].id).toBe('D')
  })

  it('lists upcoming openings without coming-soon doctors', () => {
    expect(upcomingOpenings(rows).map((item) => item.row.id)).not.toContain('C')
  })

  it('reports real catalogue numbers', () => {
    expect(catalogueStats(rows)).toMatchObject({ doctors: 4, bookable: 3, specialities: 2 })
  })
})
