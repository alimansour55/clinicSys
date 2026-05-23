import { describe, it, expect } from 'vitest'
import {
  detectMessageLanguage,
  detectEmergency,
  suggestSpecialtyFromSymptoms,
  matchDoctorSpecialty
} from '../services/chatbotSymptomMap.js'

describe('chatbotSymptomMap', () => {
  it('detects Arabic', () => {
    expect(detectMessageLanguage('عندي ألم في الأسنان')).toBe('ar')
    expect(detectMessageLanguage('tooth pain')).toBe('en')
  })

  it('flags emergencies', () => {
    expect(detectEmergency('severe chest pain')).toBe(true)
    expect(detectEmergency('صعوبة في التنفس')).toBe(true)
    expect(detectEmergency('mild cough')).toBe(false)
  })

  it('maps symptoms to specialty', () => {
    expect(suggestSpecialtyFromSymptoms('tooth pain')).toBe('Dentist')
    expect(suggestSpecialtyFromSymptoms('skin rash')).toBe('Dermatologist')
    expect(suggestSpecialtyFromSymptoms('وجع سن')).toBe('Dentist')
  })

  it('matches doctor specialty loosely', () => {
    expect(matchDoctorSpecialty('Pediatricians', 'Pediatricians')).toBe(true)
    expect(matchDoctorSpecialty('General physician', 'General Practitioner')).toBe(true)
  })
})
