/**
 * Symptom / complaint keywords → clinic speciality labels (match doctor.speciality in DB).
 * Covers English, Arabic, Egyptian dialect and Franco Arabic (Arabic typed in Latin letters).
 */
import { countTerms, containsArabicScript, hasAnyTerm, normalizeText, resolveReplyLanguage } from './chatbotText.js'
import { detectRedFlag } from './chatbotSafety.js'

const SPECIALTY_RULES = [
  {
    specialty: 'Pediatricians',
    terms: [
      'children doctor', "children's doctor", 'child doctor', "child's doctor", 'kids doctor', 'pediatric*', 'paediatric*',
      'طبيب اطفال', 'دكتور اطفال', 'دكتوره اطفال', 'عياده اطفال', 'طب اطفال', 'dr atfal', 'doctor atfal', 'doctora atfal', 'atfal'
    ]
  },
  {
    specialty: 'Dentist',
    terms: [
      'tooth', 'teeth', 'toothache', 'dental', 'dentist', 'gum', 'cavity', 'cavities', 'jaw pain', 'braces', 'wisdom tooth',
      'سن', 'سنان', 'اسنان', 'ضرس', 'ضروس', 'لثه', 'تسوس', 'حشو', 'تقويم', 'طقم اسنان', 'خلع ضرس', 'طبيب اسنان', 'دكتور اسنان',
      'ders', 'dersy', 'dersi', 'senan', 'asnan', 'sena', 'dars'
    ]
  },
  {
    specialty: 'Ophthalmologist',
    terms: [
      'eye', 'eyes', 'vision', 'blurry', 'blurred', 'sight', 'ophthalm*', 'glasses', 'cataract', 'glaucoma',
      'عين', 'عنيا', 'عينيا', 'عيون', 'نظر', 'رؤيه', 'نظاره', 'نضاره', 'ضعف نظر', 'احمرار العين', 'ميه بيضا', 'ميه زرقا', 'طبيب عيون', 'دكتور عيون',
      '3eny', '3eni', '3enaya', '3enya', '3oyoon', '3yoon', 'nazar'
    ]
  },
  {
    specialty: 'Cardiologist',
    terms: [
      'heart', 'cardiac', 'cardiolog*', 'palpitation', 'high blood pressure', 'blood pressure', 'hypertension',
      'قلب', 'قلبي', 'خفقان', 'دقات القلب', 'ضربات القلب', 'ضغط الدم', 'ضغط عالي', 'الضغط عالي', 'طبيب قلب', 'دكتور قلب',
      '2alb', '2alby', 'darabat 2alb'
    ]
  },
  {
    specialty: 'Dermatologist',
    terms: [
      'skin', 'rash', 'acne', 'eczema', 'itch', 'itchy', 'itching', 'dermat*', 'pimple', 'psoriasis', 'hair loss', 'mole', 'wart', 'skin allergy',
      'جلد', 'جلديه', 'طفح', 'حكه', 'هرش', 'بهرش', 'بثور', 'حبوب', 'حب شباب', 'اكزيما', 'حساسيه', 'بشره', 'تساقط الشعر', 'شعري بيقع', 'صدفيه', 'ثالول', 'دمل', 'طبيب جلد', 'دكتور جلد', 'دكتور جلديه',
      '7aka', '7asaseya', '7asasya', 'gild', 'geld', 'geldeya', 'gildeya', '7obob', 'bashra'
    ]
  },
  {
    specialty: 'Gynecologist',
    terms: [
      'pregnancy', 'pregnant', 'period', 'gynec*', 'gynaec*', 'obgyn', 'ob-gyn', 'menstrual', 'uterus', 'ovary', 'ovaries', 'women doctor', "women's doctor", 'womens doctor',
      'حمل', 'حامل', 'دوره', 'الدوره الشهريه', 'نساء', 'نسا', 'توليد', 'ولاده', 'رحم', 'مبيض', 'تكيس', 'نساء وتوليد', 'دكتوره نسا', 'دكتوره نساء', 'طبيب نساء', 'دكتور نسا',
      '7amel', '7aml', 'nesa', 'dawra', 'welada', 'wlada'
    ]
  },
  {
    specialty: 'Orthopedic',
    terms: [
      'bone', 'fracture', 'joint', 'knee', 'back pain', 'backache', 'lower back', 'my back', 'spine', 'orthop*', 'shoulder', 'ankle', 'sprain', 'slipped disc', 'neck pain', 'broken',
      'عظم', 'عظام', 'كسر', 'مفصل', 'مفاصل', 'ركبه', 'ضهري', 'ضهره', 'ضهرها', 'ظهري', 'ظهره', 'ظهرها', 'وجع ضهر', 'وجع في الضهر', 'الم ظهر', 'الم الظهر', 'الم في الظهر', 'عمود فقري', 'غضروف', 'كتف', 'رقبه', 'كاحل', 'التواء', 'انزلاق', 'طبيب عظام', 'دكتور عظام',
      '3azm', '3adm', 'rokba', 'dahry', 'dahri', 'dahr', 'ketf', 'ra2aba'
    ]
  },
  {
    specialty: 'Neurologist',
    terms: [
      'headache', 'migraine', 'seizure', 'epilepsy', 'numbness', 'numb', 'tingling', 'neurolog*', 'dizzy', 'dizziness', 'vertigo', 'nerve', 'tremor',
      'صداع', 'شقيقه', 'تنميل', 'اعصاب', 'دوخه', 'دايخ', 'دايخه', 'وجع راس', 'وجع دماغ', 'راسي بتوجعني', 'دماغي بتوجعني', 'راسي', 'دماغي', 'صرع', 'رعشه', 'طبيب اعصاب', 'دكتور اعصاب', 'دكتور مخ',
      'soda3', 'sodaa3', 'sudaa3', 'sada3', 'demaghy', 'demagh', 'dema8y', 'do5a', 'dokha', 'tanmeel', 'a3sab'
    ]
  },
  {
    specialty: 'Gastroenterologist',
    terms: [
      'stomach', 'tummy', 'belly', 'abdomen', 'abdominal', 'nausea', 'nauseous', 'vomit*', 'throwing up', 'diarrhea', 'diarrhoea', 'constipation', 'constipated', 'digest*', 'liver', 'heartburn', 'acid reflux', 'reflux', 'colon', 'gastro*', 'food poisoning', 'bloating',
      'معده', 'معدتي', 'بطن', 'مغص', 'غثيان', 'قيء', 'ترجيع', 'برجع', 'بترجع', 'اسهال', 'امساك', 'هضم', 'كبد', 'قولون', 'حموضه', 'انتفاخ', 'تسمم غذائي', 'جهاز هضمي', 'الجهاز الهضمي', 'طبيب باطنه', 'دكتور باطنه', 'باطنه',
      'batn', 'batny', 'batni', 'ma3da', 'ma3dety', 'ma3dti', 'ma8as', 'maghas', 'mo8s', 'es-hal', 'eshal', 'ershal', 'emsak', '2oloon', 'qoloon', '7umoda', '7omoda', 'targee3'
    ]
  },
  {
    specialty: 'Psychiatrist',
    terms: [
      'depression', 'depressed', 'anxiety', 'anxious', 'panic attack', 'psychiatr*', 'psycholog*', 'therapist', 'insomnia',
      'اكتئاب', 'مكتئب', 'مكتئبه', 'قلق', 'توتر', 'نوبه هلع', 'هلع', 'طب نفسي', 'دكتور نفسي', 'طبيب نفسي', 'دكتوره نفسيه', 'مش بعرف انام', 'ارق',
      'ekte2ab', '2ala2', 'tawator', 'doctor nafsy'
    ]
  },
  {
    specialty: 'General physician',
    general: true,
    terms: [
      'fever', 'feverish', 'flu', 'influenza', 'cold', 'cough', 'coughing', 'caught a cold', 'sore throat', 'throat', 'checkup', 'check-up', 'check up', 'chills', 'ear', 'earache', 'sinus', 'runny nose', 'urine', 'kidney', 'diabetes', 'general doctor', 'general physician', 'general practitioner', 'family doctor', 'gp',
      'حمي', 'سخونه', 'سخونيه', 'سخن', 'سخنه', 'حراره', 'برد', 'كحه', 'سعال', 'انفلونزا', 'زكام', 'رشح', 'زور', 'زوري', 'التهاب حلق', 'التهاب زور', 'كشف عام', 'دكتور عام', 'طبيب عام', 'طب عام', 'الطب العام', 'ودن', 'وداني', 'اذن', 'جيوب', 'بول', 'كلي', 'سكر',
      'so5ona', 'so5onia', 'so5onya', 'sokhona', 'sokhonia', 'sa5an', 'ka7a', 'kohha', 'zokam', 'zor', 'zoor', 'bard', 'wedn', 'ferver'
    ]
  }
]

