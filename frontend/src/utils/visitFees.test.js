import { describe, it, expect } from 'vitest'
import {
  normalizeVisitFeeType,
  normalizeGlobalVisitFees,
  resolveVisitFeeAmount,
  computeAppointmentPayableForVisit,
} from './visitFees.js'

describe('visitFees', () => {
  const doctor = { fees: 400 }

  it('normalizes visit fee type', () => {
    expect(normalizeVisitFeeType('consultation')).toBe('consultation')
    expect(normalizeVisitFeeType('')).toBe('examination')
  })

  it('uses global fees when enabled and doctor has no custom fees', () => {
    const global = { enabled: true, examinationFee: 100, consultationFee: 75 }
    expect(resolveVisitFeeAmount({ fees: '' }, 'examination', global)).toBe(100)
    expect(resolveVisitFeeAmount({ fees: '' }, 'consultation', global)).toBe(75)
  })

  it('doctor custom fees override global when set', () => {
    const global = { enabled: true, examinationFee: 100, consultationFee: 75 }
    expect(resolveVisitFeeAmount(doctor, 'examination', global)).toBe(400)
    expect(resolveVisitFeeAmount(doctor, 'consultation', global)).toBe(300)
  })

  it('derives consultation as 75% of examination when global disabled', () => {
    expect(resolveVisitFeeAmount(doctor, 'examination')).toBe(400)
    expect(resolveVisitFeeAmount(doctor, 'consultation')).toBe(300)
  })

  it('computeAppointmentPayableForVisit includes promo and home surcharge', () => {
    const total = computeAppointmentPayableForVisit(
      doctor,
      'examination',
      40,
      'Home Visit',
      { enabled: false, examinationFee: 0, consultationFee: 0 },
      { pricingType: 'percentage', percentageValue: 50 }
    )
    expect(total).toBe(360 + 200)
  })

  it('normalizeGlobalVisitFees clamps negatives', () => {
    expect(normalizeGlobalVisitFees({ examinationFee: -5 })).toEqual({
      enabled: false,
      examinationFee: 0,
      consultationFee: 0,
    })
  })
})
