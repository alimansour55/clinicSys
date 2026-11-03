import { hasAnyTerm, hasTerm, hasTermsNear, normalizeText } from './chatbotText.js'

/**
 * Safety rules for the assistant. These run on every message, before any booking logic
 * and before anything reaches OpenAI, so they hold with or without an API key.
 * A false alarm costs one tap on "continue". A miss could cost far more, so the red-flag
 * rules deliberately do not try to understand negation.
 */

export const EMERGENCY_NUMBER = '123'
export const MENTAL_HEALTH_CRISIS_NUMBER = '16328'

const CHEST_WORDS = ['chest', 'صدر', 'sedr', 'sedry', 'sedri', 'sadr', 'sadry', 'sadri']
const HEART_WORDS = ['قلب', '2alb', '2alby', 'alby']
const PAIN_WORDS_EN = ['pain', 'hurt', 'hurting', 'ache', 'aching', 'tight', 'tightness', 'pressure', 'crushing', 'heavy', 'heaviness', 'squeezing']
const PAIN_WORDS_AR = ['الم', 'الام', 'وجع', 'يوجع*', 'بيوجع*', 'بتوجع*', 'واجع*', 'وجعني', 'ضغط', 'كتمه', 'تقل', 'مطبق', 'مقبوض']
const PAIN_WORDS_FRANCO = ['wag3', 'waga3', 'wg3', 'beywga3', 'byewg3', 'bywg3ny', 'beywga3ny', 'alam', 'wag3ny']
const PAIN_WORDS = [...PAIN_WORDS_EN, ...PAIN_WORDS_AR, ...PAIN_WORDS_FRANCO]
const BLEEDING_WORDS = ['bleed', 'bleeding', 'blood']
const BLEEDING_SEVERE = ['severe', 'severely', 'heavy', 'heavily', 'profuse', 'profusely', 'lot', 'lots', "won't", 'wont', 'stop', 'stopping', 'badly', 'pouring', 'gushing']

