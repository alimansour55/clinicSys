import { doctorBelongsToClinicSection } from './doctorClinicPlaces'
import { isDoctorBookableForPatients, isDoctorComingSoon } from './doctorBooking'
import { translatePlaceSegment } from './placeTranslations'

/** Matches backend defaultClinicNames — used before API clinics load. */
export const DEFAULT_CLINIC_SECTION_NAMES = [
  'General physician',
  'Gynecologist',
  'Dermatologist',
  'Pediatricians',
  'Neurologist',
  'Gastroenterologist'
]

const norm = (value) => String(value || '').trim().toLowerCase()

const bookableDoctors = (doctors) =>
  (doctors || []).filter((d) => isDoctorBookableForPatients(d) && !isDoctorComingSoon(d))

const toClinicRow = (clinic, language, t, tc, placeTranslationOverrides) => {
  const id = clinic?.id ?? (clinic?._id != null ? String(clinic._id) : null)
  const name = String(clinic?.name || clinic || '').trim()
  if (!name) return null

  const label =
    translatePlaceSegment(name, language, t, placeTranslationOverrides) || tc(name) || name

  return {
    id: `clinic-${id || name}`,
    kind: 'clinic',
    label,
    clinicName: name,
    clinicId: id,
    dedupeKey: `clinic:${norm(name)}`
  }
}

/**
 * Opening chips: every clinic section from the site (e.g. all 6 departments).
 */
export const buildClinicSectionSuggestions = ({
  doctors = [],
  clinics = [],
  t = (k) => k,
  tc = (k) => k,
  language = 'en',
  placeTranslationOverrides
} = {}) => {
  const bookable = bookableDoctors(doctors)
  const seen = new Set()
  const rows = []

  const push = (row) => {
    if (!row || seen.has(row.dedupeKey)) return
    seen.add(row.dedupeKey)
    rows.push({
      ...row,
      doctorCount: bookable.filter((doctor) =>
        doctorBelongsToClinicSection(doctor, row.clinicName, { clinicId: row.clinicId })
      ).length
    })
  }

  const apiClinics = (clinics || [])
    .map((clinic) => ({
      id: clinic?._id != null ? String(clinic._id) : null,
      name: String(clinic?.name || clinic || '').trim()
    }))
    .filter((c) => c.name)

  if (apiClinics.length) {
    apiClinics.forEach((clinic) => {
      push(toClinicRow(clinic, language, t, tc, placeTranslationOverrides))
    })
  } else {
    DEFAULT_CLINIC_SECTION_NAMES.forEach((name) => {
      push(toClinicRow({ name }, language, t, tc, placeTranslationOverrides))
    })
  }

  return rows.sort((a, b) => a.label.localeCompare(b.label, language === 'ar' ? 'ar' : 'en'))
}

/** @deprecated use buildClinicSectionSuggestions */
export const buildOpeningSuggestions = (opts) => buildClinicSectionSuggestions(opts)

export const buildFallbackOpeningSuggestions = (isRtl) =>
  DEFAULT_CLINIC_SECTION_NAMES.map((name) => ({
    id: `clinic-${norm(name)}`,
    kind: 'clinic',
    label: name,
    clinicName: name,
    clinicId: null,
    doctorCount: 0
  }))
