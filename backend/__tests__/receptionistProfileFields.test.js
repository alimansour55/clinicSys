import { describe, it, expect } from 'vitest'
import {
  emptyAddress,
  emptyEmergencyContact,
  normalizeReceptionistAddress,
  normalizeEmergencyContact,
} from '../services/receptionistProfileFields.js'

describe('receptionistProfileFields', () => {
  it('returns empty address and emergency contact templates', () => {
    expect(emptyAddress()).toEqual({
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    })
    expect(emptyEmergencyContact()).toEqual({ name: '', phone: '', relationship: '' })
  })

  describe('normalizeReceptionistAddress', () => {
    it('parses JSON string and trims fields', () => {
      const input = JSON.stringify({ line1: ' 10 Main ', city: 'Cairo ', country: ' EG ' })
      expect(normalizeReceptionistAddress(input)).toEqual({
        line1: '10 Main',
        line2: '',
        city: 'Cairo',
        state: '',
        postalCode: '',
        country: 'EG',
      })
    })

    it('returns empty address for invalid JSON', () => {
      expect(normalizeReceptionistAddress('{bad')).toEqual(emptyAddress())
    })
  })

  describe('normalizeEmergencyContact', () => {
    it('normalizes object input', () => {
      expect(
        normalizeEmergencyContact({ name: ' Sam ', phone: ' 010 ', relationship: ' Spouse ' })
      ).toEqual({ name: 'Sam', phone: '010', relationship: 'Spouse' })
    })
  })
})
