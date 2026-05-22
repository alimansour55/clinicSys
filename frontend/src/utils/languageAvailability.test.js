import { describe, it, expect } from 'vitest'
import {
  normalizeLanguageAvailability,
  legacyAvailabilityToPolicy,
  normalizeRoleLanguagePolicy,
  getAllowedLanguagesFromPolicy,
  resolveLanguageForPolicy,
} from './languageAvailability.js'

describe('languageAvailability', () => {
  it.each([
    ['english', 'en'],
    ['Arabic', 'ar'],
    ['both', 'both'],
  ])('normalizeLanguageAvailability(%j) → %j', (input, expected) => {
    expect(normalizeLanguageAvailability(input)).toBe(expected)
  })

  it('legacyAvailabilityToPolicy maps modes', () => {
    expect(legacyAvailabilityToPolicy('ar')).toEqual({ en: false, ar: true })
  })

  it('forces en when both toggles off', () => {
    expect(normalizeRoleLanguagePolicy({ en: false, ar: false })).toEqual({ en: true, ar: false })
  })

  it('resolveLanguageForPolicy falls back', () => {
    expect(resolveLanguageForPolicy('ar', { en: true, ar: false })).toBe('en')
    expect(getAllowedLanguagesFromPolicy({ en: true, ar: true })).toEqual(['en', 'ar'])
  })
})
