import { recordText } from './bilingualContent.js'
import { displayPersonName } from './personNameArabic.js'
import { getTranslatedDoctorAbout } from './doctorAboutTranslate.js'

const plainAddress = (address) => {
  if (!address) return ''
  if (typeof address === 'string') return address.trim()
  return [address.line1, address.line2].map((line) => String(line || '').trim()).filter(Boolean).join(', ')
}

/**
 * One doctor field as a patient should read it. The admin's stored bilingual value wins; records
 * not backfilled yet fall back to the older display logic for that field.
 * Works for a doctor from the public list and for an appointment's `docData` snapshot.
 *
 * @param {object} doctor
 * @param {'name'|'speciality'|'degree'|'about'|'address'} field
 * @param {{ tc: Function, language: 'en'|'ar', textTranslationOverrides?: object }} ctx
 */
export const doctorFieldText = (doctor, field, { tc, language, textTranslationOverrides } = {}) => {
  if (!doctor) return ''
  const stored = recordText(tc, doctor, field)
  if (stored) return stored
  const translate = typeof tc === 'function' ? tc : (value) => value
  switch (field) {
    case 'name':
      return displayPersonName(doctor.name, language)
    case 'about':
      return getTranslatedDoctorAbout(doctor.about, language, textTranslationOverrides)
    case 'address':
      return plainAddress(doctor.address)
    default:
      return doctor[field] ? String(translate(doctor[field]) ?? '') : ''
  }
}
