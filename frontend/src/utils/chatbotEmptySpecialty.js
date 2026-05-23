import { doctorBelongsToClinicSection } from './doctorClinicPlaces'
import { isDoctorBookableForPatients, isDoctorComingSoon } from './doctorBooking'
import {
  buildClinicSectionSuggestions,
  resolveClinicSectionLabel
} from './chatbotOpeningSuggestions.js'

const norm = (value) => String(value || '').trim().toLowerCase()

const GENERAL_PHYSICIAN = 'General physician'

/** Related clinic sections to suggest when the chosen one is empty. */
export const RELATED_CLINIC_SECTIONS = {
  gastroenterologist: [GENERAL_PHYSICIAN, 'Dermatologist', 'Neurologist'],
  dermatologist: [GENERAL_PHYSICIAN, 'Gynecologist', 'Pediatricians'],
  gynecologist: [GENERAL_PHYSICIAN, 'Pediatricians', 'Dermatologist'],
  neurologist: [GENERAL_PHYSICIAN, 'Gastroenterologist', 'Dermatologist'],
  pediatricians: [GENERAL_PHYSICIAN, 'Gynecologist', 'Dermatologist'],
  pediatrician: [GENERAL_PHYSICIAN, 'Gynecologist', 'Dermatologist'],
  'general physician': ['Pediatricians', 'Dermatologist', 'Gynecologist']
}

const EN_PLURAL_LABELS = {
  dermatologist: 'Dermatologists',
  gastroenterologist: 'Gastroenterologists',
  gynecologist: 'Gynecologists',
  neurologist: 'Neurologists',
  pediatricians: 'Pediatricians',
  pediatrician: 'Pediatricians',
  'general physician': 'General Physicians'
}

export const formatEmptySpecialtyName = (clinicOrSpecialtyName, language = 'en') => {
  const key = norm(clinicOrSpecialtyName)
  if (language === 'ar') {
    return resolveClinicSectionLabel(clinicOrSpecialtyName, 'ar')
  }
  const label = resolveClinicSectionLabel(clinicOrSpecialtyName, 'en')
  return EN_PLURAL_LABELS[key] || label
}

export const buildEmptySpecialtyMessage = (clinicOrSpecialtyName, language = 'en') => {
  const display = formatEmptySpecialtyName(clinicOrSpecialtyName, language)
  if (language === 'ar') {
    return `لا يوجد أطباء ${display} متاحين حالياً 😔\nيمكنك:\n• اختيار تخصص آخر\n• الحجز مع طبيب عام للتقييم المبدئي`
  }
  return `Currently there are no ${display} available 😔\nYou can:\n• Try another specialty\n• Book with a General Physician for initial evaluation`
}

const countBookableInSection = (doctors, clinicName, clinicId) =>
  (doctors || []).filter(
    (doctor) =>
      isDoctorBookableForPatients(doctor) &&
      !isDoctorComingSoon(doctor) &&
      doctorBelongsToClinicSection(doctor, clinicName, { clinicId })
  ).length

/**
 * Build friendly empty-state message + tappable alternative clinic sections.
 */
export const buildEmptySpecialtyGuidance = ({
  doctors = [],
  clinics = [],
  emptyClinicName = '',
  emptyClinicId = null,
  language = 'en',
  t = (k) => k,
  tc = (k) => k,
  placeTranslationOverrides,
  messageOverride = ''
} = {}) => {
  const emptyKey = norm(emptyClinicName)
  const availableSections = buildClinicSectionSuggestions({
    doctors,
    clinics,
    t,
    tc,
    language,
    placeTranslationOverrides
  }).filter((section) => section.doctorCount > 0)

  const seen = new Set(emptyKey ? [emptyKey] : [])
  const suggestions = []

  const pushSection = (section, { isFallback = false } = {}) => {
    const key = norm(section.clinicName)
    if (!key || seen.has(key) || section.doctorCount <= 0) return
    seen.add(key)
    suggestions.push({
      id: `alt-${section.id}`,
      kind: 'clinic',
      label: section.label,
      clinicName: section.clinicName,
      clinicId: section.clinicId,
      isFallback: isFallback || key === norm(GENERAL_PHYSICIAN)
    })
  }

  if (!emptyKey) {
    const generalSection = availableSections.find((s) => norm(s.clinicName) === norm(GENERAL_PHYSICIAN))
    if (generalSection) pushSection(generalSection, { isFallback: true })
    for (const section of availableSections) {
      if (suggestions.length >= 4) break
      pushSection(section)
    }
    return {
      message: messageOverride,
      suggestions
    }
  }

  const relatedKeys = (RELATED_CLINIC_SECTIONS[emptyKey] || [GENERAL_PHYSICIAN]).map(norm)

  // General physician fallback first when available
  const generalSection = availableSections.find((s) => norm(s.clinicName) === norm(GENERAL_PHYSICIAN))
  if (generalSection && emptyKey !== norm(GENERAL_PHYSICIAN)) {
    pushSection(generalSection, { isFallback: true })
  }

  // Related specialties with available doctors
  for (const relatedKey of relatedKeys) {
    const match = availableSections.find((s) => norm(s.clinicName) === relatedKey)
    if (match) pushSection(match)
  }

  // Any other sections with doctors (up to 4 total alternatives)
  for (const section of availableSections) {
    if (suggestions.length >= 4) break
    pushSection(section)
  }

  return {
    message:
      messageOverride ||
      (emptyClinicName ? buildEmptySpecialtyMessage(emptyClinicName, language) : ''),
    suggestions
  }
}

/** Resolve clinic id/name from a specialty string used in symptom flow. */
export const specialtyToClinicName = (specialty) => {
  const key = norm(specialty)
  const map = {
    'general physician': GENERAL_PHYSICIAN,
    gynecologist: 'Gynecologist',
    dermatologist: 'Dermatologist',
    pediatricians: 'Pediatricians',
    neurologist: 'Neurologist',
    gastroenterologist: 'Gastroenterologist'
  }
  return map[key] || specialty
}

export const hasBookableDoctorsInSection = (doctors, clinicName, clinicId = null) =>
  countBookableInSection(doctors, clinicName, clinicId) > 0
