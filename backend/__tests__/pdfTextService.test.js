import { describe, expect, it } from 'vitest'
import { hasArabic, layoutLine } from '../services/pdfTextService.js'

const visual = (text) => layoutLine(text).map((piece) => piece.text).join('')

describe('pdfTextService.layoutLine', () => {
  it('leaves Latin text alone', () => {
    expect(visual('Dr. Ahmed Sami')).toBe('Dr. Ahmed Sami')
  })

  it('reverses Arabic word order for left-to-right drawing, keeping single spaces', () => {
    expect(visual('منى علي حسن')).toBe('حسن علي منى')
  })

  it('keeps numbers next to the Arabic words they belong to', () => {
    expect(visual('شارع النيل 12')).toBe('12 النيل شارع')
  })

  it('keeps an English run in reading order inside Arabic, and the reverse', () => {
    expect(visual('Fever and كحة شديدة')).toBe('Fever and شديدة كحة')
    expect(visual('بجوار صيدلية Building B')).toBe('Building B صيدلية بجوار')
  })

  it('draws spaces and digits in the Latin font, Arabic letters in the Arabic font', () => {
    const pieces = layoutLine('شارع 12')
    expect(pieces).toEqual([
      { text: '12', arabic: false },
      { text: ' ', arabic: false },
      { text: 'شارع', arabic: true }
    ])
  })

  it('detects Arabic', () => {
    expect(hasArabic('Mona')).toBe(false)
    expect(hasArabic('منى')).toBe(true)
  })
})
