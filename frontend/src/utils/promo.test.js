import { describe, it, expect } from 'vitest'
import {
  percentageDiscountAmount,
  fixedDiscountAmount,
  computeDoctorPromoDiscountAmount,
  payableAfterPromoDiscount,
  computeAppointmentPayable,
  getPromoOfferLabel,
} from './promo.js'

describe('promo', () => {
  const doctor = {
    promoCode: { active: true, code: 'SAVE10', discountType: 'percentage', discountValue: 10 },
  }

  it('computes percentage discount to cents', () => {
    expect(percentageDiscountAmount(200, 10)).toBe(20)
    expect(percentageDiscountAmount(200, 150)).toBe(200)
  })

  it('computes fixed discount capped at base', () => {
    expect(fixedDiscountAmount(100, 30)).toBe(30)
    expect(fixedDiscountAmount(100, 500)).toBe(100)
  })

  it('applies doctor promo rules', () => {
    expect(computeDoctorPromoDiscountAmount(200, doctor.promoCode)).toBe(20)
    expect(computeDoctorPromoDiscountAmount(200, { active: false })).toBe(0)
  })

  it('payableAfterPromoDiscount never goes negative', () => {
    expect(payableAfterPromoDiscount(100, 30)).toBe(70)
    expect(payableAfterPromoDiscount(100, 200)).toBe(0)
  })

  it('computeAppointmentPayable adds home visit surcharge', () => {
    expect(computeAppointmentPayable(200, 20, 'Clinic')).toBe(180)
    expect(computeAppointmentPayable(200, 0, 'Home Visit', { pricingType: 'percentage', percentageValue: 50 })).toBe(
      300
    )
  })

  it('getPromoOfferLabel formats percent and fixed offers', () => {
    expect(getPromoOfferLabel(doctor, 'EGP ')).toContain('off')
    expect(getPromoOfferLabel({ promoCode: { active: true, discountType: 'fixed', discountValue: 50 } }, 'EGP ')).toContain(
      'EGP 50'
    )
  })
})
