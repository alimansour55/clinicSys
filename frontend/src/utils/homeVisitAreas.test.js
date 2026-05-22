import { describe, it, expect } from 'vitest'
import {
  supportedHomeVisitAreas,
  emptyHomeVisitAddress,
  formatHomeVisitAddress,
  getDoctorHomeVisitAreas,
  doctorOffersHomeVisit,
} from './homeVisitAreas.js'

describe('homeVisitAreas', () => {
  const doctor = {
    homeVisitAreas: ['cairo', 'Maadi'],
    homeVisitSchedule: { workingDays: [1, 2] },
  }

  it('exports supported areas', () => {
    expect(supportedHomeVisitAreas).toContain('Cairo')
  })

  it('formats address lines', () => {
    const formatted = formatHomeVisitAddress({
      area: 'Maadi',
      street: 'Road 9',
      building: '5',
      floor: '2',
      apartment: '10',
    })
    expect(formatted).toContain('Maadi')
    expect(formatted).toContain('Building 5')
  })

  it('filters doctor areas against supported list', () => {
    expect(getDoctorHomeVisitAreas(doctor)).toEqual(['Cairo', 'Maadi'])
    expect(getDoctorHomeVisitAreas({ homeVisitAreas: ['Unknown'] })).toEqual([])
  })

  it('requires schedule and areas for home visit', () => {
    expect(doctorOffersHomeVisit(doctor)).toBe(true)
    expect(doctorOffersHomeVisit({ ...doctor, homeVisitSchedule: { workingDays: [] } })).toBe(false)
  })

  it('emptyHomeVisitAddress has all keys', () => {
    expect(emptyHomeVisitAddress).toMatchObject({
      area: '',
      street: '',
      building: '',
      floor: '',
      apartment: '',
      notes: '',
    })
  })
})
