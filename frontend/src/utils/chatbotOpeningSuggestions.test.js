import { describe, it, expect } from 'vitest'
import { buildOpeningSuggestions } from './chatbotOpeningSuggestions'

const doctors = [
  {
    _id: '1',
    name: 'Sara Ahmed',
    speciality: 'Pediatricians',
    schedule: { workingDays: [0, 1, 2, 3, 4] },
    clinics: [{ _id: 'c1', name: 'Pediatricians' }]
  },
  {
    _id: '2',
    name: 'Martin Ali',
    speciality: 'General physician',
    schedule: { workingDays: [1, 2, 3] },
    acceptsVoiceCall: true
  }
]

describe('chatbotOpeningSuggestions', () => {
  it('includes clinic sections with bookable doctors', () => {
    const suggestions = buildOpeningSuggestions({
      doctors,
      clinics: [{ _id: 'c1', name: 'Pediatricians' }],
      language: 'en',
      t: (k) => k,
      tc: (k) => k,
      displayPersonName: (n) => n
    })
    expect(suggestions.some((s) => s.kind === 'clinic' && s.clinicName === 'Pediatricians')).toBe(true)
  })

  it('includes teleconsultation when doctors support it', () => {
    const suggestions = buildOpeningSuggestions({
      doctors,
      clinics: [],
      language: 'en',
      t: (k) => k,
      tc: (k) => k,
      displayPersonName: (n) => n
    })
    expect(suggestions.some((s) => s.kind === 'service' && s.service === 'teleconsultation')).toBe(true)
  })
})
