/** Curated insurance provider directory labels (English stored name → Arabic display). */
export const INSURANCE_PROVIDER_EN_TO_AR = {
  'AXA Egypt': 'أكسا مصر',
  'Allianz Egypt': 'أليانز مصر',
  'GIG Egypt': 'جي آي جي مصر',
  'Bupa Egypt Insurance': 'بوبا للتأمين مصر',
  'MetLife Egypt': 'ميتلايف مصر',
  'MedNet Egypt': 'ميد نت مصر',
  'GlobeMed Egypt': 'جلوب ميد مصر',
  'NextCare Egypt': 'نكست كير مصر',
  'Misr Insurance (medical plans)': 'مصر للتأمين (الخطط الطبية)',
}

export const translateInsuranceProviderName = (name, t) => {
  const key = String(name || '').trim()
  if (!key) return key
  if (INSURANCE_PROVIDER_EN_TO_AR[key]) return INSURANCE_PROVIDER_EN_TO_AR[key]
  if (typeof t === 'function') {
    const translated = t(key)
    if (translated && translated !== key) return translated
  }
  return key
}
