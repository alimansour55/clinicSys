import { describe, it, expect } from 'vitest'
import {
  EGYPT_DIAL_CODE,
  digitsOnly,
  parseEgyptLocalDigits,
  isValidEgyptPhone,
  normalizeEgyptPhone,
  toEgyptLocalDigits,
} from './egyptPhone.js'

/** Aligned with frontend/src/utils/egyptPhone.test.js and backend T1.1. */
describe('egyptPhone', () => {
  it('EGYPT_DIAL_CODE is +20', () => {
    expect(EGYPT_DIAL_CODE).toBe('+20')
  })

  it('normalizes valid formats', () => {
    expect(normalizeEgyptPhone('01012345678')).toBe('01012345678')
    expect(normalizeEgyptPhone('1012345678')).toBe('01012345678')
    expect(normalizeEgyptPhone('+20 10 1234 5678')).toBe('01012345678')
  })

  it.each(['0', '1', '2', '5'])('accepts operator 1%s', (prefix) => {
    const local = `1${prefix}12345678`
    expect(normalizeEgyptPhone(local)).toBe(`0${local}`)
  })

  it('rejects invalid numbers', () => {
    expect(normalizeEgyptPhone('1912345678')).toBeNull()
    expect(isValidEgyptPhone(null)).toBe(false)
  })

  it('toEgyptLocalDigits strips leading 0', () => {
    expect(toEgyptLocalDigits('01012345678')).toBe('1012345678')
  })

  it('digitsOnly strips formatting', () => {
    expect(digitsOnly('+20 (10) 1234-5678')).toBe('201012345678')
    expect(parseEgyptLocalDigits('201012345678')).toBe('1012345678')
  })
})
