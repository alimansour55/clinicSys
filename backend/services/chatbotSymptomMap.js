/**
 * Symptom / complaint keywords → clinic speciality labels (match doctor.speciality in DB).
 */

const SPECIALTY_RULES = [
  {
    specialty: 'Pediatricians',
    priority: 10,
    en: [
      'child',
      'children',
      'kids',
      'kid',
      'baby',
      'infant',
      'pediatric',
      'pediatrician',
      'toddler',
      'my son',
      'my daughter',
      'children doctor',
      "child's doctor",
      'doctor for my child'
    ],
    ar: [
      'طفل',
      'أطفال',
      'اطفال',
      'رضيع',
      'مولود',
      'طفلي',
      'ابني',
      'ابني',
      'ابنتي',
      'طبيب أطفال',
      'دكتور أطفال',
      'دكتوره اطفال',
      'طبيب الاطفال',
      'عيادة أطفال'
    ]
  },
  {
    specialty: 'Dentist',
    priority: 9,
    en: ['tooth', 'teeth', 'dental', 'gum', 'cavity', 'toothache', 'jaw pain', 'dentist'],
    ar: ['سن', 'أسنان', 'ضرس', 'لثة', 'وجع سن', 'فم', 'تسوس', 'أسنان']
  },
  {
    specialty: 'Ophthalmologist',
    priority: 9,
    en: ['eye', 'vision', 'blurry', 'blind', 'ophthalm', 'sight'],
    ar: ['عين', 'عيون', 'نظر', 'رؤية', 'ضعف نظر', 'احمرار العين']
  },
  {
    specialty: 'Cardiologist',
    priority: 9,
    en: ['heart', 'chest pain', 'cardiac', 'palpitation'],
    ar: ['قلب', 'ألم صدر', 'صدر', 'خفقان']
  },
  {
    specialty: 'Dermatologist',
    priority: 9,
    en: ['skin', 'rash', 'acne', 'eczema', 'itch', 'dermat'],
    ar: ['جلد', 'طفح', 'حكة', 'بثور', 'أكزيما', 'حساسية جلد']
  },
  {
    specialty: 'Gynecologist',
    priority: 9,
    en: ['pregnancy', 'pregnant', 'period', 'gynec', 'obgyn', 'menstrual', 'uterus', 'women doctor'],
    ar: ['حمل', 'حامل', 'دورة', 'نساء', 'توليد', 'رحم', 'نساء وتوليد', 'دكتورة نساء']
  },
  {
    specialty: 'Orthopedic',
    priority: 9,
    en: ['bone', 'fracture', 'joint', 'knee', 'back pain', 'spine', 'orthopedic'],
    ar: ['عظم', 'كسر', 'مفصل', 'ركبة', 'ظهر', 'عمود فقري', 'مفاصل']
  },
  {
    specialty: 'Neurologist',
    priority: 9,
    en: ['headache', 'migraine', 'seizure', 'numbness', 'neurolog'],
    ar: ['صداع', 'شقيقة', 'تنميل', 'أعصاب', 'دوخة شديدة']
  },
  {
    specialty: 'Gastroenterologist',
    priority: 9,
    en: ['stomach', 'abdomen', 'nausea', 'vomit', 'diarrhea', 'digest', 'liver'],
    ar: ['معدة', 'بطن', 'غثيان', 'قيء', 'إسهال', 'هضم', 'كبد']
  },
  {
    specialty: 'General physician',
    priority: 1,
    en: ['fever', 'flu', 'cold', 'cough', 'caught a cold', 'have a cold', 'sore throat', 'checkup'],
    ar: ['حمى', 'سخونة', 'برد', 'كحة', 'سعال', 'إنفلونزا', 'زكام', 'التهاب حلق', 'كشف عام']
  }
]

