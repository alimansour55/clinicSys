import { formatPercentDisplay } from './arabicNumerals.js'

/** Same rules as backend `appointmentPricingService` (minor units for exact %). */
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

import { computeHomeVisitSurcharge, DEFAULT_HOME_VISIT_PRICING, normalizeHomeVisitPricing } from './homeVisitPricing.js'

export { computeHomeVisitSurcharge, DEFAULT_HOME_VISIT_PRICING, normalizeHomeVisitPricing }

export const computeAppointmentPayable = (fees, discountAmount, appointmentType, homeVisitPricing = DEFAULT_HOME_VISIT_PRICING) => {
  const consult = payableAfterPromoDiscount(fees, discountAmount)
  const surcharge = appointmentType === 'Home Visit' ? computeHomeVisitSurcharge(fees, homeVisitPricing) : 0
  return consult + surcharge
}

const resolveFormatAmount = (currencySymbolOrFormat) =>
  typeof currencySymbolOrFormat === 'function'
    ? currencySymbolOrFormat
    : (n) => `${currencySymbolOrFormat}${n}`

export const getPromoOfferLabel = (doctor, currencySymbolOrFormat = '', translate, language = 'en') => {
  const promo = doctor?.promoCode || {}
  if (!promo.active || !Number(promo.discountValue || 0)) return ''

  const pct = Number(promo.discountValue || 0)
  const fixedAmount = resolveFormatAmount(currencySymbolOrFormat)(pct)

  if (typeof translate === 'function') {
    return promo.discountType === 'fixed'
      ? translate('{{amount}} off').replace(/\{\{amount\}\}/g, fixedAmount)
      : translate('{{pctLabel}} off').replace(/\{\{pctLabel\}\}/g, formatPercentDisplay(pct, language))
  }

  return promo.discountType === 'fixed'
    ? `${fixedAmount} off`
    : `${formatPercentDisplay(pct, language)} off`
}
