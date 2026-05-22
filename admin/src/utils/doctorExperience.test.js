import { describe, it, expect } from 'vitest'
import { parseExperienceYears, formatExperienceEn } from './doctorExperience.js'

describe('doctorExperience', () => {
  it('parses years from text', () => {
    expect(parseExperienceYears('15')).toBe(15)
    expect(parseExperienceYears('8 yrs')).toBe(8)
    expect(parseExperienceYears('invalid')).toBeNull()
  })

  it('formats English label', () => {
    expect(formatExperienceEn(1)).toBe('1 year of experience')
    expect(formatExperienceEn(3)).toBe('3 years of experience')
  })
})
