/**
 * Symptom / complaint keywords → clinic speciality labels (match doctor.speciality in DB).
 */
const SPECIALTY_RULES = [
  {
    specialty: 'Dentist',
    en: ['tooth', 'teeth', 'dental', 'gum', 'cavity', 'toothache', 'jaw pain'],
    ar: ['سن', 'أسنان', 'ضرس', 'لثة', 'وجع سن', 'أسنان', 'فم', 'تسوس']
  },
  {
    specialty: 'Ophthalmologist',
    en: ['eye', 'vision', 'blurry', 'blind', 'ophthalm', 'sight'],
    ar: ['عين', 'عيون', 'نظر', 'رؤية', 'ضعف نظر', 'احمرار العين']
  },
  {
    specialty: 'Pediatricians',
    en: ['child', 'baby', 'infant', 'pediatric', 'kid fever', 'toddler'],
    ar: ['طفل', 'أطفال', 'رضيع', 'مولود', 'حمى الطفل', 'طفلي']
  },
  {
    specialty: 'Cardiologist',
    en: ['heart', 'chest pain', 'cardiac', 'palpitation', 'blood pressure heart'],
    ar: ['قلب', 'ألم صدر', 'صدر', 'خفقان', 'ضغط القلب']
  },
  {
    specialty: 'Dermatologist',
    en: ['skin', 'rash', 'acne', 'eczema', 'itch', 'dermat'],
    ar: ['جلد', 'طفح', 'حكة', 'بثور', 'أكزيما', 'حساسية جلد']
  },
  {
    specialty: 'Gynecologist',
    en: ['pregnancy', 'pregnant', 'period', 'gynec', 'obgyn', 'menstrual', 'uterus'],
    ar: ['حمل', 'حامل', 'دورة', 'نساء', 'توليد', 'رحم', 'حمل']
  },
  {
    specialty: 'Orthopedic',
    en: ['bone', 'fracture', 'joint', 'knee', 'back pain', 'spine', 'orthopedic'],
    ar: ['عظم', 'كسر', 'مفصل', 'ركبة', 'ظهر', 'عمود فقري', 'مفاصل']
  },
  {
    specialty: 'Neurologist',
    en: ['headache', 'migraine', 'seizure', 'stroke', 'numbness', 'neurolog'],
    ar: ['صداع', 'شقيقة', 'تنميل', 'سكتة', 'أعصاب', 'دوخة شديدة']
  },
  {
    specialty: 'Gastroenterologist',
    en: ['stomach', 'abdomen', 'nausea', 'vomit', 'diarrhea', 'digest', 'liver'],
    ar: ['معدة', 'بطن', 'غثيان', 'قيء', 'إسهال', 'هضم', 'كبد']
  },
  {
    specialty: 'General physician',
    en: ['fever', 'flu', 'cold', 'cough', 'fatigue', 'general', 'checkup'],
    ar: ['حمى', 'سخونة', 'برد', 'كحة', 'سعال', 'إنفلونزا', 'تعب', 'كشف عام']
  }
]

const EMERGENCY_PATTERNS = {
  en: [
    'chest pain',
    'heart attack',
    'cannot breathe',
    "can't breathe",
    'difficulty breathing',
    'severe bleeding',
    'heavy bleeding',
    'stroke',
    'face drooping',
    'sudden paralysis',
    'unconscious',
    'choking'
  ],
  ar: [
    'ألم شديد في الصدر',
    'ألم صدر شديد',
    'صعوبة في التنفس',
    'لا أستطيع التنفس',
    'نزيف شديد',
    'سكتة دماغية',
    'شلل مفاجئ',
    'فقدان الوعي',
    'اختناق'
  ]
}

const containsArabic = (text = '') => /[\u0600-\u06FF]/.test(String(text))

export const detectMessageLanguage = (text = '') => (containsArabic(text) ? 'ar' : 'en')

export const detectEmergency = (text = '') => {
  const lower = String(text || '').toLowerCase()
  const patterns = [...EMERGENCY_PATTERNS.en, ...EMERGENCY_PATTERNS.ar]
  return patterns.some((p) => lower.includes(p.toLowerCase()))
}

export const suggestSpecialtyFromSymptoms = (text = '') => {
  const lower = String(text || '').toLowerCase()
  const isAr = containsArabic(text)

  for (const rule of SPECIALTY_RULES) {
    const keywords = isAr ? rule.ar : rule.en
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()) || String(text).includes(kw))) {
      return rule.specialty
    }
  }

  // Cross-language fallback
  for (const rule of SPECIALTY_RULES) {
    const all = [...rule.en, ...rule.ar]
    if (all.some((kw) => lower.includes(kw.toLowerCase()) || String(text).includes(kw))) {
      return rule.specialty
    }
  }

  return null
}

export const matchDoctorSpecialty = (doctorSpecialty = '', target = '') => {
  const a = String(doctorSpecialty || '').trim().toLowerCase()
  const b = String(target || '').trim().toLowerCase()
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  if (b.includes('pediatr') && a.includes('pediatr')) return true
  if (
    (b.includes('general') || b.includes('practitioner') || b.includes('physician')) &&
    (a.includes('general') || a.includes('practitioner') || a.includes('physician'))
  ) {
    return true
  }
  return false
}

export const listKnownSpecialties = () => SPECIALTY_RULES.map((r) => r.specialty)
