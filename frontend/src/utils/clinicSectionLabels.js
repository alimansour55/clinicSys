/** Matches backend defaultClinicNames — used before API clinics load. */
export const DEFAULT_CLINIC_SECTION_NAMES = [
  'General physician',
  'Gynecologist',
  'Dermatologist',
  'Pediatricians',
  'Neurologist',
  'Gastroenterologist'
]

const norm = (value) => String(value || '').trim().toLowerCase()

/** Homepage / chatbot clinic section chips — short labels for AR / EN. */
export const CLINIC_SECTION_LABELS = {
  dermatologist: { en: 'Dermatologist', ar: 'الجلدية' },
  gastroenterologist: { en: 'Gastroenterologist', ar: 'الجهاز الهضمي' },
  'general physician': { en: 'General physician', ar: 'الطب العام' },
  gynecologist: { en: 'Gynecologist', ar: 'النساء والتوليد' },
  neurologist: { en: 'Neurologist', ar: 'طب الأعصاب' },
  pediatricians: { en: 'Pediatricians', ar: 'طب الأطفال' },
  pediatrician: { en: 'Pediatricians', ar: 'طب الأطفال' },
  cardiologist: { en: 'Cardiologist', ar: 'أمراض القلب' },
  dentist: { en: 'Dentist', ar: 'طب الأسنان' },
  orthopedic: { en: 'Orthopedic', ar: 'العظام' },
  psychiatrist: { en: 'Psychiatrist', ar: 'الطب النفسي' }
}

const CLINIC_SECTION_NAME_SET = new Set(
  [...DEFAULT_CLINIC_SECTION_NAMES, ...Object.keys(CLINIC_SECTION_LABELS)].map(norm)
)

/** Clinic department names have dedicated labels — skip remote place translation. */
export const isKnownClinicSectionName = (raw) => CLINIC_SECTION_NAME_SET.has(norm(raw))

export { norm as clinicSectionNorm }