const RED_FLAG_RULES = [
  {
    category: 'suicide',
    terms: [
      'suicide', 'suicidal', 'kill myself', 'killing myself', 'end my life', 'ending my life', 'take my own life',
      'want to die', 'wanna die', 'self harm', 'self-harm', 'hurt myself', 'harm myself', "don't want to live",
      'dont want to live', 'do not want to live', 'no reason to live', 'better off dead',
      'انتحار', 'انتحر', 'هنتحر', 'انتحاريه', 'اقتل نفسي', 'هقتل نفسي', 'اموت نفسي', 'هموت نفسي', 'عايز اموت', 'عايزه اموت',
      'عاوز اموت', 'عاوزه اموت', 'نفسي اموت', 'اريد ان اموت', 'اريد الموت', 'مش عايز اعيش', 'مش عايزه اعيش', 'مش عاوز اعيش',
      'مش عاوزه اعيش', 'انهي حياتي', 'اخلص من حياتي', 'اخلص علي نفسي', 'اذي نفسي', 'هاذي نفسي', 'اوذي نفسي', 'اجرح نفسي', 'مفيش سبب اعيش',
      'entehar', 'antehar', '3ayez amot', '3ayez amoot', 'ayez amot', '3ayza amot', 'ayza amot', 'a2tel nafsy', 'a2tel nafsi'
    ]
  },
  {
    category: 'cardiac',
    terms: ['heart attack', 'cardiac arrest', 'ازمه قلبيه', 'نوبه قلبيه', 'ذبحه صدريه', 'جلطه في القلب', 'جلطه قلب'],
    near: [
      [CHEST_WORDS, PAIN_WORDS],
      [HEART_WORDS, [...PAIN_WORDS_AR, ...PAIN_WORDS_FRANCO]],
      [['heart'], ['pain', 'hurt', 'hurting', 'hurts', 'stopped']]
    ]
  },
  {
    category: 'breathing',
    terms: [
      "can't breathe", 'cant breathe', 'cannot breathe', 'can not breathe', 'trouble breathing', 'difficulty breathing',
      'hard to breathe', 'struggling to breathe', 'short of breath', 'shortness of breath', 'not breathing', 'stopped breathing',
      'gasping', 'choking', 'turning blue',
      'مش قادر اتنفس', 'مش قادره اتنفس', 'مش عارف اتنفس', 'مش عارفه اتنفس', 'مش قادر اخد نفسي', 'مش عارف اخد نفسي',
      'مش لاقي نفسي', 'لا استطيع التنفس', 'صعوبه في التنفس', 'صعوبه تنفس', 'صعوبه التنفس', 'ضيق في التنفس', 'ضيق تنفس', 'ضيق نفس',
      'نفسي مقطوع', 'نفسه مقطوع', 'نفسها مقطوع', 'بتخنق', 'بيتخنق', 'بتتخنق', 'اختناق', 'مش بيتنفس', 'مش بتتنفس', 'مبيتنفسش',
      'مش قادر يتنفس', 'مش قادره تتنفس',
      'mesh 3aref atnafes', 'msh 3aref atnafes', 'mesh 2ader atnafes', 'msh 2ader atnafes', 'mesh 3arfa atnafes',
      'mesh 2adra atnafes', 'msh 2adra atnafes', 'deeq tanafos', 'di2 tanafos', 'mesh la2y nafasy', 'msh la2y nafasy'
    ]
  },
  {
    category: 'stroke',
    terms: [
      'stroke', 'face drooping', 'face droop', 'drooping face', 'slurred speech', 'sudden paralysis', 'paralysed', 'paralyzed',
      'one side of my body', 'one side of his body', 'one side of her body', 'sudden vision loss', 'worst headache of my life',
      'سكته', 'سكته دماغيه', 'جلطه', 'جلطه في المخ', 'جلطه في الدماغ', 'شلل', 'شلل مفاجي', 'اتشل', 'اتشلت', 'اتشلو', 'وشي مايل', 'وشه مايل',
      'وشها مايل', 'بقي مايل', 'بقه مايل', 'كلامي تقيل', 'كلامه تقيل', 'لساني تقيل', 'لسانه تقيل', 'مش عارف اتكلم فجاه', 'نص جسمي', 'نص جسمه',
      'نص جسمها', 'اسوا صداع', 'اقوي صداع',
      'galta', 'gal6a', 'sakta', 'saktah'
    ]
  },
  {
    category: 'bleeding',
    terms: [
      'coughing blood', 'coughing up blood', 'cough blood', 'vomiting blood', 'vomit blood', 'throwing up blood', 'hemorrhage', 'haemorrhage',
      'بينزف', 'بتنزف', 'بنزف', 'الدم مش راضي يقف', 'الدم مش بيقف', 'مش راضي يقف', 'بكح دم', 'بيكح دم', 'بتكح دم', 'برجع دم', 'بيرجع دم', 'بترجع دم',
      'ترجيع دم', 'كحه بدم', 'قيء دموي', 'nazeef', 'nazif', 'benzef', 'beynzef'
    ],
    test: (norm) => {
      const withoutPressure = norm.replace(/blood (pressure|test|tests|sugar|work)/g, ' ')
      if (hasTermsNear(withoutPressure, BLEEDING_WORDS, BLEEDING_SEVERE)) return true
      if (hasAnyTerm(norm, ['pregnant', 'pregnancy']) && hasAnyTerm(withoutPressure, BLEEDING_WORDS)) return true
      if (hasAnyTerm(norm, ['حامل', 'حمل']) && hasAnyTerm(norm, ['نزيف', 'دم'])) return true
      return hasTerm(norm, 'نزيف') && !hasAnyTerm(norm, ['لثه', 'سنان', 'اسنان', 'مناخير', 'انف'])
    }
  },
  {
    category: 'unconscious',
    terms: [
      'unconscious', 'passed out', 'fainted', 'not waking up', "won't wake up", 'wont wake up', 'unresponsive', 'having a seizure',
      'seizing', 'convulsion', 'convulsing',
      'فقد الوعي', 'فقدت الوعي', 'فقدان الوعي', 'مغمي عليه', 'مغمي عليها', 'اغمي عليه', 'اغمي عليها', 'اغمي عليا', 'مش بيفوق', 'مش بتفوق',
      'تشنجات', 'بيتشنج', 'بتتشنج', 'بتشنج'
    ]
  },
  {
    category: 'poisoning',
    terms: [
      'overdose', 'overdosed', 'poisoned', 'swallowed poison', 'took too many pills', 'too many pills', 'anaphylaxis', 'anaphylactic',
      'throat swelling', 'swollen throat', 'throat is closing', 'tongue swelling', 'swollen tongue',
      'جرعه زايده', 'شرب سم', 'شربت سم', 'بلعت حبوب', 'بلع حبوب', 'بلعت برشام', 'بلع برشام', 'زوري بيتقفل', 'زوري بيقفل', 'لساني ورم', 'ورم في الزور', 'تورم الزور', 'تورم اللسان'
    ]
  },
  {
    category: 'injury',
    terms: [
      'severe burn', 'bad burn', 'car accident', 'serious accident', 'head injury', 'hit my head hard', 'bone sticking out',
      'حادثه عربيه', 'حادثه سياره', 'عملت حادثه', 'حرق شديد', 'حروق شديده', 'خبطه جامده في الدماغ', 'خبطه شديده في الراس'
    ]
  }
]

