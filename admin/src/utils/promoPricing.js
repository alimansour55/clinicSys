/**
 * Promo / percentage discounts use minor units (cents) so e.g. 5% of the fee
 * matches Stripe and backend booking math (no whole-unit rounding drift).
 */

export const percentageDiscountAmount = (baseMajor, percentMajor) => {
  const baseMinor = Math.round(Math.max(0, Number(baseMajor) || 0) * 100)
  const pct = Math.min(100, Math.max(0, Number(percentMajor) || 0))
  if (baseMinor <= 0 || pct <= 0) return 0
  return Math.min(baseMinor, Math.round((baseMinor * pct) / 100)) / 100
}

export const fixedDiscountAmount = (baseMajor, fixedMajor) => {
  const baseMinor = Math.round(Math.max(0, Number(baseMajor) || 0) * 100)
  const fixedMinor = Math.round(Math.max(0, Number(fixedMajor) || 0) * 100)
  if (baseMinor <= 0) return 0
  return Math.min(baseMinor, fixedMinor) / 100
}

/** Active doctor promo on list fee; mirrors backend `applyDoctorPromoCode` (no code entry check). */
export const computeDoctorPromoDiscountAmount = (fees, promo) => {
  const base = Number(fees) || 0
  if (!promo?.active || !String(promo.code || '').trim()) return 0
  const dv = Math.max(0, Number(promo.discountValue || 0))
  if (promo.discountType === 'fixed') return fixedDiscountAmount(base, dv)
  return percentageDiscountAmount(base, Math.min(100, dv))
}

export const payableAfterPromoDiscount = (fees, discountAmount) => {
  const baseMinor = Math.round(Math.max(0, Number(fees) || 0) * 100)
  const discMinor = Math.round(Math.max(0, Number(discountAmount) || 0) * 100)
  return Math.max(0, baseMinor - Math.min(baseMinor, discMinor)) / 100
}

export { computeHomeVisitSurcharge, DEFAULT_HOME_VISIT_PRICING, getHomeVisitFeeLabel, normalizeHomeVisitPricing } from './homeVisitPricing.js'
