import { describe, expect, it } from 'vitest'
import { doctorBelongsToClinicSection, getDoctorClinicPlaceNames } from './doctorClinicPlaces'

describe('doctorClinicPlaces', () => {
  it('collects names from populated clinics and locations', () => {
    const doctor = {
      clinics: [{ _id: 'abc', name: 'General physician' }],
      locations: ['Downtown branch'],
    }
    expect(getDoctorClinicPlaceNames(doctor)).toEqual(['General physician', 'Downtown branch'])
  })

  it('matches by doctor speciality (main case for clinic sections)', () => {
    const doctor = { speciality: 'General physician', clinics: [], locations: [] }
    expect(doctorBelongsToClinicSection(doctor, 'General physician')).toBe(true)
  })

  it('matches by location when clinics array is empty', () => {
    const doctor = { speciality: 'Dermatologist', clinics: [], locations: ['Dermatologist'] }
    expect(doctorBelongsToClinicSection(doctor, 'Dermatologist')).toBe(true)
  })

  it('matches by populated clinic id', () => {
    const doctor = { speciality: 'Other', clinics: [{ _id: 'clinic99', name: 'Neurologist' }], locations: [] }
    expect(doctorBelongsToClinicSection(doctor, 'Neurologist', { clinicId: 'clinic99' })).toBe(true)
  })

  it('is case-insensitive', () => {
    const doctor = { speciality: 'general physician' }
    expect(doctorBelongsToClinicSection(doctor, 'General physician')).toBe(true)
  })
})