const CHILD_TERMS = [
  'child', 'children', 'kid', 'kids', 'baby', 'babies', 'infant', 'newborn', 'toddler', 'my son', 'my daughter', 'my boy', 'my girl',
  'طفل', 'طفله', 'اطفال', 'رضيع', 'رضيعه', 'مولود', 'ابني', 'بنتي', 'ابنتي', 'ولدي', 'عيل', 'عيال', 'بيبي',
  'ebny', 'ebni', 'benty', 'binti', 'bent', 'tefl', 'tefla', 'atfal'
]

const VAGUE_TERMS = [
  'tired', 'exhausted', 'fatigue', 'fatigued', 'sleepy', 'weak', 'unwell', 'sick', 'not well', 'not feeling well', 'feel bad', 'feeling bad', 'ill',
  'تعب', 'تعبان', 'تعبانه', 'مريض', 'مريضه', 'ارهاق', 'مرهق', 'مرهقه', 'مش كويس', 'مش كويسه', 'مش مظبوط', 'لا اشعر بتحسن', 'حاسس بتعب', 'حاسه بتعب',
  'ta3ban', 'ta3bana', 'mesh kowayes', 'msh kowayes', 'mesh kwayes'
]

const UNLOCATED_PAIN_TERMS = [
  'pain', 'hurts', 'it hurts', 'ache', 'aches', 'sore',
  'الم', 'الام', 'وجع', 'واجعني', 'بيوجعني', 'بتوجعني', 'wag3', 'waga3', 'alam'
]