/** Which red flag a message raises, or null. Screens the full text, before any trimming. */
export const detectRedFlag = (text = '') => {
  const norm = normalizeText(text)
  if (!norm) return null
  for (const rule of RED_FLAG_RULES) {
    const matched =
      hasAnyTerm(norm, rule.terms || []) ||
      (rule.near || []).some(([first, second]) => hasTermsNear(norm, first, second)) ||
      Boolean(rule.test?.(norm))
    if (matched) return { category: rule.category }
  }
  return null
}

/** The prominent advice shown instead of any booking step. Text comes from here, never from a model. */
export const buildEmergencyAdvice = (category = 'cardiac') => {
  if (category === 'suicide') {
    return {
      category,
      callNumber: EMERGENCY_NUMBER,
      crisisNumber: MENTAL_HEALTH_CRISIS_NUMBER,
      en: `I'm really glad you told me, and you deserve support right now. If you might act on these thoughts, call an ambulance on ${EMERGENCY_NUMBER} or go to the nearest emergency room now. You can also call the Ministry of Health's mental health line on ${MENTAL_HEALTH_CRISIS_NUMBER}, and please stay close to someone you trust.`,
      ar: `أنا مقدّر إنك قلتلي، وإنت تستاهل حد يقف جنبك دلوقتي. لو ممكن تأذي نفسك، اتصل بالإسعاف على ${EMERGENCY_NUMBER} أو روح أقرب طوارئ حالاً. وتقدر كمان تكلم خط الصحة النفسية بوزارة الصحة على ${MENTAL_HEALTH_CRISIS_NUMBER}، وخليك جنب حد بتثق فيه.`
    }
  }
  return {
    category,
    callNumber: EMERGENCY_NUMBER,
    crisisNumber: null,
    en: `This could be a medical emergency. Please call an ambulance on ${EMERGENCY_NUMBER} or go to the nearest emergency room now. Don't wait for a clinic appointment, and don't drive yourself if you can avoid it.`,
    ar: `ده ممكن يكون طارئ طبي. اتصل بالإسعاف على ${EMERGENCY_NUMBER} أو روح أقرب طوارئ حالاً. متستناش ميعاد عيادة، وبلاش تسوق بنفسك لو تقدر.`
  }
}

const MEDICAL_ADVICE_TERMS = [
  'what medicine', 'which medicine', 'what medication', 'which medication', 'what drug', 'what pill', 'what should i take', 'what can i take',
  'should i take', 'can i take', 'how much should i take', 'dose', 'dosage', 'prescribe', 'prescription', 'antibiotic', 'painkiller',
  'panadol', 'paracetamol', 'ibuprofen', 'aspirin', 'brufen', 'cataflam', 'home remedy', 'how do i treat', 'how to treat', 'how can i treat', 'treatment for', 'cure for',
  'diagnose', 'diagnosis', 'what do i have', 'what is wrong with me', "what's wrong with me", 'is it cancer', 'do i have cancer', 'do i have diabetes', 'do i have an infection',
  'جرعه', 'الجرعه', 'دوا', 'دواء', 'ادويه', 'علاج', 'اخد ايه', 'اخذ ايه', 'اشرب ايه', 'اخد دوا', 'مضاد حيوي', 'مسكن', 'روشته', 'وصفه طبيه', 'بنادول', 'باراسيتامول', 'بروفين', 'كتافلام', 'اسبرين',
  'شخصلي', 'شخصني', 'تشخيص', 'عندي ايه', 'معايا ايه', 'ده مرض ايه', 'هو سرطان', 'اعالج',
  'dawa', 'dawaa', '3elag', 'a5od eh', 'akhod eh', 'gor3a', 'moskn', 'mosaken'
]

/** Asks for a diagnosis, a medicine, a dose or a treatment, which the assistant does not give. */
export const isMedicalAdviceRequest = (text = '') => hasAnyTerm(normalizeText(text), MEDICAL_ADVICE_TERMS)

