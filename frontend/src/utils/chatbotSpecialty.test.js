import { describe, it, expect } from 'vitest'
import {
  detectSpecialtyFromMessage,
  filterDoctorsBySpecialty,
  getDoctorSpecialty,
  hasChildContext
} from './chatbotSpecialty'

describe('chatbotSpecialty', () => {
  it('detects dermatologist for skin rash', () => {
    expect(detectSpecialtyFromMessage('I have skin rash').specialty).toBe('Dermatologist')
    expect(detectSpecialtyFromMessage('عندي مشكلة جلدية').specialty).toBe('Dermatologist')
  })

  it('detects pediatricians for child fever', () => {
    expect(detectSpecialtyFromMessage('my child has fever').specialty).toBe('Pediatricians')
    expect(detectSpecialtyFromMessage('ابني عنده حرارة').specialty).toBe('Pediatricians')
  })

  it('detects neurologist for headache and numbness', () => {
    expect(detectSpecialtyFromMessage('عندي صداع وتنميل').specialty).toBe('Neurologist')
  })

  it('detects gynecologist for pregnancy', () => {
    expect(detectSpecialtyFromMessage('pregnancy doctor').specialty).toBe('Gynecologist')
  })

  it('detects general physician for cold without child', () => {
    expect(detectSpecialtyFromMessage('عندي برد وكحة').specialty).toBe('General physician')
    expect(hasChildContext('عندي برد وكحة')).toBe(false)
  })

  it('filters doctors by exact speciality field', () => {
    const doctors = [
      { _id: '1', name: 'Sara', speciality: 'Pediatricians' },
      { _id: '2', name: 'Adam', speciality: 'General physician' }
    ]
    const peds = filterDoctorsBySpecialty(doctors, 'Pediatricians')
    expect(peds).toHaveLength(1)
    expect(getDoctorSpecialty(peds[0])).toBe('Pediatricians')
  })
})
