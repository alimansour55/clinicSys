const supportedHomeVisitAreas = [
  'Cairo',
  'Giza',
  '6th of October',
  'Sheikh Zayed',
  'Helwan',
  'Shubra',
  'New Cairo',
  'Nasr City',
  'Maadi',
  'Heliopolis',
  'Madinaty',
  'El Shorouk',
  'Badr City',
  'Mostakbal City',
  'New Capital',
  'Obour',
  'Rehab',
  'Dokki',
  'Mohandessin',
  'Agouza',
  'Zamalek',
  'Garden City',
  'Downtown Cairo',
  'Abbasiya',
  'Ain Shams',
  'Matariya',
  'Hadayek El Kobba',
  'Manial',
  'Mokattam',
  'Fifth Settlement',
  'First Settlement',
  'Haram',
  'Faisal',
  'Imbaba',
  'Warraq',
  'Boulaq Dakrour',
  'Hadayek October',
  'Hadayek Helwan',
  '15 May City'
]

const normalizeArea = (value) =>
  supportedHomeVisitAreas.find((area) => area.toLowerCase() === String(value || '').trim().toLowerCase()) || ''

export const normalizeDoctorHomeVisitAreas = (rawAreas) => {
  if (!Array.isArray(rawAreas)) return []
  const seen = new Set()
  const result = []
  for (const item of rawAreas) {
    const area = normalizeArea(item)
    if (!area) continue
    const key = area.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(area)
  }
  return result
}

export const getDoctorHomeVisitAreas = (doctor) => normalizeDoctorHomeVisitAreas(doctor?.homeVisitAreas)

export const doctorOffersHomeVisit = (doctor) => {
  if (!doctor?.available) return false
  const workingDays = doctor?.homeVisitSchedule?.workingDays
  const hasSchedule = Array.isArray(workingDays) && workingDays.length > 0
  return hasSchedule && getDoctorHomeVisitAreas(doctor).length > 0
}

const normalizeHomeVisitAddress = (payload = {}) => {
  const area = normalizeArea(payload.area)
  const street = String(payload.street || '').trim()
  const building = String(payload.building || '').trim()
  const floor = String(payload.floor || '').trim()
  const apartment = String(payload.apartment || '').trim()
  const notes = String(payload.notes || '').trim()

  return { area, street, building, floor, apartment, notes }
}

const validateHomeVisitAddress = (address, doctor = null) => {
  if (!address.area) return 'Please choose a supported home visit area'
  if (!address.street) return 'Please enter street name and number for the home visit'

  if (doctor) {
    const allowed = getDoctorHomeVisitAreas(doctor)
    if (!allowed.length) return 'This doctor is not available for home visits'
    const match = allowed.some((area) => area.toLowerCase() === address.area.toLowerCase())
    if (!match) return 'This doctor does not visit the selected area'
  }

  return ''
}

export {
  normalizeHomeVisitAddress,
  supportedHomeVisitAreas,
  validateHomeVisitAddress
}
