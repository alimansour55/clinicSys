import { describe, it, expect } from 'vitest'
import {
  isGreetingOnly,
  hasHealthConcern,
  shouldOfferDoctorPicker,
  buildRuleBasedReply
} from '../services/chatbotConversation.js'

describe('chatbotConversation', () => {
  it('detects greetings without showing doctors', () => {
    expect(isGreetingOnly('Hi good morning')).toBe(true)
    expect(isGreetingOnly('مرحبا')).toBe(true)
    expect(isGreetingOnly('I have a cold and cough')).toBe(false)
  })

  it('detects health concerns', () => {
    expect(hasHealthConcern('I caught a cold what shall I do')).toBe(true)
    expect(hasHealthConcern('hi')).toBe(false)
  })

  it('offers doctor picker only after symptoms', () => {
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
        userText: 'I have tooth pain',
        messages: [{ role: 'user', content: 'I have tooth pain' }],
        suggestedDoctors: doctors
      })
    ).toBe(true)
  })

  it('greets warmly in rule-based reply', () => {
    const reply = buildRuleBasedReply({ language: 'en', userText: 'Hi good morning' })
    expect(reply.toLowerCase()).toContain('how can i help')
    expect(reply.toLowerCase()).not.toContain('unavailable')
  })
})
