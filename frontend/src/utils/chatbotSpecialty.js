/**
 * Structured specialty detection for clinic chatbot (EN + AR).
 */

export const SPECIALTY_IDS = {
  GYNECOLOGIST: 'Gynecologist',
  DERMATOLOGIST: 'Dermatologist',
  PEDIATRICIANS: 'Pediatricians',
  NEUROLOGIST: 'Neurologist',
  GENERAL: 'General physician'
}

const RULES = [
  {
    specialty: SPECIALTY_IDS.GYNECOLOGIST,
    en: ['pregnancy', 'pregnant', 'women', 'woman', 'period', 'gynecology', 'gynecologist', 'birth', 'uterus', 'ovary'],
    ar: ['حمل', 'حامل', 'نساء', 'دورة', 'ولادة', 'رحم', 'مبيض', 'دكتورة نساء', 'نسا', 'نساء وتوليد']
  },
  {
    specialty: SPECIALTY_IDS.DERMATOLOGIST,
    en: ['skin', 'acne', 'rash', 'hair loss', 'hair', 'allergy', 'eczema', 'pimples', 'face problem', 'dermatolog'],
    ar: ['جلد', 'جلدية', 'حبوب', 'حب شباب', 'طفح', 'حساسية', 'اكزيما', 'أكزيما', 'شعر', 'تساقط', 'وش', 'بشرة', 'مشكلة جلد']
  },
  {
    specialty: SPECIALTY_IDS.PEDIATRICIANS,
    en: [
      'child',
      'children',
      'children doctor',
      "child's doctor",
      'baby',
      'kid',
      'newborn',
      'infant',
      'my son',
      'my daughter',
      'fever child',
      'pediatric',
      'pediatrician'
    ],
    ar: [
      'طفل',
      'اطفال',
      'أطفال',
      'ابني',
      'بنتي',
      'رضيع',
      'مولود',
      'سخونية الطفل',
      'حرارة الطفل',
      'دكتور أطفال',
      'دكتوره اطفال',
      'طبيب أطفال'
    ]
  },
  {
    specialty: SPECIALTY_IDS.NEUROLOGIST,
    en: ['headache', 'migraine', 'nerve', 'nerves', 'numbness', 'seizure', 'dizziness', 'brain', 'stroke', 'neurolog'],
    ar: ['صداع', 'شقيقة', 'أعصاب', 'اعصاب', 'تنميل', 'تشنج', 'دوخة', 'مخ', 'جلطة']
  },
  {
    specialty: SPECIALTY_IDS.GENERAL,
    en: ['fever', 'flu', 'cold', 'cough', 'pain', 'tired', 'checkup', 'stomach', 'sore throat', 'general'],
    ar: ['حرارة', 'سخونية', 'برد', 'كحة', 'كحه', 'ألم', 'تعب', 'كشف', 'مغص', 'زكام', 'التهاب حلق', 'سعال']
  }
]

const CHILD_CONTEXT = [
  'child',
  'children',
  'baby',
  'kid',
  'infant',
  'newborn',
  'my son',
  'my daughter',
  'طفل',
  'اطفال',
  'أطفال',
  'ابني',
  'بنتي',
  'رضيع',
  'مولود',
  'لطفل',
  'للطفل'
]

const FEVER_GENERAL = ['fever', 'flu', 'cold', 'cough', 'حرارة', 'سخونية', 'برد', 'كحة', 'زكام', 'التهاب حلق', 'سعال']

export const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')

export const getDoctorSpecialty = (doctor) =>
  doctor?.speciality || doctor?.specialty || doctor?.specialization || ''

export const detectLanguage = (message) => (/[\u0600-\u06FF]/.test(String(message || '')) ? 'ar' : 'en')

const containsAny = (text, keywords) => {
  const lower = normalizeText(text)
  const raw = String(text || '')
  return keywords.some((kw) => lower.includes(normalizeText(kw)) || raw.includes(kw))
}

export const hasChildContext = (message) => containsAny(message, CHILD_CONTEXT)

const scoreSpecialties = (message) => {
  const scores = {}
  for (const rule of RULES) {
    const enHits = rule.en.filter((kw) => containsAny(message, [kw])).length
    const arHits = rule.ar.filter((kw) => containsAny(message, [kw])).length
    const total = enHits + arHits
    if (total > 0) scores[rule.specialty] = total
  }
  return scores
}

/**
 * Main specialty detector — returns specialty, clarification flag, or null.
 */
export const detectSpecialtyFromMessage = (message) => {
  const text = String(message || '').trim()
  if (!text) return { specialty: null, needsClarification: null, scores: {} }

  const child = hasChildContext(text)
  const scores = scoreSpecialties(text)

  // Explicit child → pediatricians (even with fever)
  if (child) {
    return {
      specialty: SPECIALTY_IDS.PEDIATRICIANS,
      needsClarification: null,
      scores
    }
  }

  // Fever / cold without child → general physician (not pediatric)
  if (containsAny(text, FEVER_GENERAL) && !child) {
    scores[SPECIALTY_IDS.GENERAL] = (scores[SPECIALTY_IDS.GENERAL] || 0) + 3
    delete scores[SPECIALTY_IDS.PEDIATRICIANS]
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  if (!ranked.length) {
    return { specialty: null, needsClarification: null, scores }
  }

  const [top, second] = ranked
  if (
    second &&
    top[1] === second[1] &&
    [top[0], second[0]].includes(SPECIALTY_IDS.PEDIATRICIANS) &&
    [top[0], second[0]].includes(SPECIALTY_IDS.GENERAL)
  ) {
    return { specialty: null, needsClarification: 'adult_or_child', scores }
  }

  // Fever mentioned without child: ask adult vs child
  if (
    containsAny(text, FEVER_GENERAL) &&
    !child &&
    (scores[SPECIALTY_IDS.GENERAL] || 0) > 0 &&
    (scores[SPECIALTY_IDS.PEDIATRICIANS] || 0) > 0
  ) {
    return { specialty: null, needsClarification: 'adult_or_child', scores }
  }

  return { specialty: top[0], needsClarification: null, scores }
}

export const filterDoctorsBySpecialty = (doctors, specialty) => {
  const target = normalizeText(specialty)
  if (!target) return []
  return (doctors || []).filter((doctor) => normalizeText(getDoctorSpecialty(doctor)) === target)
}

export const getDoctorLocations = (doctor) =>
  (doctor?.locations || []).map((l) => String(l || '').trim()).filter(Boolean)

export const getDoctorPrimaryLocation = (doctor) => {
  const locs = getDoctorLocations(doctor)
  if (locs.length) return locs[0]
  const addr = doctor?.address
  if (typeof addr === 'string') return addr
  if (addr && typeof addr === 'object') {
    return [addr.line1, addr.line2].filter(Boolean).join(', ')
  }
  return ''
}

/** Quick-reply presets */
export const QUICK_SPECIALTY_PRESETS = [
  { id: 'skin', specialty: SPECIALTY_IDS.DERMATOLOGIST },
  { id: 'child', specialty: SPECIALTY_IDS.PEDIATRICIANS },
  { id: 'headache', specialty: SPECIALTY_IDS.NEUROLOGIST },
  { id: 'pregnancy', specialty: SPECIALTY_IDS.GYNECOLOGIST },
  { id: 'flu', specialty: SPECIALTY_IDS.GENERAL }
]
