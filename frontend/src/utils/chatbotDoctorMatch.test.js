import { describe, it, expect } from 'vitest'
import {
  findDoctorsByNameQuery,
  shouldUseDoctorNameSearch,
  parseDoctorNameQuery
} from './chatbotDoctorMatch'

const doctors = [
  {
    _id: '1',
    name: 'Sara Ahmed',
    speciality: 'Pediatricians',
    schedule: { workingDays: [0, 1, 2, 3, 4] }
  },
  {
    _id: '2',
    name: 'Martin Ali',
    speciality: 'General physician',
    schedule: { workingDays: [1, 2, 3] }
  }
]

describe('chatbotDoctorMatch', () => {
  it('parses doctor prefix', () => {
    expect(parseDoctorNameQuery('Dr Sara')).toBe('sara')
    expect(parseDoctorNameQuery('دكتور سارة')).toBe('سارة')
  })

  it('finds doctor by partial name', () => {
    const matches = findDoctorsByNameQuery(doctors, 'sara')
    expect(matches).toHaveLength(1)
    expect(matches[0].name).toBe('Sara Ahmed')
  })

  it('prioritizes explicit doctor request', () => {
    expect(shouldUseDoctorNameSearch('doctor martin', findDoctorsByNameQuery(doctors, 'doctor martin'))).toBe(
      true
    )
  })
})
