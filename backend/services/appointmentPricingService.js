import {
  computeHomeVisitSurcharge,
  DEFAULT_HOME_VISIT_PRICING,
  normalizeHomeVisitPricing
} from './homeVisitPricingService.js'
import {
  DEFAULT_GLOBAL_VISIT_FEES,
  getGlobalVisitFeesSettings,
  normalizeVisitFeeType,
  resolveVisitFeeAmount
} from './globalVisitFeesService.js'

/** Amounts in major currency units; use minor units so % discounts match configured percent (e.g. 5% exact to cents). */
const toMinor = (major) => Math.round(Math.max(0, Number(major) || 0) * 100)
const fromMinor = (minor) => Math.max(0, minor) / 100

const normalizePromoCode = (value = '') => String(value || '').trim().toUpperCase()

export const isHomeVisitAppointmentType = (appointmentType) =>
  String(appointmentType || '').trim() === 'Home Visit'

export { computeHomeVisitSurcharge, DEFAULT_HOME_VISIT_PRICING, normalizeHomeVisitPricing }

const hasActiveDoctorPromo = (doctor) => {
  const promo = doctor?.promoCode || {}
  return Boolean(promo.active && promo.code)
}

const getBaseAmount = (doctor, visitFeeType = 'examination', globalVisitFees = DEFAULT_GLOBAL_VISIT_FEES) =>
  resolveVisitFeeAmount(doctor, visitFeeType, globalVisitFees)

const applyDoctorPromoCode = (doctor, rawPromoCode = '', visitFeeType = 'examination', globalVisitFees = DEFAULT_GLOBAL_VISIT_FEES) => {
  const promo = doctor?.promoCode || {}
  const baseAmount = getBaseAmount(doctor, visitFeeType, globalVisitFees)
  const enteredCode = normalizePromoCode(rawPromoCode)
  const activePromoCode = normalizePromoCode(promo.code)

  if (!hasActiveDoctorPromo(doctor)) {
    if (enteredCode) return { error: 'Invalid promo code for this doctor' }
    const baseMinor = toMinor(baseAmount)
    return { amount: fromMinor(baseMinor), discountAmount: 0, discountReason: '', promoCode: '' }
  }

  if (enteredCode && enteredCode !== activePromoCode) {
    return { error: 'Invalid promo code for this doctor' }
  }

  const discountValue = Math.max(0, Number(promo.discountValue || 0))
  const baseMinor = toMinor(baseAmount)
  const discountMinor = promo.discountType === 'fixed'
    ? Math.min(baseMinor, toMinor(discountValue))
    : Math.min(baseMinor, Math.round((baseMinor * Math.min(100, discountValue)) / 100))
  const discountAmount = fromMinor(discountMinor)
  const amount = fromMinor(baseMinor - discountMinor)

  return {
    amount,
    discountAmount,
    discountReason: `Promo code ${activePromoCode}`,
    promoCode: activePromoCode
  }
}

const applyHomeVisitSurcharge = (doctor, appointmentType, pricing, homeVisitPricing, visitFeeType, globalVisitFees) => {
  if (!isHomeVisitAppointmentType(appointmentType)) {
    return { ...pricing, homeVisitSurcharge: 0, homeVisitPricing: normalizeHomeVisitPricing(homeVisitPricing) }
  }

  const normalizedPricing = normalizeHomeVisitPricing(homeVisitPricing)
  const examinationBase = getBaseAmount(doctor, 'examination', globalVisitFees)
  const homeVisitSurcharge = computeHomeVisitSurcharge(examinationBase, normalizedPricing)
  const consultMinor = toMinor(pricing.amount)
  const surchargeMinor = toMinor(homeVisitSurcharge)

  return {
    ...pricing,
    homeVisitSurcharge,
    homeVisitPricing: normalizedPricing,
    amount: fromMinor(consultMinor + surchargeMinor)
  }
}

/** Visit-type fee + promo + optional home visit surcharge (admin-configured). */
export const applyAppointmentPricing = async (
  doctor,
  {
    promoCode = '',
    appointmentType = 'Clinic',
    homeVisitPricing = DEFAULT_HOME_VISIT_PRICING,
    visitFeeType = 'examination',
    globalVisitFees
  } = {}
) => {
  const normalizedVisitFeeType = normalizeVisitFeeType(visitFeeType)
  const resolvedGlobalFees = globalVisitFees || await getGlobalVisitFeesSettings()
  const pricing = applyDoctorPromoCode(doctor, promoCode, normalizedVisitFeeType, resolvedGlobalFees)
  if (pricing.error) return pricing

  const withSurcharge = applyHomeVisitSurcharge(
    doctor,
    appointmentType,
    pricing,
    homeVisitPricing,
    normalizedVisitFeeType,
    resolvedGlobalFees
  )

  return {
    ...withSurcharge,
    visitFeeType: normalizedVisitFeeType,
    baseAmount: getBaseAmount(doctor, normalizedVisitFeeType, resolvedGlobalFees),
    globalVisitFees: resolvedGlobalFees
  }
}

export { applyDoctorPromoCode, getBaseAmount }
