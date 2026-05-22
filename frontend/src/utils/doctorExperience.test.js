import { describe, it, expect } from 'vitest'
import { parseExperienceYears, formatExperienceEn } from './doctorExperience.js'

describe('doctorExperience', () => {
  it('parses numeric and text experience', () => {
    expect(parseExperienceYears(8)).toBe(8)
    expect(parseExperienceYears('12 years')).toBe(12)
    expect(parseExperienceYears('senior')).toBeNull()
    expect(parseExperienceYears(101)).toBeNull()
  })

  it('formats English label', () => {
    expect(formatExperienceEn(1)).toBe('1 year of experience')
    expect(formatExperienceEn(5)).toBe('5 years of experience')
    expect(formatExperienceEn('')).toBe('')
  })
})
