import { describe, it, expect } from 'vitest'
import {
  buildClinicSectionSuggestions,
  DEFAULT_CLINIC_SECTION_NAMES
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
    expect(suggestions).toHaveLength(DEFAULT_CLINIC_SECTION_NAMES.length)
  })
})
