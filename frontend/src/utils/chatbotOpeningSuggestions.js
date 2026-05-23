import { doctorBelongsToClinicSection } from './doctorClinicPlaces'
import { isDoctorBookableForPatients, isDoctorComingSoon } from './doctorBooking'
import { translatePlaceSegment } from './placeTranslations'
import {
  CLINIC_SECTION_LABELS,
  DEFAULT_CLINIC_SECTION_NAMES,
  clinicSectionNorm as norm
} from './clinicSectionLabels'

export { DEFAULT_CLINIC_SECTION_NAMES, CLINIC_SECTION_LABELS, isKnownClinicSectionName } from './clinicSectionLabels'

export const resolveClinicSectionLabel = (name, language = 'en', t = (k) => k, tc = (k) => k, placeTranslationOverrides) => {
  const key = norm(name)
  const mapped = CLINIC_SECTION_LABELS[key]
  if (mapped) return language === 'ar' ? mapped.ar : mapped.en

  return (
    translatePlaceSegment(name, language, t, placeTranslationOverrides) ||
    (language === 'ar' ? tc(name) : name) ||
    name
  )
}

const toClinicRow = (clinic, language, t, tc, placeTranslationOverrides) => {
  const id = clinic?.id ?? (clinic?._id != null ? String(clinic._id) : null)
  const name = String(clinic?.name || clinic || '').trim()
  if (!name) return null

  const label = resolveClinicSectionLabel(name, language, t, tc, placeTranslationOverrides)

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

const bookableDoctors = (doctors) =>
  (doctors || []).filter((d) => isDoctorBookableForPatients(d) && !isDoctorComingSoon(d))

/** @deprecated use buildClinicSectionSuggestions */
export const buildOpeningSuggestions = (opts) => buildClinicSectionSuggestions(opts)

export const buildFallbackOpeningSuggestions = (language = 'en') =>
  DEFAULT_CLINIC_SECTION_NAMES.map((name) => ({
    id: `clinic-${norm(name)}`,
    kind: 'clinic',
    label: resolveClinicSectionLabel(name, language),
    clinicName: name,
    clinicId: null,
    doctorCount: 0
  }))
