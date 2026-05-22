import { describe, it, expect } from 'vitest'
import { emptyAddress, emptyEmergencyContact, mergeReceptionistFromApi } from './receptionistProfileForm.js'

describe('receptionistProfileForm', () => {
  it('provides empty templates', () => {
    expect(emptyAddress()).toMatchObject({ line1: '', city: '', country: '' })
    expect(emptyEmergencyContact()).toMatchObject({ name: '', phone: '', relationship: '' })
  })

  it('mergeReceptionistFromApi fills defaults', () => {
    const merged = mergeReceptionistFromApi({
      name: 'Sam',
      address: { city: 'Cairo' },
      emergencyContact: { name: 'Ali' },
    })
    expect(merged.name).toBe('Sam')
    expect(merged.address.city).toBe('Cairo')
    expect(merged.address.line1).toBe('')
    expect(merged.emergencyContact.name).toBe('Ali')
    expect(merged.jobTitle).toBe('Receptionist')
  })

  it('returns null for missing input', () => {
    expect(mergeReceptionistFromApi(null)).toBeNull()
  })
})
