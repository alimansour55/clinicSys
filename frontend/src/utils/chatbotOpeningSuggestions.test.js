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
    expect(resolveClinicSectionLabel('Dermatologist', 'ar')).toBe('الجلدية')
    expect(resolveClinicSectionLabel('Pediatricians', 'ar')).toBe('طب الأطفال')
    expect(resolveClinicSectionLabel('Neurologist', 'ar')).toBe('طب الأعصاب')
    expect(resolveClinicSectionLabel('Gynecologist', 'ar')).toBe('النساء والتوليد')
    expect(resolveClinicSectionLabel('General physician', 'ar')).toBe('الطب العام')
    expect(resolveClinicSectionLabel('Gastroenterologist', 'ar')).toBe('الجهاز الهضمي')

    const arSuggestions = buildClinicSectionSuggestions({
      doctors: [],
      clinics: [{ _id: '1', name: 'Dermatologist' }],
      language: 'ar',
      t: (k) => k,
      tc: (k) => k
    })
    expect(arSuggestions[0].label).toBe('الجلدية')
  })
})
