import { describe, it, expect } from 'vitest'
import {
  parseExperienceYears,
  normalizeExperienceForStorage,
  formatExperienceEn,
} from '../utils/doctorExperience.js'

describe('doctorExperience', () => {
  describe('parseExperienceYears', () => {
    it('parses plain integers', () => {
      expect(parseExperienceYears(5)).toBe(5)
      expect(parseExperienceYears('12')).toBe(12)
    })

    it('parses leading number from text', () => {
      expect(parseExperienceYears('8 years of practice')).toBe(8)
      expect(parseExperienceYears('3 yrs')).toBe(3)
      expect(parseExperienceYears('1 year')).toBe(1)
    })

    it('returns null for empty or unparseable input', () => {
      expect(parseExperienceYears(null)).toBeNull()
      expect(parseExperienceYears(undefined)).toBeNull()
      expect(parseExperienceYears('')).toBeNull()
      expect(parseExperienceYears('senior consultant')).toBeNull()
    })

    it('rejects out-of-range values', () => {
      expect(parseExperienceYears(-1)).toBeNull()
      expect(parseExperienceYears(101)).toBeNull()
    })
  })

  describe('normalizeExperienceForStorage', () => {
    it('stores numeric years as string', () => {
      expect(normalizeExperienceForStorage('10 years')).toBe('10')
    })

    it('returns null when parsing fails', () => {
      expect(normalizeExperienceForStorage('unknown')).toBeNull()
    })
  })

  describe('formatExperienceEn', () => {
    it('formats singular and plural labels', () => {
      expect(formatExperienceEn(1)).toBe('1 year of experience')
      expect(formatExperienceEn(5)).toBe('5 years of experience')
      expect(formatExperienceEn('2 yrs')).toBe('2 years of experience')
    })

    it('returns empty string when parsing fails', () => {
      expect(formatExperienceEn('')).toBe('')
      expect(formatExperienceEn('n/a')).toBe('')
    })
  })
})