/** Explicit "I want X doctor" — checked before symptom keywords */
const DIRECT_SPECIALTY_PHRASES = [
  { specialty: 'Pediatricians', patterns: [/children'?s?\s+doctor/i, /child\s+doctor/i, /pediatric/i, /kids?\s+doctor/i, /طبيب\s*أطفال/i, /دكتور\s*أطفال/i, /دكتوره\s*اطفال/i, /عيادة\s*أطفال/i] },
  { specialty: 'Gynecologist', patterns: [/gynecolog/i, /obgyn/i, /women'?s?\s+doctor/i, /طبيب\s*نساء/i, /نساء\s*وتوليد/i] },
  { specialty: 'Dermatologist', patterns: [/dermatolog/i, /skin\s+doctor/i, /طبيب\s*جلد/i] },
  { specialty: 'Neurologist', patterns: [/neurolog/i, /طبيب\s*أعصاب/i] },
  { specialty: 'Dentist', patterns: [/dentist/i, /dental/i, /طبيب\s*أسنان/i] },
  { specialty: 'General physician', patterns: [/general\s+(doctor|physician)/i, /family\s+doctor/i, /طبيب\s*عام/i] }
]

const VAGUE_ONLY = new Set([
  'tired',
  'exhausted',
  'fatigue',
  'sleepy',
  'weak',
  'not feeling well',
  'feel bad',
  'تعب',
  'تعبان',
  'تعبانة',
  'إرهاق',
  'ارهاق',
  'لا أشعر بتحسن',
  'مش كويس'
])

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

const norm = (s) => String(s || '').trim().toLowerCase()

export const detectMessageLanguage = (text = '') => (containsArabic(text) ? 'ar' : 'en')

export const detectEmergency = (text = '') => {
  const lower = String(text || '').toLowerCase()
  const patterns = [...EMERGENCY_PATTERNS.en, ...EMERGENCY_PATTERNS.ar]
  return patterns.some((p) => lower.includes(p.toLowerCase()))
}

export const isVagueOnlyMessage = (text = '') => {
  const t = norm(text)
  if (!t || t.length > 40) return false
  if (VAGUE_ONLY.has(t)) return true
  if (/^(i am|i'm|انا|أنا)\s+(tired|تعب|تعبان)/i.test(t)) return true
  return false
}

export const suggestSpecialtyFromText = (text = '') => {
  const raw = String(text || '')
  const lower = raw.toLowerCase()

  for (const { specialty, patterns } of DIRECT_SPECIALTY_PHRASES) {
    if (patterns.some((re) => re.test(raw) || re.test(lower))) return specialty
  }

  const isAr = containsArabic(raw)
  let best = null
  let bestScore = 0

  for (const rule of SPECIALTY_RULES) {
    const keywords = isAr ? rule.ar : rule.en
    let score = 0
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase()) || raw.includes(kw)) score += rule.priority || 1
    }
    if (score > bestScore) {
      bestScore = score
      best = rule.specialty
    }
  }

  if (best) return best

  for (const rule of SPECIALTY_RULES) {
    const all = [...rule.en, ...rule.ar]
    for (const kw of all) {
      if (lower.includes(kw.toLowerCase()) || raw.includes(kw)) {
        return rule.specialty
      }
    }
  }

  return null
}

/** Use full conversation (all user messages) for specialty — not only last line */
export const suggestSpecialtyFromConversation = (messages = []) => {
  const userTexts = messages.filter((m) => m.role === 'user').map((m) => String(m.content || ''))
  const combined = userTexts.join(' ')
  let best = suggestSpecialtyFromText(combined)

  for (const text of userTexts) {
    const s = suggestSpecialtyFromText(text)
    if (s) {
      if (!best || s === 'Pediatricians') best = s
      else if (best === 'General physician' && s !== 'General physician') best = s
    }
  }

  return best
}

export const matchDoctorSpecialty = (doctorSpecialty = '', target = '') => {
  const a = String(doctorSpecialty || '').trim().toLowerCase()
  const b = String(target || '').trim().toLowerCase()
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  if (b.includes('pediatr') && a.includes('pediatr')) return true
  if (b.includes('children') && a.includes('pediatr')) return true
  if (b.includes('child') && a.includes('pediatr')) return true
  if (
    (b.includes('general') || b.includes('practitioner') || b.includes('physician')) &&
    (a.includes('general') || a.includes('practitioner') || a.includes('physician'))
  ) {
    return true
  }
  return false
}

export const listKnownSpecialties = () => [...new Set(SPECIALTY_RULES.map((r) => r.specialty))]

// Back-compat alias
export const suggestSpecialtyFromSymptoms = suggestSpecialtyFromText