const NEGATION = /(?:don't want|do not want|dont want|not looking for|instead of|rather than|not|no|without|بلاش|مش عايز|مش عايزه|مش عاوز|مش عاوزه|مش محتاج|مش محتاجه|مش|مش عايزين|msh|mesh)\s+(?:(?:a|an|the|any|to see|see|see a|دكتور|دكتوره|طبيب|doctor|dr)\s+)*\S+/g

const dropNegatedWords = (norm) => norm.replace(NEGATION, ' ').replace(/\s+/g, ' ').trim()

const specialtyScores = (norm) =>
  SPECIALTY_RULES.map((rule) => ({
    specialty: rule.specialty,
    general: Boolean(rule.general),
    score: countTerms(norm, rule.terms)
  })).filter((row) => row.score > 0)

export const detectMessageLanguage = (text = '') => resolveReplyLanguage(text)

export const detectEmergency = (text = '') => Boolean(detectRedFlag(text))

export const hasChildContext = (text = '') => hasAnyTerm(normalizeText(text), CHILD_TERMS)

export const isVagueOnlyMessage = (text = '') => {
  const norm = normalizeText(text)
  if (!norm || norm.length > 40) return false
  if (specialtyScores(dropNegatedWords(norm)).length) return false
  return hasAnyTerm(norm, VAGUE_TERMS)
}

export const isUnlocatedPainMessage = (text = '') => {
  const norm = normalizeText(text)
  if (!norm || norm.length > 60) return false
  if (specialtyScores(dropNegatedWords(norm)).length) return false
  return hasAnyTerm(norm, UNLOCATED_PAIN_TERMS)
}

/** Every specialty the text points at, strongest first. Specialists rank above the general physician. */
export const rankSpecialtiesFromText = (text = '') => {
  const norm = dropNegatedWords(normalizeText(text))
  return specialtyScores(norm).sort((a, b) => Number(a.general) - Number(b.general) || b.score - a.score)
}

export const suggestSpecialtyFromText = (text = '') => {
  const [top] = rankSpecialtiesFromText(text)
  const child = hasChildContext(dropNegatedWords(normalizeText(text)))
  // A child with a toothache still needs the dentist. A child with a fever needs the pediatrician.
  if (child && (!top || top.general)) return 'Pediatricians'
  return top?.specialty || null
}

/** Two different specialists, equally likely: the person should choose rather than be guessed for. */
export const findAmbiguousSpecialties = (text = '') => {
  const ranked = rankSpecialtiesFromText(text).filter((row) => !row.general)
  if (ranked.length < 2 || ranked[0].score !== ranked[1].score) return []
  return ranked.filter((row) => row.score === ranked[0].score).slice(0, 3).map((row) => row.specialty)
}

/**
 * The latest message that names a specialty wins, so people can change their mind.
 * An earlier mention of a child still applies when the latest message is a general symptom.
 */
export const suggestSpecialtyFromConversation = (messages = []) => {
  const userTexts = messages.filter((m) => m.role === 'user').map((m) => String(m.content || ''))
  let latest = null
  for (let i = userTexts.length - 1; i >= 0 && !latest; i -= 1) {
    latest = suggestSpecialtyFromText(userTexts[i])
  }
  if (latest === 'General physician' && userTexts.some((text) => hasChildContext(text))) return 'Pediatricians'
  return latest
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

export const listKnownSpecialties = () => SPECIALTY_RULES.map((r) => r.specialty)

export const textHasArabic = containsArabicScript

// Back-compat alias
export const suggestSpecialtyFromSymptoms = suggestSpecialtyFromText
