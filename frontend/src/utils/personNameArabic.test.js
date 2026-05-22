import { describe, it, expect } from 'vitest'
import { displayPersonName } from './personNameArabic.js'

describe('personNameArabic', () => {
  it('returns original name for English UI', () => {
    expect(displayPersonName('Ahmed Mansour', 'en')).toBe('Ahmed Mansour')
  })

  it('translates known names to Arabic', () => {
    expect(displayPersonName('Ahmed Mansour', 'ar')).toBe('أحمد منصور')
  })

  it('keeps already-Arabic names', () => {
    expect(displayPersonName('محمد علي', 'ar')).toBe('محمد علي')
  })

  it('transliterates unknown Latin tokens', () => {
    const out = displayPersonName('Xyz Qqq', 'ar')
    expect(out).not.toBe('Xyz Qqq')
    expect(/[\u0600-\u06FF]/.test(out)).toBe(true)
  })
})
