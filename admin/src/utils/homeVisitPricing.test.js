import { describe, it, expect } from 'vitest'
import {
  normalizeHomeVisitPricing,
  computeHomeVisitSurcharge,
  getHomeVisitFeeLabel,
  DEFAULT_HOME_VISIT_PRICING,
} from './homeVisitPricing.js'

describe('homeVisitPricing', () => {
  const t = (k) => k

  it('normalizes modes', () => {
    expect(normalizeHomeVisitPricing({}).pricingType).toBe('percentage')
    expect(normalizeHomeVisitPricing({ pricingType: 'fixed', fixedAmount: 90 }).fixedAmount).toBe(90)
  })

  it('computes percentage surcharge', () => {
    expect(computeHomeVisitSurcharge(200, { pricingType: 'percentage', percentageValue: 50 })).toBe(100)
  })

  it('getHomeVisitFeeLabel uses translator', () => {
    const label = getHomeVisitFeeLabel(DEFAULT_HOME_VISIT_PRICING, t, 'EGP ')
    expect(label).toContain('50')
  })
})
