export const DEFAULT_HOME_VISIT_PRICING = {
  pricingType: 'percentage',
  percentageValue: 50,
  fixedAmount: 0
}

export const normalizeHomeVisitPricing = (raw) => {
  const pricingType = raw?.pricingType === 'fixed' ? 'fixed' : 'percentage'
  const percentageValue = Math.min(
    200,
    Math.max(0, Number(raw?.percentageValue ?? DEFAULT_HOME_VISIT_PRICING.percentageValue) || 0)
  )
  const fixedAmount = Math.max(0, Number(raw?.fixedAmount ?? DEFAULT_HOME_VISIT_PRICING.fixedAmount) || 0)
  if (pricingType === 'fixed') {
    return { pricingType: 'fixed', percentageValue: DEFAULT_HOME_VISIT_PRICING.percentageValue, fixedAmount }
  }
  return { pricingType: 'percentage', percentageValue, fixedAmount: DEFAULT_HOME_VISIT_PRICING.fixedAmount }
}

export const computeHomeVisitSurcharge = (fees, homeVisitPricing = DEFAULT_HOME_VISIT_PRICING) => {
  const settings = normalizeHomeVisitPricing(homeVisitPricing)
  if (settings.pricingType === 'fixed') {
    return settings.fixedAmount
  }
  const baseMinor = Math.round(Math.max(0, Number(fees) || 0) * 100)
  return Math.round((baseMinor * settings.percentageValue) / 100) / 100
}

const resolveFormatAmount = (currencySymbolOrFormat) =>
  typeof currencySymbolOrFormat === 'function'
    ? currencySymbolOrFormat
    : (n) => `${currencySymbolOrFormat}${n}`

export const getHomeVisitFeeLabel = (homeVisitPricing, t, currencySymbolOrFormat = '') => {
  const formatAmount = resolveFormatAmount(currencySymbolOrFormat)
  const settings = normalizeHomeVisitPricing(homeVisitPricing)
  if (settings.pricingType === 'fixed') {
    const amount = formatAmount(settings.fixedAmount)
    return typeof t === 'function'
      ? t('Home visit fee (fixed {{amount}})').replace(/\{\{amount\}\}/g, amount)
      : `Home visit fee (${amount})`
  }
  const pct = String(settings.percentageValue)
  return typeof t === 'function'
    ? t('Home visit fee (+{{pct}}%)').replace(/\{\{pct\}\}/g, pct)
    : `Home visit fee (+${pct}%)`
}

export const getHomeVisitPricingHint = (homeVisitPricing, t, currencySymbolOrFormat = '', surchargeAmount = 0) => {
  const formatAmount = resolveFormatAmount(currencySymbolOrFormat)
  const settings = normalizeHomeVisitPricing(homeVisitPricing)
  if (settings.pricingType === 'fixed') {
    const amount = formatAmount(settings.fixedAmount)
    return typeof t === 'function'
      ? t('Home visit adds a fixed fee of {{amount}}.').replace(/\{\{amount\}\}/g, amount)
      : `Home visit adds ${amount}.`
  }
  const amount = formatAmount(surchargeAmount)
  return typeof t === 'function'
    ? t('Home visit adds {{pct}}% of the consultation fee ({{amount}}).')
        .replace(/\{\{pct\}\}/g, String(settings.percentageValue))
        .replace(/\{\{amount\}\}/g, amount)
    : `Home visit adds ${settings.percentageValue}% (${amount}).`
}
