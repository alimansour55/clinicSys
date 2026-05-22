import { describe, it, expect } from 'vitest'
import {
  percentageDiscountAmount,
  computeDoctorPromoDiscountAmount,
  payableAfterPromoDiscount,
  computeHomeVisitSurcharge,
} from './promoPricing.js'

describe('promoPricing', () => {
  const promo = { active: true, code: 'OFF', discountType: 'percentage', discountValue: 25 }

  it('percentage discount uses minor units', () => {
    expect(percentageDiscountAmount(200, 25)).toBe(50)
  })

  it('computeDoctorPromoDiscountAmount respects active promo', () => {
    expect(computeDoctorPromoDiscountAmount(200, promo)).toBe(50)
    expect(computeDoctorPromoDiscountAmount(200, { active: false })).toBe(0)
  })

  it('payableAfterPromoDiscount never negative', () => {
    expect(payableAfterPromoDiscount(100, 120)).toBe(0)
  })

  it('re-exports home visit surcharge helper', () => {
    expect(computeHomeVisitSurcharge(100, { pricingType: 'percentage', percentageValue: 50 })).toBe(50)
  })
})
