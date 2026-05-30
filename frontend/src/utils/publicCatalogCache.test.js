import { describe, it, expect, beforeEach } from 'vitest'
import {
  readCachedPublicClinics,
  readCachedPublicDoctors,
  writeCachedPublicClinics,
  writeCachedPublicDoctors,
} from './publicCatalogCache.js'

describe('publicCatalogCache', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('returns null when cache is empty', () => {
    expect(readCachedPublicDoctors()).toBeNull()
    expect(readCachedPublicClinics()).toBeNull()
  })

  it('writes and reads doctors from sessionStorage', () => {
    const doctors = [{ _id: '1', name: 'Dr. Ahmed' }]
    writeCachedPublicDoctors(doctors)
    expect(readCachedPublicDoctors()).toEqual(doctors)
  })

  it('falls back to localStorage when session is empty', () => {
    const clinics = [{ _id: 'c1', name: 'Heart Clinic' }]
    localStorage.setItem('clinivo_public_clinics_local_v1', JSON.stringify(clinics))
    expect(readCachedPublicClinics()).toEqual(clinics)
  })
})
