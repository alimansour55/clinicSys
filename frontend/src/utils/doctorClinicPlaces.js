import {
  arabicPlaceLabelForFilter,
  extractMainPlaceFromLocation,
  norm,
  placeFilterKey,
} from './placeTranslations.js'

/** Normalized key for matching clinic section names to doctor fields. */
export const normalizePlaceKey = (value) => String(value || '').trim().toLowerCase()

/** Assigned clinic document ids (populated or raw ObjectIds). */
export function getDoctorClinicIds(doctor) {
  if (!doctor) return []
  return (doctor.clinics || [])
    .map((clinic) => {
      if (clinic == null) return ''
      if (typeof clinic === 'object' && clinic._id != null) return String(clinic._id)
      return String(clinic).trim()
    })
    .filter(Boolean)
}

/** Clinic names from assigned clinics (populated) and branch location strings. */
export function getDoctorClinicPlaceNames(doctor) {
  if (!doctor) return []

  const fromClinics = (doctor.clinics || []).map((clinic) => {
    if (clinic == null) return ''
    if (typeof clinic === 'object') return String(clinic.name || '').trim()
    return String(clinic).trim()
  })

  const fromLocations = Array.isArray(doctor.locations)
    ? doctor.locations.map((loc) => String(loc || '').trim()).filter(Boolean)
    : []

  return [...fromClinics.filter(Boolean), ...fromLocations]
}

/**
 * Home "Clinic sections" tabs use clinic names that align with doctor speciality
 * (e.g. General physician). Match speciality, clinic assignment, and locations.
 */
export function doctorBelongsToClinicSection(doctor, sectionName, options = {}) {
  if (!sectionName || sectionName === 'All Specialities') return true

  const target = normalizePlaceKey(sectionName)
  if (!target) return false

  if (normalizePlaceKey(doctor?.speciality) === target) return true

  const clinicId = options.clinicId != null ? String(options.clinicId) : ''
  if (clinicId && getDoctorClinicIds(doctor).includes(clinicId)) return true

  return getDoctorClinicPlaceNames(doctor).some((place) => normalizePlaceKey(place) === target)
}

/** Unique district/area labels for the patient doctors location filter (not full street addresses). */
export function collectLocationFilterPlaces(doctors = [], specialitySet = new Set()) {
  const byKey = new Map()

  for (const doctor of doctors) {
    for (const loc of doctor.locations || []) {
      const main = extractMainPlaceFromLocation(loc)
      if (!main || specialitySet.has(main)) continue

      const key = placeFilterKey(main)
      if (!key) continue

      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, main)
        continue
      }
      if (/[\u0600-\u06FF]/.test(main) && !/[\u0600-\u06FF]/.test(existing)) {
        byKey.set(key, main)
      }
    }
  }

  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}

/** Match doctors by district/area filter (supports legacy full-address clinic query params). */
export function doctorMatchesLocationFilter(doctor, selectedPlace) {
  if (!selectedPlace) return true

  const targetKey = placeFilterKey(selectedPlace)
  const targetArabic = arabicPlaceLabelForFilter(selectedPlace)
  const targetNorm = norm(selectedPlace)
  if (!targetKey && !targetNorm) return false

  return getDoctorClinicPlaceNames(doctor).some((place) => {
    if (placeFilterKey(place) === targetKey) return true
    const main = extractMainPlaceFromLocation(place) || place
    if (targetKey && placeFilterKey(main) === targetKey) return true
    if (targetArabic && norm(main) === norm(targetArabic)) return true
    return norm(main) === targetNorm || norm(place) === targetNorm
  })
}
