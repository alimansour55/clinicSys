import clinicModel, { clinicBilingualFields } from '../models/clinicModel.js'
import doctorModel, { doctorBilingualFields } from '../models/doctorModel.js'
import receptionistModel from '../models/receptionistModel.js'
import siteSettingModel, { siteSettingBilingualFields } from '../models/siteSettingModel.js'

/** A receptionist's schema does not declare `i18n` yet, so writes to it use `strict: false`. */
export const receptionistBilingualFields = {
  name: { kind: 'name' }
}

/**
 * Every model holding bilingual content. Retry, status and the backfill script all read this.
 * Site settings are one document with nested sections, so its field names are dotted paths.
 */
export const BILINGUAL_MODELS = [
  { label: 'clinic', model: clinicModel, fields: clinicBilingualFields },
  { label: 'doctor', model: doctorModel, fields: doctorBilingualFields },
  { label: 'receptionist', model: receptionistModel, fields: receptionistBilingualFields },
  { label: 'site settings', model: siteSettingModel, fields: siteSettingBilingualFields }
]
