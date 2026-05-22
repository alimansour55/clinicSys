export const supportedHomeVisitAreas = [
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

export const emptyHomeVisitAddress = {
  area: '',
  street: '',
  building: '',
  floor: '',
  apartment: '',
  notes: ''
}

export const getDoctorHomeVisitAreas = (doctor, allAreas = supportedHomeVisitAreas) => {
  const selected = Array.isArray(doctor?.homeVisitAreas) ? doctor.homeVisitAreas : []
  if (!selected.length) return []
  const allowed = new Set(selected.map((area) => String(area).trim().toLowerCase()))
  return allAreas.filter((area) => allowed.has(area.toLowerCase()))
}

export const doctorOffersHomeVisit = (doctor) => {
  if (!doctor) return false
  const workingDays = doctor?.homeVisitSchedule?.workingDays
  const hasSchedule = Array.isArray(workingDays) && workingDays.length > 0
  return hasSchedule && getDoctorHomeVisitAreas(doctor).length > 0
}

export const formatHomeVisitAddress = (address = {}) => [
  address.area,
  address.street,
  address.building ? `Building ${address.building}` : '',
  address.floor ? `Floor ${address.floor}` : '',
  address.apartment ? `Apartment ${address.apartment}` : ''
].filter(Boolean).join(', ')
