import { describe, it, expect } from 'vitest'
import {
  normalizeHomeVisitPricing,
  computeHomeVisitSurcharge,
  getHomeVisitFeeLabel,
  getHomeVisitPricingHint,
  DEFAULT_HOME_VISIT_PRICING,
} from './homeVisitPricing.js'

describe('homeVisitPricing', () => {
  const t = (key) => key

  it('normalizes percentage and fixed modes', () => {
    expect(normalizeHomeVisitPricing({})).toEqual({
      pricingType: 'percentage',
      percentageValue: 50,
      fixedAmount: 0,
    })
    expect(normalizeHomeVisitPricing({ pricingType: 'fixed', fixedAmount: 80 }).pricingType).toBe('fixed')
  })

  it('computes surcharge from fees', () => {
    expect(computeHomeVisitSurcharge(200, { pricingType: 'percentage', percentageValue: 50 })).toBe(100)
    expect(computeHomeVisitSurcharge(200, { pricingType: 'fixed', fixedAmount: 75 })).toBe(75)
  })

  it('builds fee labels with translation helper', () => {
    expect(getHomeVisitFeeLabel({ pricingType: 'fixed', fixedAmount: 60 }, t, 'EGP ')).toContain('60')
    expect(getHomeVisitFeeLabel({ pricingType: 'percentage', percentageValue: 40 }, t)).toContain('40')
  })

  it('builds pricing hints', () => {
    const hint = getHomeVisitPricingHint(DEFAULT_HOME_VISIT_PRICING, t, 'EGP ', 50)
    expect(hint).toContain('50')
  })
})
