import { describe, it, expect } from 'vitest'
import {
  isGreetingOnly,
  hasClearSymptoms,
  shouldOfferDoctorPicker,
  buildRuleBasedReply,
  needsMoreSymptomInfo
} from '../services/chatbotConversation.js'
import { suggestSpecialtyFromText } from '../services/chatbotSymptomMap.js'

describe('chatbotConversation', () => {
  it('detects greetings without showing doctors', () => {
    expect(isGreetingOnly('Hi good morning')).toBe(true)
    expect(isGreetingOnly('مرحبا')).toBe(true)
    expect(isGreetingOnly('I have a cold and cough')).toBe(false)
  })

  it('treats tired / تعب as needing follow-up not doctor list', () => {
    expect(needsMoreSymptomInfo([], 'انا تعبان')).toBe(true)
    expect(hasClearSymptoms([], 'انا تعبان')).toBe(false)
    expect(shouldOfferDoctorPicker({
      userText: 'انا تعبان',
      messages: [{ role: 'user', content: 'انا تعبان' }],
      suggestedDoctors: [{ id: '1' }]
    })).toBe(false)
  })

  it('maps children doctor request to pediatricians', () => {
    expect(suggestSpecialtyFromText('I need a children doctor')).toBe('Pediatricians')
    expect(suggestSpecialtyFromText('عايز دكتور أطفال')).toBe('Pediatricians')
  })

  it('offers doctor picker only after clear symptoms', () => {
    const doctors = [{ id: '1' }]
    expect(
      shouldOfferDoctorPicker({
        userText: 'hello',
        messages: [{ role: 'user', content: 'hello' }],
        suggestedDoctors: doctors
      })
    ).toBe(false)
    expect(
      shouldOfferDoctorPicker({
        userText: 'my child has fever',
        messages: [{ role: 'user', content: 'my child has fever' }],
        suggestedDoctors: doctors
      })
    ).toBe(true)
  })

  it('does not offer doctors when doctor already selected', () => {
    expect(
      shouldOfferDoctorPicker({
        userText: 'tomorrow please',
        messages: [],
        suggestedDoctors: [{ id: '1' }],
        bookingContext: { docId: 'abc' }
      })
    ).toBe(false)
  })

  it('greets warmly in rule-based reply', () => {
    const reply = buildRuleBasedReply({ language: 'en', userText: 'Hi good morning' })
    expect(reply.toLowerCase()).toContain('how can i help')
  })
})
