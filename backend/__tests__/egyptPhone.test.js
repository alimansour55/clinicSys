import { describe, it, expect } from 'vitest'
import {
  EGYPT_DIAL_CODE,
  digitsOnly,
  parseEgyptLocalDigits,
  isValidEgyptPhone,
  normalizeEgyptPhone,
} from '../utils/egyptPhone.js'

describe('egyptPhone', () => {
  describe('EGYPT_DIAL_CODE', () => {
    it('is +20', () => {
      expect(EGYPT_DIAL_CODE).toBe('+20')
    })
  })

  describe('digitsOnly', () => {
    it('strips non-digit characters', () => {
      expect(digitsOnly('+20 (10) 1234-5678')).toBe('201012345678')
    })

    it('returns empty string for null/undefined', () => {
      expect(digitsOnly(null)).toBe('')
      expect(digitsOnly(undefined)).toBe('')
    })
  })

  describe('parseEgyptLocalDigits', () => {
    it('returns up to 10 local digits without leading 0', () => {
      expect(parseEgyptLocalDigits('01012345678')).toBe('1012345678')
      expect(parseEgyptLocalDigits('+20 10 1234 5678')).toBe('1012345678')
    })

    it('strips country code 20 prefix', () => {
      expect(parseEgyptLocalDigits('201012345678')).toBe('1012345678')
    })

    it('caps at 10 digits', () => {
      expect(parseEgyptLocalDigits('10123456789012')).toBe('1012345678')
    })
  })

  describe('normalizeEgyptPhone', () => {
    const validLocal = '1012345678'
    const validStored = '01012345678'

    it.each([
      ['domestic 01 form', validStored, validStored],
      ['local 10 digits', validLocal, validStored],
      ['with +20 prefix', '+20 10 1234 5678', validStored],
      ['with 20 country digits', '201012345678', validStored],
      ['with spaces and dashes', '010-1234-5678', validStored],
    ])('normalizes %s', (_label, input, expected) => {
      expect(normalizeEgyptPhone(input)).toBe(expected)
    })

    it.each(['0', '1', '2', '5'])('accepts valid operator prefix 1%s', (prefix) => {
      const local = `1${prefix}12345678`
      expect(normalizeEgyptPhone(local)).toBe(`0${local}`)
    })

    it('returns null for empty or missing input', () => {
      expect(normalizeEgyptPhone('')).toBeNull()
      expect(normalizeEgyptPhone(null)).toBeNull()
      expect(normalizeEgyptPhone(undefined)).toBeNull()
    })

    it('returns null for invalid prefix or length', () => {
      expect(normalizeEgyptPhone('1912345678')).toBeNull()
      expect(normalizeEgyptPhone('10123')).toBeNull()
      expect(normalizeEgyptPhone('abc')).toBeNull()
    })
  })

  describe('isValidEgyptPhone', () => {
    it('returns true for valid numbers', () => {
      expect(isValidEgyptPhone('01012345678')).toBe(true)
      expect(isValidEgyptPhone('+20 10 1234 5678')).toBe(true)
    })

    it('returns false for invalid numbers', () => {
      expect(isValidEgyptPhone('')).toBe(false)
      expect(isValidEgyptPhone('1912345678')).toBe(false)
      expect(isValidEgyptPhone(null)).toBe(false)
    })
  })
})
