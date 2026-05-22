import { describe, it, expect } from 'vitest'
import {
  applyAppointmentPricing,
  applyDoctorPromoCode,
  getBaseAmount,
  isHomeVisitAppointmentType,
} from '../services/appointmentPricingService.js'
import { DEFAULT_GLOBAL_VISIT_FEES } from '../services/globalVisitFeesService.js'
import { doctorWithPromo } from './helpers/fixtures.js'

const globalFees = { enabled: false, examinationFee: 0, consultationFee: 0 }

describe('appointmentPricingService', () => {
  describe('isHomeVisitAppointmentType', () => {
    it('detects home visit type', () => {
      expect(isHomeVisitAppointmentType('Home Visit')).toBe(true)
      expect(isHomeVisitAppointmentType('Clinic')).toBe(false)
    })
  })

  describe('applyDoctorPromoCode', () => {
    const doctor = doctorWithPromo()

    it('applies percentage discount when code matches', () => {
      const result = applyDoctorPromoCode(doctor, 'save10', 'examination', globalFees)
      expect(result.error).toBeUndefined()
      expect(result.amount).toBe(180)
      expect(result.discountAmount).toBe(20)
      expect(result.promoCode).toBe('SAVE10')
    })

    it('applies fixed discount', () => {
      const fixedDoctor = doctorWithPromo({
        promoCode: { active: true, code: 'FLAT50', discountType: 'fixed', discountValue: 50 },
      })
      const result = applyDoctorPromoCode(fixedDoctor, 'FLAT50', 'examination', globalFees)
      expect(result.amount).toBe(150)
      expect(result.discountAmount).toBe(50)
    })

    it('rejects wrong promo code when doctor has active promo', () => {
      expect(applyDoctorPromoCode(doctor, 'WRONG', 'examination', globalFees).error).toMatch(/Invalid promo/)
    })

    it('rejects entered code when doctor has no promo', () => {
      const noPromo = { fees: 100 }
      expect(applyDoctorPromoCode(noPromo, 'ANY', 'examination', globalFees).error).toMatch(/Invalid promo/)
    })

    it('uses global fees when enabled and doctor has no custom fees', () => {
      const fees = { enabled: true, examinationFee: 300, consultationFee: 200 }
      expect(getBaseAmount({ fees: '' }, 'examination', fees)).toBe(300)
      expect(getBaseAmount({ fees: '' }, 'consultation', fees)).toBe(200)
    })

    it('doctor custom fees override global when set', () => {
      const fees = { enabled: true, examinationFee: 300, consultationFee: 200 }
      expect(getBaseAmount({ fees: 50 }, 'examination', fees)).toBe(50)
      expect(getBaseAmount({ fees: 50 }, 'consultation', fees)).toBe(37.5)
    })
  })

  describe('applyAppointmentPricing', () => {
    it('adds home visit surcharge on top of consult fee', async () => {
      const doctor = { fees: 200 }
      const result = await applyAppointmentPricing(doctor, {
        appointmentType: 'Home Visit',
        homeVisitPricing: { pricingType: 'percentage', percentageValue: 50, fixedAmount: 0 },
        globalVisitFees: globalFees,
      })
      expect(result.error).toBeUndefined()
      expect(result.homeVisitSurcharge).toBe(100)
      expect(result.amount).toBe(300)
    })

    it('returns error from invalid promo', async () => {
      const doctor = doctorWithPromo()
      const result = await applyAppointmentPricing(doctor, {
        promoCode: 'BAD',
        globalVisitFees: globalFees,
      })
      expect(result.error).toMatch(/Invalid promo/)
    })

    it('uses consultation visit fee type', async () => {
      const doctor = { fees: 400 }
      const result = await applyAppointmentPricing(doctor, {
        visitFeeType: 'consultation',
        globalVisitFees: globalFees,
      })
      expect(result.visitFeeType).toBe('consultation')
      expect(result.baseAmount).toBe(300)
    })
  })
})
