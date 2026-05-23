import { describe, it, expect } from 'vitest'
import {
  formatDoctorCountLabel,
  formatMoney,
  formatSlotCountLabel
} from './arabicMedicalUi'

describe('arabicMedicalUi', () => {
  it('formats Arabic doctor counts with proper plural forms', () => {
    expect(formatDoctorCountLabel(0, 'ar')).toBe('لا يوجد أطباء')
    expect(formatDoctorCountLabel(1, 'ar')).toBe('طبيب واحد')
    expect(formatDoctorCountLabel(2, 'ar')).toBe('طبيبان')
    expect(formatDoctorCountLabel(3, 'ar')).toBe('3 أطباء')
    expect(formatDoctorCountLabel(11, 'ar')).toBe('11 طبيبًا')
  })

  it('formats Arabic slot counts', () => {
    expect(formatSlotCountLabel(0, 'ar')).toBe('لا توجد مواعيد')
    expect(formatSlotCountLabel(2, 'ar')).toBe('موعدان')
  })

  it('formats Arabic currency as amount then symbol', () => {
    expect(formatMoney(300, 'ar')).toBe('300 ج.م')
    expect(formatMoney(300, 'en')).toBe('EGP 300')
  })
})
