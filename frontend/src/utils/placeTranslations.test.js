import { describe, it, expect } from 'vitest'
import {
  isKnownLatinPlace,
  translatePlaceSegment,
  formatLocationLine,
  collectPlaceStringsNeedingTranslate,
} from './placeTranslations.js'

describe('placeTranslations', () => {
  const t = (s) => s

  it('recognizes static dictionary entries', () => {
    expect(isKnownLatinPlace('New Cairo')).toBe(true)
    expect(isKnownLatinPlace('Random District XYZ')).toBe(false)
  })

  it('translates known places in Arabic', () => {
    expect(translatePlaceSegment('Cairo', 'ar', t)).toBe('القاهرة')
    expect(translatePlaceSegment('Cairo', 'en', t)).toBe('Cairo')
  })

  it('uses API overrides when provided', () => {
    expect(translatePlaceSegment('Custom Area', 'ar', t, { 'Custom Area': 'منطقة مخصصة' })).toBe('منطقة مخصصة')
  })

  it('formatLocationLine joins translated segments', () => {
    const line = formatLocationLine('Cairo, Maadi', 'ar', t)
    expect(line).toContain('القاهرة')
    expect(line).toContain('المعادي')
  })

  it('collects unknown doctor place strings', () => {
    const needs = collectPlaceStringsNeedingTranslate([
      { locations: ['New Cairo', 'Unknown Suburb'], clinics: [{ name: 'Clinic X' }] },
    ])
    expect(needs).toContain('Unknown Suburb')
    expect(needs).toContain('Clinic X')
    expect(needs).not.toContain('New Cairo')
  })
})
