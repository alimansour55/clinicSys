import { describe, it, expect } from 'vitest'
import {
  toWesternAsciiDigits,
  toArabicIndicDigits,
  localizeWesternDigits,
  formatPercentDisplay,
} from './arabicNumerals.js'

describe('arabicNumerals', () => {
  it('converts Arabic-Indic digits to Western', () => {
    expect(toWesternAsciiDigits('١٢٣')).toBe('123')
  })

  it('converts Western digits to Arabic-Indic', () => {
    expect(toArabicIndicDigits('2026')).toBe('٢٠٢٦')
  })

  it('localizeWesternDigits keeps English as Western', () => {
    expect(localizeWesternDigits('85%', 'en')).toBe('85%')
  })

  it('localizeWesternDigits uses Arabic numerals and percent position', () => {
    expect(localizeWesternDigits('85%', 'ar')).toBe('%٨٥')
  })

  it('formatPercentDisplay matches language rules', () => {
    expect(formatPercentDisplay(15, 'en')).toBe('15%')
    expect(formatPercentDisplay(15, 'ar')).toBe('%١٥')
  })
})
