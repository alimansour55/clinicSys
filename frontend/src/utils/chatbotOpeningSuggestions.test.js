import { describe, it, expect } from 'vitest'
import {
  buildClinicSectionSuggestions,
  buildFallbackOpeningSuggestions,
  DEFAULT_CLINIC_SECTION_NAMES,
  resolveClinicSectionLabel
} from './chatbotOpeningSuggestions'

describe('chatbotOpeningSuggestions', () => {
  it('returns all API clinic sections only', () => {
    const clinics = DEFAULT_CLINIC_SECTION_NAMES.map((name, i) => ({
      _id: String(i),
      name
    }))
    const suggestions = buildClinicSectionSuggestions({
      doctors: [],
      clinics,
      language: 'en',
      t: (k) => k,
      tc: (k) => k
    })
    expect(suggestions).toHaveLength(6)
    expect(suggestions.every((s) => s.kind === 'clinic')).toBe(true)
    expect(suggestions.some((s) => s.service)).toBe(false)
  })

  it('falls back to default clinic names when clinics empty', () => {
    const suggestions = buildClinicSectionSuggestions({
      doctors: [],
      clinics: [],
      language: 'en',
      t: (k) => k,
      tc: (k) => k
    })
    expect(suggestions).toHaveLength(6)
  })

  it('uses Arabic clinic section labels', () => {
    expect(resolveClinicSectionLabel('Dermatologist', 'ar')).toBe('جلدية')
    expect(resolveClinicSectionLabel('Pediatricians', 'ar')).toBe('أطفال')
    expect(resolveClinicSectionLabel('Neurologist', 'ar')).toBe('مخ وأعصاب')
    expect(resolveClinicSectionLabel('Gynecologist', 'ar')).toBe('نساء وتوليد')
    expect(resolveClinicSectionLabel('General physician', 'ar')).toBe('طبيب عام')
    expect(resolveClinicSectionLabel('Gastroenterologist', 'ar')).toBe('جهاز هضمي')

    const arSuggestions = buildClinicSectionSuggestions({
      doctors: [],
      clinics: [{ _id: '1', name: 'Dermatologist' }],
      language: 'ar',
      t: (k) => k,
      tc: (k) => k
    })
    expect(arSuggestions[0].label).toBe('جلدية')
  })
})
