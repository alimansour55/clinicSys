import clinicModel, { clinicBilingualFields } from '../models/clinicModel.js'

/** Every model holding bilingual content. Retry, status and the backfill script all read this. */
export const BILINGUAL_MODELS = [{ label: 'clinic', model: clinicModel, fields: clinicBilingualFields }]
