import siteSettingModel from '../models/siteSettingModel.js'

const SETTING_KEY = 'site-settings'

export const DEFAULT_HOME_VISIT_PRICING = {
  pricingType: 'percentage',
  percentageValue: 50,
  fixedAmount: 0
}

export const normalizeHomeVisitPricing = (raw = {}) => {
  const pricingType = raw.pricingType === 'fixed' ? 'fixed' : 'percentage'
  const percentageValue = Math.min(200, Math.max(0, Number(raw.percentageValue ?? DEFAULT_HOME_VISIT_PRICING.percentageValue) || 0))
  const fixedAmount = Math.max(0, Number(raw.fixedAmount ?? DEFAULT_HOME_VISIT_PRICING.fixedAmount) || 0)

  if (pricingType === 'fixed') {
    return { pricingType: 'fixed', percentageValue: DEFAULT_HOME_VISIT_PRICING.percentageValue, fixedAmount }
  }

  return { pricingType: 'percentage', percentageValue, fixedAmount: DEFAULT_HOME_VISIT_PRICING.fixedAmount }
}

export const getHomeVisitPricingSettings = async () => {
  const doc = await siteSettingModel.findOne({ key: SETTING_KEY }).select('homeVisitPricing').lean()
  return normalizeHomeVisitPricing(doc?.homeVisitPricing)
}

const resolveBaseFee = (doctorOrBaseFee) => {
  if (typeof doctorOrBaseFee === 'object' && doctorOrBaseFee !== null) {
    return Number(doctorOrBaseFee?.fees || 0)
  }
  return Number(doctorOrBaseFee || 0)
}

const toMinor = (major) => Math.round(Math.max(0, Number(major) || 0) * 100)
const fromMinor = (minor) => Math.max(0, minor) / 100

/** @param {object|number} doctorOrBaseFee — doctor document or numeric examination base fee */
export const computeHomeVisitSurcharge = (doctorOrBaseFee, homeVisitPricing = DEFAULT_HOME_VISIT_PRICING) => {
  const settings = normalizeHomeVisitPricing(homeVisitPricing)

  if (settings.pricingType === 'fixed') {
    return fromMinor(toMinor(settings.fixedAmount))
  }

  const baseMinor = toMinor(resolveBaseFee(doctorOrBaseFee))
  const pct = settings.percentageValue
  return fromMinor(Math.round((baseMinor * pct) / 100))
}

/** Short label for receipts / UI (English keys; clients may translate). */
export const describeHomeVisitPricing = (homeVisitPricing = DEFAULT_HOME_VISIT_PRICING) => {
  const settings = normalizeHomeVisitPricing(homeVisitPricing)
  if (settings.pricingType === 'fixed') {
    return { pricingType: 'fixed', labelKey: 'Home visit fee (fixed)', fixedAmount: settings.fixedAmount }
  }
  return {
    pricingType: 'percentage',
    labelKey: 'Home visit fee (percentage)',
    percentageValue: settings.percentageValue
  }
}
