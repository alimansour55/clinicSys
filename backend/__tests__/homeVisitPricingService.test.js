import { describe, it, expect } from 'vitest'
import {
  normalizeHomeVisitPricing,
  computeHomeVisitSurcharge,
  describeHomeVisitPricing,
  DEFAULT_HOME_VISIT_PRICING,
} from '../services/homeVisitPricingService.js'

describe('homeVisitPricingService', () => {
  describe('normalizeHomeVisitPricing', () => {
    it('defaults to percentage pricing', () => {
      expect(normalizeHomeVisitPricing({})).toEqual({
        pricingType: 'percentage',
        percentageValue: 50,
        fixedAmount: 0,
      })
    })

    it('caps percentage at 200', () => {
      expect(normalizeHomeVisitPricing({ percentageValue: 500 }).percentageValue).toBe(200)
    })

    it('uses fixed amount mode', () => {
      expect(normalizeHomeVisitPricing({ pricingType: 'fixed', fixedAmount: 75 })).toEqual({
        pricingType: 'fixed',
        percentageValue: DEFAULT_HOME_VISIT_PRICING.percentageValue,
        fixedAmount: 75,
      })
    })
  })

  describe('computeHomeVisitSurcharge', () => {
    it('computes percentage from doctor fees', () => {
      expect(computeHomeVisitSurcharge({ fees: 200 }, { pricingType: 'percentage', percentageValue: 50 })).toBe(100)
    })

    it('computes percentage from numeric base', () => {
      expect(computeHomeVisitSurcharge(200, { pricingType: 'percentage', percentageValue: 25 })).toBe(50)
    })

    it('uses fixed surcharge', () => {
      expect(computeHomeVisitSurcharge(200, { pricingType: 'fixed', fixedAmount: 80 })).toBe(80)
    })
  })

  describe('describeHomeVisitPricing', () => {
    it('describes fixed and percentage modes', () => {
      expect(describeHomeVisitPricing({ pricingType: 'fixed', fixedAmount: 60 }).pricingType).toBe('fixed')
      expect(describeHomeVisitPricing({ pricingType: 'percentage', percentageValue: 40 }).percentageValue).toBe(40)
    })
  })
})
