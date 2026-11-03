import clinicModel, { clinicBilingualFields } from '../models/clinicModel.js'
import doctorModel, { doctorBilingualFields } from '../models/doctorModel.js'
import { receptionistBilingualFields } from '../models/bilingualFieldSchema.js'
import receptionistModel from '../models/receptionistModel.js'
import siteSettingModel, { siteSettingBilingualFields } from '../models/siteSettingModel.js'

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
