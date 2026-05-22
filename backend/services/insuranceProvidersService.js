import siteSettingModel from '../models/siteSettingModel.js'

const SETTING_KEY = 'site-settings'

/** Default directory when none stored in site settings yet */
export const DEFAULT_INSURANCE_PROVIDERS = [
  'AXA Egypt',
  'Allianz Egypt',
  'GIG Egypt',
  'Bupa Egypt Insurance',
  'MetLife Egypt',
  'MedNet Egypt',
  'GlobeMed Egypt',
  'Medmark',
  'NextCare Egypt',
  'Misr Insurance (medical plans)',
  'Delta Insurance',
  'Mohandes Insurance',
  'Suez Canal Insurance',
  'Arab Misr Insurance Group (AMIG)'
]

const normalizeList = (input) => {
  if (!Array.isArray(input)) return []
  return [...new Set(input.map((item) => String(item || '').trim()).filter(Boolean))]
}

const getSettingsDocument = async () => {
  let doc = await siteSettingModel.findOne({ key: SETTING_KEY })
  if (!doc) doc = await siteSettingModel.create({ key: SETTING_KEY })
  return doc
}

/**
 * Active provider list: stored custom list if non-empty, otherwise built-in defaults.
 */
export const getResolvedInsuranceProviders = async () => {
  const doc = await getSettingsDocument()
  const raw = doc.insuranceProviders
  const normalized = normalizeList(raw)
  if (normalized.length > 0) return normalized
  return [...DEFAULT_INSURANCE_PROVIDERS]
}

export const assertValidInsuranceProvider = async (providerName) => {
  const name = String(providerName || '').trim()
  if (!name) throw new Error('Please select an insurance provider')
  const allowed = await getResolvedInsuranceProviders()
  if (!allowed.includes(name)) throw new Error('Invalid or unsupported insurance provider')
  return name
}
