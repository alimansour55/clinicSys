const getLocationSchedulesRecord = (doctor) => {
  const raw = doctor?.locationSchedules
  if (!raw) return {}
  return typeof raw === 'object' ? raw : {}
}

const hasWorkingDays = (days) =>
  Array.isArray(days) && days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).length > 0

/** Doctor configured at least one weekly clinic schedule (main or per-branch). */
export const hasDoctorPublishedSchedule = (doctor) => {
  if (hasWorkingDays(doctor?.schedule?.workingDays)) return true

  return Object.values(getLocationSchedulesRecord(doctor)).some((schedule) =>
    hasWorkingDays(schedule?.workingDays)
  )
}

/** Patient can book once weekly clinic slots are published. */
export const isDoctorBookableForPatients = (doctor) => {
  if (!doctor) return false
  if (typeof doctor.patientBookable === 'boolean') return doctor.patientBookable
  return hasDoctorPublishedSchedule(doctor)
}

/** Coming soon = no published weekly slots yet (admin-created profile). */
export const isDoctorComingSoon = (doctor) => !hasDoctorPublishedSchedule(doctor)

/** Clinic, voice, and video share the same weekly in-clinic hours (per branch when configured). */
export const usesClinicWeeklySchedule = (appointmentType) =>
  appointmentType === 'Clinic' || appointmentType === 'Voice Call' || appointmentType === 'Video Call'

export const isTeleconsultationType = (appointmentType) =>
  appointmentType === 'Voice Call' || appointmentType === 'Video Call'

/** Resolve which clinic branch schedule applies (auto-picks when only one location). */
export const resolveClinicLocationForSlots = (doctor, clinicLocation = '') => {
  const key = String(clinicLocation || '').trim()
  if (key) return key
  const locations = (doctor?.locations || []).map((loc) => String(loc || '').trim()).filter(Boolean)
  if (locations.length === 1) return locations[0]
  return ''
}
