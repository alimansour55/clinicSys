import { describe, it, expect } from 'vitest'
import { mergeMultiBranchChatbotSlots, probeDoctorBranchesForType } from './chatbotBookingHelpers'

const multiBranchDoctor = {
  _id: 'd1',
  name: 'Dr Sara',
  locations: ['Branch A', 'Branch B'],
  schedule: { workingDays: [1, 2, 3, 4, 5], startTime: '10:00 AM', endTime: '12:00 PM', slotDuration: 30 },
  locationSchedules: {
    'Branch A': { workingDays: [1, 2, 3], startTime: '10:00 AM', endTime: '11:00 AM', slotDuration: 30 },
    'Branch B': { workingDays: [4, 5], startTime: '10:00 AM', endTime: '11:00 AM', slotDuration: 30 }
  },
  slots_booked: {}
}

describe('chatbotBookingHelpers teleconsultation', () => {
  it('merges slots across branches for voice call without pick_branch', () => {
    const result = probeDoctorBranchesForType(multiBranchDoctor, 'Voice Call', 14)
    expect(result.mode).toBe('ready')
    expect(result.mergedTeleconsultation).toBe(true)
    expect(result.branch).toBe('')
    expect(countSlots(result.days)).toBeGreaterThan(0)
  })

  it('still requires branch pick for in-clinic visits', () => {
    const result = probeDoctorBranchesForType(multiBranchDoctor, 'Clinic', 14)
    expect(result.mode).toBe('pick_branch')
  })
})

const countSlots = (days) => days.reduce((n, d) => n + d.slots.length, 0)

describe('mergeMultiBranchChatbotSlots', () => {
  it('tags each slot with its branch', () => {
    const days = mergeMultiBranchChatbotSlots(
      multiBranchDoctor,
      'Video Call',
      ['Branch A', 'Branch B'],
      7
    )
    expect(days.length).toBeGreaterThan(0)
    expect(days[0].slots[0].branch).toBeTruthy()
  })
})