const INJECTION_TERMS = [
  'ignore previous', 'ignore all', 'ignore your', 'ignore the above', 'ignore prior', 'disregard', 'forget your instructions', 'forget previous',
  'system prompt', 'your prompt', 'your instructions', 'developer mode', 'jailbreak', 'you are now', 'pretend you are', 'pretend to be', 'act as', 'new instructions', 'dan mode',
  'تجاهل التعليمات', 'تجاهل كل', 'تجاهل الاوامر', 'انسي التعليمات', 'انسي كل', 'تعليماتك', 'البرومبت', 'برومبت النظام', 'انت دلوقتي', 'اتصرف كانك'
]
const PATIENT_DATA_TERMS = [
  'other patient', 'another patient', 'patient list', 'list of patients', 'all patients', "patients' data", 'patient data', 'patient records', 'patient phone', "someone else's", 'other users', 'another user', 'database', 'password', 'admin access', 'api key',
  'بيانات المرضي', 'بيانات مريض', 'مريض تاني', 'مرضي تانيين', 'المرضي التانيين', 'قايمه المرضي', 'قائمه المرضي', 'تليفون مريض', 'رقم مريض', 'قاعده البيانات', 'كلمه السر', 'الباسورد'
]
const PRICE_TAMPER_TERMS = [
  'change the price', 'change price', 'lower the price', 'set the price', 'make it free', 'for free', 'free appointment', 'free booking', '100% discount', 'give me a discount', 'apply a discount', 'without paying',
  'غير السعر', 'نزل السعر', 'خلي السعر', 'خليه ببلاش', 'خليها ببلاش', 'ببلاش', 'مجانا', 'من غير فلوس', 'خصم 100', 'اديني خصم', 'من غير ما ادفع'
]
const FORCED_BOOKING_TERMS = [
  'book without', 'without confirmation', 'without asking', 'skip confirmation', 'book for another', 'book for someone else using', 'احجز من غير تاكيد', 'من غير تاكيد', 'من غير ما تسال', 'من غير ما تسالني'
]

/** Attempts to steer the assistant away from its job. These never reach the model. */
export const detectManipulation = (text = '') => {
  const norm = normalizeText(text)
  if (hasAnyTerm(norm, PATIENT_DATA_TERMS)) return 'patient_data'
  if (hasAnyTerm(norm, PRICE_TAMPER_TERMS)) return 'price'
  if (hasAnyTerm(norm, FORCED_BOOKING_TERMS)) return 'forced_booking'
  if (hasAnyTerm(norm, INJECTION_TERMS)) return 'injection'
  return null
}

/** Removes identifiers before text leaves for OpenAI. Symptoms are all the model needs. */
export const scrubForModel = (text = '') =>
  String(text)
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/(?:\+?[\d٠-٩۰-۹][\s-]?){7,}/g, '[number]')
    .replace(/\b(my name is|i am called|i'm called|call me)\s+[^\s,.]+(\s+[^\s,.]+)?/gi, '$1 [name]')
    .replace(/(اسمي|إسمي|انا اسمي|أنا اسمي)\s+[^\s,،.]+(\s+[^\s,،.]+)?/g, '$1 [name]')

const UNSAFE_REPLY_PATTERNS = [
  // Doses, amounts and prices. The doctor card and the booking summary own every number.
  /\d/,
  /[٠-٩]/,
  /https?:|www\./i,
  /\b(mg|mcg|ml|tablets?|capsules?|pills?|dose|dosage|egp|pounds?|free of charge|discount)\b/i,
  /(جرعه|مجم|ملجم|قرص|اقراص|كبسوله|حبايه|جنيه|مجانا|ببلاش|خصم)/,
  // Medicines and instructions to self-treat.
  /\b(antibiotics?|paracetamol|panadol|ibuprofen|aspirin|brufen|painkillers?|you should take|take (?:a|an|some|this)(?! look)|prescri\w+)\b/i,
  /(مضاد حيوي|بنادول|باراسيتامول|بروفين|اسبرين|مسكن|خد دوا|خدي دوا|خد علاج|روشته)/,
  // Diagnosis stated as fact.
  /\b(you have|you(?:'re| are) suffering from|you(?:'ve| have) got|this is (?:a |an )?(?:infection|cancer|diabetes|migraine)|your diagnosis)\b/i,
  /(انت عندك|انتي عندك|عندك مرض|ده مرض|تشخيصك|مصاب ب)/,
  // Claims about bookings the model cannot make, and leaks of its setup.
  /\b(booked|i(?:'ve| have) scheduled|appointment is confirmed|system prompt|my instructions)\b/i,
  /(تم الحجز|حجزتلك|حجزت لك|تم تاكيد|تعليماتي)/
]

/** Model text only reaches a patient if it passes here. Anything doubtful falls back to the rules. */
export const isSafeModelReply = (reply = '') => {
  const raw = String(reply)
  const norm = normalizeText(raw)
  if (!norm || raw.length > 600) return false
  return !UNSAFE_REPLY_PATTERNS.some((pattern) => pattern.test(raw) || pattern.test(norm))
}
