/** English stored name → Arabic display (Arabic UI only). */
export const INSURANCE_PROVIDER_EN_TO_AR = {
  'AXA Egypt': 'أكسا مصر',
  'Allianz Egypt': 'أليانز مصر',
  'GIG Egypt': 'جي آي جي مصر',
  'Bupa Egypt Insurance': 'بوبا للتأمين مصر',
  'Bupa Egypt': 'بوبا للتأمين مصر',
  'MetLife Egypt': 'ميتلايف مصر',
  'MedNet Egypt': 'ميد نت مصر',
  'GlobeMed Egypt': 'جلوب ميد مصر',
  'NextCare Egypt': 'نكست كير مصر',
  'Misr Insurance (medical plans)': 'مصر للتأمين (الخطط الطبية)',
  'Misr Insurance': 'مصر للتأمين (الخطط الطبية)',
}

/** English UI labels (stored DB name may differ). */
export const INSURANCE_PROVIDER_EN_LABELS = {
  'AXA Egypt': 'AXA Egypt',
  'Allianz Egypt': 'Allianz Egypt',
  'GIG Egypt': 'GIG Egypt',
  'Bupa Egypt Insurance': 'Bupa Egypt',
  'Bupa Egypt': 'Bupa Egypt',
  'MetLife Egypt': 'MetLife Egypt',
  'MedNet Egypt': 'MedNet Egypt',
  'GlobeMed Egypt': 'GlobeMed Egypt',
  'NextCare Egypt': 'NextCare Egypt',
  'Misr Insurance (medical plans)': 'Misr Insurance',
  'Misr Insurance': 'Misr Insurance',
}

export const translateInsuranceProviderName = (name, t, language = 'en') => {
  const key = String(name || '').trim()
  if (!key) return key

  if (language === 'ar') {
    if (INSURANCE_PROVIDER_EN_TO_AR[key]) return INSURANCE_PROVIDER_EN_TO_AR[key]
    if (typeof t === 'function') {
      const translated = t(key)
      if (translated && translated !== key) return translated
    }
  }

  return INSURANCE_PROVIDER_EN_LABELS[key] || key
}

/**
 * A provider's name in the current language. Uses the admin-entered bilingual label
 * (`providersI18n` from /api/user/insurance-providers) when it has text in this language,
 * and the built-in names otherwise.
 */
export const insuranceProviderLabel = (name, providersI18n, { t, tc, language = 'en' } = {}) => {
  const key = String(name || '').trim()
  if (!key) return key
  const entry = Array.isArray(providersI18n)
    ? providersI18n.find((item) => item?.name === key || item?.en === key || item?.ar === key)
    : null
  const stored = entry?.[language]
  if (stored && stored !== key) return typeof tc === 'function' ? tc(entry) : stored
  return translateInsuranceProviderName(key, t, language)
}
