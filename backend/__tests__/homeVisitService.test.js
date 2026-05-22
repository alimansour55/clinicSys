import { describe, it, expect } from 'vitest'
import {
  normalizeDoctorHomeVisitAreas,
  doctorOffersHomeVisit,
  supportedHomeVisitAreas,
  validateHomeVisitAddress,
  normalizeHomeVisitAddress,
} from '../services/homeVisitService.js'

describe('homeVisitService', () => {
  const doctor = {
    available: true,
    homeVisitAreas: ['cairo', 'Maadi', 'cairo'],
    homeVisitSchedule: { workingDays: [1, 2] },
  }

  describe('normalizeDoctorHomeVisitAreas', () => {
    it('deduplicates and canonicalizes area names', () => {
      expect(normalizeDoctorHomeVisitAreas(doctor.homeVisitAreas)).toEqual(['Cairo', 'Maadi'])
    })

    it('ignores unknown areas', () => {
      expect(normalizeDoctorHomeVisitAreas(['Unknown City', 'Cairo'])).toEqual(['Cairo'])
    })
  })

  describe('doctorOffersHomeVisit', () => {
    it('requires availability, schedule, and areas', () => {
      expect(doctorOffersHomeVisit(doctor)).toBe(true)
      expect(doctorOffersHomeVisit({ ...doctor, available: false })).toBe(false)
      expect(doctorOffersHomeVisit({ ...doctor, homeVisitSchedule: { workingDays: [] } })).toBe(false)
    })
  })

  describe('validateHomeVisitAddress', () => {
    it('requires area and street', () => {
      expect(validateHomeVisitAddress({ area: '', street: '12 Nile St' })).toMatch(/supported home visit area/)
      expect(validateHomeVisitAddress({ area: 'Cairo', street: '' })).toMatch(/street/)
    })

    it('validates doctor serves the area', () => {
      const address = normalizeHomeVisitAddress({ area: 'Maadi', street: 'Road 9' })
      expect(validateHomeVisitAddress(address, doctor)).toBe('')
      expect(validateHomeVisitAddress({ area: 'Heliopolis', street: 'Main' }, doctor)).toMatch(/does not visit/)
    })
  })

  it('exports supported areas list', () => {
    expect(supportedHomeVisitAreas).toContain('Cairo')
  })
})
