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
