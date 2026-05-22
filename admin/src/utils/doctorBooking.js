const getLocationSchedulesRecord = (doctor) => {
  const raw = doctor?.locationSchedules
  if (!raw) return {}
  return typeof raw === 'object' ? raw : {}
}

const hasWorkingDays = (days) =>
  Array.isArray(days) && days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).length > 0

export const hasDoctorPublishedSchedule = (doctor) => {
  if (hasWorkingDays(doctor?.schedule?.workingDays)) return true

  return Object.values(getLocationSchedulesRecord(doctor)).some((schedule) =>
    hasWorkingDays(schedule?.workingDays)
  )
}

export const isDoctorBookableForPatients = (doctor) => {
  if (!doctor) return false
  if (typeof doctor.patientBookable === 'boolean') return doctor.patientBookable
  return hasDoctorPublishedSchedule(doctor)
}

export const isDoctorComingSoon = (doctor) => !hasDoctorPublishedSchedule(doctor)

export const usesClinicWeeklySchedule = (appointmentType) =>
  appointmentType === 'Clinic' || appointmentType === 'Voice Call' || appointmentType === 'Video Call'

export const resolveClinicLocationForSlots = (doctor, clinicLocation = '') => {
  const key = String(clinicLocation || '').trim()
  if (key) return key
  const locations = (doctor?.locations || []).map((loc) => String(loc || '').trim()).filter(Boolean)
  if (locations.length === 1) return locations[0]
  return ''
}
