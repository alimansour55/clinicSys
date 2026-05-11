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

export const formatHomeVisitAddress = (address = {}) => [
  address.area,
  address.street,
  address.building ? `Building ${address.building}` : '',
  address.floor ? `Floor ${address.floor}` : '',
  address.apartment ? `Apartment ${address.apartment}` : ''
].filter(Boolean).join(', ')
