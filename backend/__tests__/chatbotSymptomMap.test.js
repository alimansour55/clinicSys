import { describe, it, expect } from 'vitest'
import {
  detectMessageLanguage,
  detectEmergency,
  suggestSpecialtyFromText,
  suggestSpecialtyFromConversation,
  matchDoctorSpecialty,
  isVagueOnlyMessage
} from '../services/chatbotSymptomMap.js'

describe('chatbotSymptomMap', () => {
  it('detects Arabic', () => {
    expect(detectMessageLanguage('عندي ألم في الأسنان')).toBe('ar')
    expect(detectMessageLanguage('tooth pain')).toBe('en')
  })

  it('flags emergencies', () => {
    expect(detectEmergency('severe chest pain')).toBe(true)
    expect(detectEmergency('mild cough')).toBe(false)
  })

  it('maps symptoms to specialty', () => {
    expect(suggestSpecialtyFromText('tooth pain')).toBe('Dentist')
    expect(suggestSpecialtyFromText('skin rash')).toBe('Dermatologist')
    expect(suggestSpecialtyFromText('children doctor')).toBe('Pediatricians')
  })

  it('vague tired does not map to general physician alone', () => {
    expect(isVagueOnlyMessage('تعب')).toBe(true)
    expect(suggestSpecialtyFromText('تعب')).toBeNull()
  })

  it('conversation accumulates pediatric intent', () => {
    const messages = [
      { role: 'user', content: 'hello' },
      { role: 'user', content: 'my baby has high fever' }
    ]
    expect(suggestSpecialtyFromConversation(messages)).toBe('Pediatricians')
  })

  it('matches doctor specialty loosely', () => {
    expect(matchDoctorSpecialty('Pediatricians', 'Pediatricians')).toBe(true)
    expect(matchDoctorSpecialty('General physician', 'General Practitioner')).toBe(true)
  })
})
