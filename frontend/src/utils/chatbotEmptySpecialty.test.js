import { describe, it, expect } from 'vitest'
import {
  buildEmptySpecialtyGuidance,
  buildEmptySpecialtyMessage,
  formatEmptySpecialtyName
} from './chatbotEmptySpecialty'

describe('chatbotEmptySpecialty', () => {
  it('builds bilingual empty messages', () => {
    expect(buildEmptySpecialtyMessage('Gastroenterologist', 'en')).toContain('Gastroenterologists')
    expect(buildEmptySpecialtyMessage('Gastroenterologist', 'ar')).toContain('جهاز هضمي')
  })

  it('suggests general physician and other available sections', () => {
    const doctors = [
      {
        _id: '1',
        name: 'GP',
        speciality: 'General physician',
        schedule: { workingDays: [1, 2, 3] },
        clinics: [{ _id: 'g', name: 'General physician' }]
      },
      {
        _id: '2',
        name: 'Derm',
        speciality: 'Dermatologist',
        schedule: { workingDays: [1, 2, 3] },
        clinics: [{ _id: 'd', name: 'Dermatologist' }]
      }
    ]
    const clinics = [
      { _id: 'g', name: 'General physician' },
      { _id: 'd', name: 'Dermatologist' },
      { _id: 'gi', name: 'Gastroenterologist' }
    ]

    const { message, suggestions } = buildEmptySpecialtyGuidance({
      doctors,
      clinics,
      emptyClinicName: 'Gastroenterologist',
      emptyClinicId: 'gi',
      language: 'en',
      t: (k) => k,
      tc: (k) => k
    })

    expect(message).toContain('Gastroenterologists')
    expect(suggestions.some((s) => s.isFallback && s.clinicName === 'General physician')).toBe(true)
    expect(suggestions.some((s) => s.clinicName === 'Dermatologist')).toBe(true)
    expect(suggestions.every((s) => s.clinicName !== 'Gastroenterologist')).toBe(true)
  })

  it('formats Arabic specialty names', () => {
    expect(formatEmptySpecialtyName('Gastroenterologist', 'ar')).toBe('جهاز هضمي')
  })
})
