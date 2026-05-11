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

const normalizeArea = (value) => supportedHomeVisitAreas.find((area) => area.toLowerCase() === String(value || '').trim().toLowerCase()) || ''

const normalizeHomeVisitAddress = (payload = {}) => {
  const area = normalizeArea(payload.area)
  const street = String(payload.street || '').trim()
  const building = String(payload.building || '').trim()
  const floor = String(payload.floor || '').trim()
  const apartment = String(payload.apartment || '').trim()
  const notes = String(payload.notes || '').trim()

  return { area, street, building, floor, apartment, notes }
}

const validateHomeVisitAddress = (address) => {
  if (!address.area) return 'Please choose a supported home visit area'
  if (!address.street) return 'Please enter street name and number for the home visit'
  return ''
}

export { normalizeHomeVisitAddress, supportedHomeVisitAreas, validateHomeVisitAddress }
