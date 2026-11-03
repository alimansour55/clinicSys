import process from 'node:process'
import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import area from '../../i18n/areas/assistant'
import { buildCalendarFile, fillTemplate, formatSlotTime, journeyStage } from './assistantFormat'
import { isLocalRedFlag } from './localSafety'
import { CHAT_STEPS } from '../../utils/chatbotSteps'

const folder = path.resolve(process.cwd(), 'src/components/Chatbot')
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('assistant strings', () => {
  it('has both languages for every key, with the same placeholders', () => {
    expect(Object.keys(area.ar).sort()).toEqual(Object.keys(area.en).sort())
    for (const key of Object.keys(area.en)) {
      expect(placeholders(area.ar[key]), key).toEqual(placeholders(area.en[key]))
    }
  })

  it('defines every key the code uses', () => {
    const code = fs
      .readdirSync(folder)
      .filter((name) => /\.jsx?$/.test(name) && !name.includes('.test.'))
      .map((name) => fs.readFileSync(path.join(folder, name), 'utf8'))
      .join('\n')
    const used = new Set([...code.matchAll(/'(assistant\.[\w.]+)'/g)].map((m) => m[1]))
    expect(used.size).toBeGreaterThan(50)
    expect([...used].filter((key) => !area.en[key])).toEqual([])
  })
})

describe('assistant formatting', () => {
  const t = (key) => area.ar[key]

  it('fills templates and leaves unknown placeholders', () => {
    expect(fillTemplate('{a} and {b}', { a: 1 })).toBe('1 and {b}')
  })

  it('formats times for Arabic', () => {
    expect(formatSlotTime('05:30 PM', 'ar', t)).toBe('٥:٣٠ م')
    expect(formatSlotTime('09:00 AM', 'en', (key) => area.en[key])).toBe('9:00 AM')
  })

  it('maps every step to a stage', () => {
    expect(journeyStage(CHAT_STEPS.WAITING_SYMPTOMS, CHAT_STEPS)).toBe(0)
    expect(journeyStage(CHAT_STEPS.SHOWING_DOCTORS, CHAT_STEPS)).toBe(1)
    expect(journeyStage(CHAT_STEPS.WAITING_TIME, CHAT_STEPS)).toBe(2)
    expect(journeyStage('needs_login', CHAT_STEPS)).toBe(3)
    expect(journeyStage(CHAT_STEPS.SUCCESS, CHAT_STEPS)).toBe(4)
  })

  it('builds a calendar file without health details', () => {
    const ics = buildCalendarFile({ title: 'Appointment with Dr A, B', slotDate: '4_11_2026', time: '05:30 PM', location: 'Maadi', reservationNumber: 'R1' })
    expect(ics).toContain('DTSTART:20261104T173000')
    expect(ics).toContain('DTEND:20261104T180000')
    expect(ics).toContain('SUMMARY:Appointment with Dr A\\, B')
    expect(buildCalendarFile({ title: 'x', slotDate: 'bad', time: 'bad' })).toBe('')
  })
})

describe('offline red flags', () => {
  it.each(['chest pain', 'my chest hurts', "I can't breathe", 'stroke', 'heavy bleeding', 'I want to kill myself', 'صدري بيوجعني', 'الم في الصدر', 'مش قادر اتنفس', 'جلطة', 'نزيف شديد', 'عايز أموت', 'عايز انتحر'])('%s', (text) => {
    expect(isLocalRedFlag(text)).toBe(true)
  })

  it.each(['tooth pain', 'عايز دكتور اسنان', 'bokra el sob7', 'كحة'])('not: %s', (text) => {
    expect(isLocalRedFlag(text)).toBe(false)
  })
})
