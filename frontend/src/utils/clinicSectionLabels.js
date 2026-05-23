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
  dermatologist: { en: 'Dermatologist', ar: 'جلدية' },
  gastroenterologist: { en: 'Gastroenterologist', ar: 'جهاز هضمي' },
  'general physician': { en: 'General physician', ar: 'عام' },
  gynecologist: { en: 'Gynecologist', ar: 'نساء وتوليد' },
  neurologist: { en: 'Neurologist', ar: 'أعصاب' },
  pediatricians: { en: 'Pediatricians', ar: 'أطفال' },
  pediatrician: { en: 'Pediatricians', ar: 'أطفال' },
  cardiologist: { en: 'Cardiologist', ar: 'قلب' },
  dentist: { en: 'Dentist', ar: 'أسنان' },
  orthopedic: { en: 'Orthopedic', ar: 'عظام' },
  psychiatrist: { en: 'Psychiatrist', ar: 'نفسي' }
}

const CLINIC_SECTION_NAME_SET = new Set(
  [...DEFAULT_CLINIC_SECTION_NAMES, ...Object.keys(CLINIC_SECTION_LABELS)].map(norm)
)

/** Clinic department names have dedicated labels — skip remote place translation. */
export const isKnownClinicSectionName = (raw) => CLINIC_SECTION_NAME_SET.has(norm(raw))

export { norm as clinicSectionNorm }
