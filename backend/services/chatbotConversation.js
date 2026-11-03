import {
  suggestSpecialtyFromText,
  suggestSpecialtyFromConversation,
  isUnlocatedPainMessage,
  isVagueOnlyMessage
} from './chatbotSymptomMap.js'
import { hasAnyTerm, normalizeText } from './chatbotText.js'

const GREETING_TERMS = [
  'hi', 'hello', 'hey', 'hola', 'howdy', 'greetings', 'salam', 'good morning', 'good afternoon', 'good evening', 'good night',
  'مرحبا', 'السلام', 'السلام عليكم', 'سلام', 'اهلا', 'صباح الخير', 'صباح النور', 'مساء الخير', 'مساء النور', 'هاي', 'هلا', 'ازيك', 'ازيكم', 'عامل ايه', 'عامله ايه', 'اخبارك',
  'ezayak', 'ezayek', '3amel eh', '3amla eh', 'ahlan', 'sabah el kheir', 'masa2 el kheir'
]

const GREETING_FILLERS = /^(hi|hello|hey|hola|howdy|greetings|salam|good|morning|afternoon|evening|night|there|مرحبا|السلام|عليكم|سلام|اهلا|وسهلا|صباح|مساء|الخير|النور|هاي|هلا|ازيك|ازيكم|عامل|عامله|ايه|اخبارك|يا|دكتور|ezayak|ezayek|3amel|3amla|eh|ahlan|sabah|masa2|el|kheir)$/

/** A hello and nothing else. "Hi, my tooth hurts" is not a greeting. */
export const isGreetingOnly = (text = '') => {
  const norm = normalizeText(text)
  if (!norm || norm.length > 60) return false
  if (!hasAnyTerm(norm, GREETING_TERMS)) return false
  return norm.split(' ').every((word) => GREETING_FILLERS.test(word))
}

export const hasClearSymptoms = (messages = [], lastText = '') =>
  Boolean(suggestSpecialtyFromText(lastText) || suggestSpecialtyFromConversation(messages))

export const needsMoreSymptomInfo = (messages = [], lastText = '') => {
  if (isGreetingOnly(lastText)) return false
  if (hasClearSymptoms(messages, lastText)) return false
  return isVagueOnlyMessage(lastText) || isUnlocatedPainMessage(lastText)
}

export const countUserTurns = (messages = []) => messages.filter((m) => m.role === 'user').length

/** When to show doctor picker chips in the UI */
export const shouldOfferDoctorPicker = ({ userText, messages, suggestedDoctors, bookingContext = {} }) => {
  if (!suggestedDoctors?.length) return false
  if (bookingContext?.docId) return false
  if (isGreetingOnly(userText)) return false
  if (needsMoreSymptomInfo(messages, userText)) return false
  return hasClearSymptoms(messages, userText)
}

const INTENT_RULES = [
  {
    intent: 'my_appointments',
    terms: [
      'my appointment', 'my booking', 'my reservation', 'cancel my', 'cancel appointment', 'cancel the appointment', 'cancel booking', 'cancel the booking', 'reschedule my',
      'حجوزاتي', 'مواعيدي', 'حجزي', 'الغي الحجز', 'الغي حجزي', 'الغاء الحجز', 'الغي الميعاد', 'الغي ميعادي', 'الغي المعاد', 'الغي معادي', 'اغير ميعادي', 'اغير معادي', 'ميعادي امتي', 'معادي امتي',
      'mawa3edy', '7agzy', 'hagzy'
    ]
  },
  {
    intent: 'restart',
    terms: ['start over', 'start again', 'restart', 'reset', 'from the beginning', 'ابدا من جديد', 'نبدا من جديد', 'البدء من جديد', 'من الاول', 'من اول وجديد', 'نبدا تاني', 'ابدا تاني', 'nebda2 men el awel', 'men el awel']
  },
  {
    intent: 'decline',
    terms: [
      'changed my mind', 'change my mind', 'never mind', 'nevermind', 'forget it', 'cancel', "don't want to book", 'dont want to book', 'not now', 'no thanks', 'no thank you',
      'غيرت رايي', 'خلاص مش عايز', 'خلاص مش عايزه', 'مش عايز احجز', 'مش عايزه احجز', 'مش عاوز احجز', 'مش عاوزه احجز', 'بلاش', 'لا خلاص', 'خلاص بلاش', 'الغي', 'مش دلوقتي', 'لا شكرا',
      'ghayart ra2yi', 'la khalas', 'la 5alas', 'mesh 3ayez a7gez', 'msh 3ayez a7gez', 'balash'
    ]
  },
  {
    intent: 'change_doctor',
    terms: [
      'another doctor', 'different doctor', 'other doctor', 'other doctors', 'change doctor', 'change the doctor', 'someone else',
      'دكتور تاني', 'دكتوره تانيه', 'طبيب اخر', 'دكتور غيره', 'دكتور اخر', 'غير الدكتور', 'اغير الدكتور', 'غيري الدكتور', 'دكاتره تانيين',
      'doctor tany', 'doctor tani', 'dr tany'
    ]
  },
  {
    intent: 'change_time',
    terms: [
      'another time', 'different time', 'another day', 'different day', 'another date', 'different date', 'change time', 'change the time', 'change date', 'change the date', 'other times', 'other days',
      'ميعاد تاني', 'معاد تاني', 'وقت تاني', 'يوم تاني', 'غير الميعاد', 'غير المعاد', 'غير الوقت', 'غير اليوم', 'اغير الميعاد', 'اغير المعاد', 'اغير الوقت', 'اغير اليوم', 'مواعيد تانيه',
      'me3ad tany', 'ma3ad tany', 'yom tany', 'wa2t tany'
    ]
  },
  { intent: 'back', terms: ['go back', 'back', 'previous step', 'رجوع', 'ارجع', 'رجعني', 'الخطوه اللي فاتت', 'الخطوه السابقه', 'erga3'] },
  {
    intent: 'identity',
    terms: ['are you a doctor', 'are you human', 'are you a human', 'are you a bot', 'are you real', 'who are you', 'what are you', 'what can you do', 'انت دكتور', 'انتي دكتوره', 'انت بني ادم', 'انت بوت', 'انت روبوت', 'انت مين', 'انتي مين', 'بتعمل ايه', 'تقدر تعمل ايه', 'enta meen', 'enty meen', 'enta doctor']
  },
  { intent: 'human', terms: ['talk to a human', 'talk to someone', 'real person', 'customer service', 'customer support', 'reception', 'contact the clinic', 'اكلم حد', 'عايز اكلم حد', 'بني ادم', 'خدمه العملاء', 'الاستقبال', 'رقم العياده', 'اكلم العياده'] },
  { intent: 'price', terms: ['how much', 'price', 'prices', 'cost', 'costs', 'fee', 'fees', 'بكام', 'سعر', 'اسعار', 'تكلفه', 'كام الكشف', 'الكشف كام', 'الكشف بكام', 'ثمن', 'be kam', 'bekam', 'b kam', 'se3r'] },
  { intent: 'location', terms: ['where is', 'where are', 'address', 'location', 'branch', 'branches', 'فين العياده', 'فين العيادات', 'عنوان', 'العنوان', 'فروع', 'فرع', 'موقع العياده', 'fen el 3yada', 'feen el 3eyada', '3enwan'] },
  { intent: 'thanks', terms: ['thanks', 'thank you', 'thx', 'شكرا', 'متشكر', 'متشكره', 'تسلم', 'تسلمي', 'الف شكر', 'shokran', 'mashkoor', 'teslam'] }
]

const AFFIRM = /^(yes|yeah|yep|yup|ok|okay|sure|confirm|confirmed|correct|right|please do|go ahead|book it|yes please|yes confirm|ok confirm|اه|ايوه|ايوا|ايو|اي|نعم|تمام|موافق|موافقه|ماشي|اوك|اكد|تاكيد|اكد الحجز|احجز|احجزلي|احجز لي|اه احجز|ايوه احجز|تمام احجز|اه تمام|ايوه تمام|اكيد|طيب|ah|aywa|aiwa|tamam|mashy|mashi|akked|a7gez|ah tamam|aywa tamam)$/
const NEGATIVE = /^(no|nope|nah|not really|لا|لاء|لأ|لا لا|لا مش|مش كده|la|la2|laa)$/

/** Exact short replies only, so a sentence can never be read as consent to book. */
export const isAffirmation = (text = '') => AFFIRM.test(normalizeText(text))
export const isNegative = (text = '') => NEGATIVE.test(normalizeText(text))

export const detectIntent = (text = '') => {
  const norm = normalizeText(text)
  if (!norm) return null
  if (isAffirmation(text)) return 'affirm'
  if (isNegative(text)) return 'negative'
  return INTENT_RULES.find(({ terms }) => hasAnyTerm(norm, terms))?.intent || null
}

const CHEAPEST_TERMS = ['cheapest', 'lowest price', 'affordable', 'least expensive', 'ارخص', 'الارخص', 'اقل سعر', 'ار5as', 'ar5as', 'arkhas']
const BEST_RATED_TERMS = ['best', 'top rated', 'highest rated', 'best rated', 'احسن', 'افضل', 'شاطر', 'الاحسن', 'a7san', 'ahsan']

export const parseDoctorPreference = (text = '') => {
  const norm = normalizeText(text)
  if (hasAnyTerm(norm, CHEAPEST_TERMS)) return 'cheapest'
  if (hasAnyTerm(norm, BEST_RATED_TERMS)) return 'best_rated'
  return null
}

const VISIT_TYPE_RULES = [
  { type: 'Home Visit', terms: ['home visit', 'at home', 'to my home', 'come to my house', 'زياره منزليه', 'كشف منزلي', 'في البيت', 'في المنزل', 'للبيت', 'ييجي البيت', 'fel beit', 'fe el beit'] },
  { type: 'Video Call', terms: ['video', 'video call', 'فيديو', 'مكالمه فيديو', 'كشف اونلاين', 'اونلاين', 'online'] },
  { type: 'Voice Call', terms: ['voice call', 'phone call', 'by phone', 'مكالمه صوت', 'مكالمه صوتيه', 'مكالمه تليفون', 'تليفون', 'بالتليفون'] }
]

export const parseVisitType = (text = '') => {
  const norm = normalizeText(text)
  return VISIT_TYPE_RULES.find(({ terms }) => hasAnyTerm(norm, terms))?.type || null
}

export const specialtyLabels = {
  Dentist: { en: 'dentist', ar: 'دكتور أسنان', section: 'طب الأسنان' },
  Ophthalmologist: { en: 'ophthalmologist (eye doctor)', ar: 'دكتور عيون', section: 'العيون' },
  Pediatricians: { en: 'pediatrician', ar: 'دكتور أطفال', section: 'طب الأطفال' },
  Cardiologist: { en: 'cardiologist', ar: 'دكتور قلب', section: 'أمراض القلب' },
  Dermatologist: { en: 'dermatologist', ar: 'دكتور جلدية', section: 'الجلدية' },
  Gynecologist: { en: 'gynecologist', ar: 'دكتورة نسا وتوليد', section: 'النساء والتوليد' },
  Orthopedic: { en: 'orthopedic doctor', ar: 'دكتور عظام', section: 'العظام' },
  Neurologist: { en: 'neurologist', ar: 'دكتور مخ وأعصاب', section: 'طب الأعصاب' },
  Gastroenterologist: { en: 'gastroenterologist', ar: 'دكتور جهاز هضمي', section: 'الجهاز الهضمي' },
  Psychiatrist: { en: 'psychiatrist', ar: 'دكتور نفسي', section: 'الطب النفسي' },
  'General physician': { en: 'general physician', ar: 'دكتور طب عام', section: 'الطب العام' }
}

const labelFor = (specialty, language) =>
  specialtyLabels[specialty]?.[language === 'ar' ? 'ar' : 'en'] || specialty

/** Tappable answers to "where does it hurt?". Each one sends its text as the next message. */
export const PAIN_LOCATION_OPTIONS = [
  { id: 'head', en: 'Headache', ar: 'صداع' },
  { id: 'stomach', en: 'Stomach', ar: 'بطني' },
  { id: 'tooth', en: 'Tooth', ar: 'ضرسي' },
  { id: 'back', en: 'Back or joints', ar: 'ضهري أو مفاصلي' },
  { id: 'throat', en: 'Throat or ear', ar: 'زوري أو وداني' },
  { id: 'skin', en: 'Skin', ar: 'جلدي' }
]

export const buildMedicalAdviceReply = ({ language = 'en', suggestedSpecialty = null }) => {
  const ar = language === 'ar'
  const refusal = ar
    ? 'أنا مساعد حجز مش دكتور، فمقدرش أشخّص أو أوصف علاج أو أقولك جرعة. الكلام ده لازم يكون مع دكتور بعد ما يكشف عليك.'
    : "I'm a booking assistant, not a doctor, so I can't diagnose, prescribe, or advise on treatment or doses. That has to come from a doctor who has examined you."
  if (suggestedSpecialty) {
    return ar
      ? `${refusal}\n\nأقدر أحجزلك مع ${labelFor(suggestedSpecialty, language)}، ودول الدكاترة المتاحين.`
      : `${refusal}\n\nI can book you with a ${labelFor(suggestedSpecialty, language)}. Here is who's available.`
  }
  return ar
    ? `${refusal}\n\nقولي بتشتكي من إيه وأنا أوصلك للتخصص المناسب وأحجزلك.`
    : `${refusal}\n\nTell me what's bothering you and I'll find the right specialty and book it for you.`
}

export const buildManipulationReply = ({ language = 'en', kind = 'injection' }) => {
  const ar = language === 'ar'
  if (kind === 'patient_data') {
    return ar
      ? 'مقدرش أوصل لبيانات أي مريض، ولا بياناتك إنت حتى. شغلي إني أساعدك تلاقي التخصص وتحجز ميعاد.'
      : "I can't access anyone's patient information. My job is to help you find a specialty and book an appointment."
  }
  if (kind === 'price') {
    return ar
      ? 'الأسعار بتحددها العيادة ومقدرش أغيرها. هتشوف السعر النهائي قبل ما تأكد الحجز.'
      : "Prices are set by the clinic and I can't change them. You'll see the final price before you confirm."
  }
  if (kind === 'forced_booking') {
    return ar
      ? 'مفيش حجز بيتم غير لما إنت بنفسك تأكده بعد ما تشوف كل التفاصيل. قولي بتشتكي من إيه ونبدأ.'
      : "A booking only happens once you've seen the details and confirmed it yourself. Tell me what's bothering you and we'll start."
  }
  return ar
    ? 'أنا هنا عشان أساعدك تلاقي التخصص المناسب وتحجز ميعاد بس. قولي بتشتكي من إيه؟'
    : "I'm only here to help you find the right specialty and book an appointment. What's bothering you?"
}

export const buildIntentReply = ({ intent, language = 'en', siteName = 'Clinivo', hasDoctor = false }) => {
  const ar = language === 'ar'
  switch (intent) {
    case 'identity':
      return ar
        ? `أنا مساعد الحجز في ${siteName}. مش دكتور ومش بشخّص، بس بفهم شكوتك بالعربي أو الإنجليزي، أوصلك للتخصص المناسب، وأحجزلك ميعاد في كام رسالة.`
        : `I'm ${siteName}'s booking assistant. I'm not a doctor and I don't diagnose, but I can understand what's bothering you, point you to the right specialty, and book an appointment in a few messages.`
    case 'human':
      return ar
        ? 'أكيد. بيانات التواصل مع العيادة موجودة في صفحة "اتصل بنا".'
        : 'Of course. You can reach the clinic from the Contact page.'
    case 'price':
      return ar
        ? hasDoctor
          ? 'هتشوف السعر بالظبط في ملخص الحجز قبل ما تأكد.'
          : 'سعر الكشف مكتوب على كارت كل دكتور، وهتشوف الإجمالي قبل ما تأكد. قولي محتاج أي تخصص وأوريك.'
        : hasDoctor
          ? "You'll see the exact price in the booking summary before you confirm."
          : "Each doctor's fee is on their card, and you'll see the total before you confirm. Tell me which specialty you need and I'll show you."
    case 'location':
      return ar
        ? 'عنوان كل دكتور مكتوب على الكارت بتاعه. قولي محتاج أي تخصص وأوريك الأقرب ليك.'
        : "Each doctor's location is on their card. Tell me which specialty you need and I'll show you."
    case 'thanks':
      return ar ? 'العفو، ألف سلامة عليك. لو احتجت أي حاجة تانية أنا هنا.' : "You're welcome, and I hope you feel better soon. I'm here if you need anything else."
    case 'my_appointments':
      return ar
        ? 'حجوزاتك كلها في صفحة "مواعيدي"، ومنها تقدر تلغي أو تعدّل.'
        : 'All your bookings are on the My Appointments page, where you can also cancel or change them.'
    case 'decline':
      return ar
        ? 'ولا يهمك، محدش حجز حاجة. لو غيرت رأيك أنا موجود.'
        : "No problem, nothing has been booked. I'm here if you change your mind."
    default:
      return ''
  }
}

export const buildRuleBasedReply = ({
  language = 'en',
  userText = '',
  suggestedSpecialty = null,
  siteName = 'Clinivo',
  isFirstTurn = false,
  needsFollowUp = false,
  noDoctorsForSpecialty = false
}) => {
  const ar = language === 'ar'

  if (isGreetingOnly(userText)) {
    return ar
      ? `أهلاً بيك في ${siteName}! أقدر أساعدك إزاي النهارده؟ قولي بتشتكي من إيه أو محتاج دكتور إيه، زي: "ابني عنده سخونية" أو "عايز دكتور أسنان بكرة".`
      : `Hello! Welcome to ${siteName}. How can I help you today? Tell me what's bothering you or which doctor you need, like "my son has a fever" or "a dentist tomorrow evening".`
  }

  if (noDoctorsForSpecialty && suggestedSpecialty) {
    return ar
      ? `للأسف مفيش ${labelFor(suggestedSpecialty, language)} متاح للحجز دلوقتي. تقدر تختار تخصص تاني، أو تبدأ بدكتور طب عام يقيّم الحالة.`
      : `Sorry, there's no ${labelFor(suggestedSpecialty, language)} available to book right now. You can pick another specialty, or start with a general physician for an initial evaluation.`
  }

  if (isUnlocatedPainMessage(userText)) {
    return ar
      ? 'ألف سلامة عليك. الوجع ده فين بالظبط؟ كده أقدر أوصلك للدكتور المناسب.'
      : "I'm sorry you're in pain. Where exactly does it hurt? That tells me which doctor to find you."
  }

  if (needsFollowUp || isVagueOnlyMessage(userText)) {
    return ar
      ? 'ألف سلامة عليك. احكيلي أكتر شوية: من إمتى وإيه اللي حاسس بيه؟ عندك سخونية، كحة، وجع في مكان معين، أو دوخة؟'
      : "I'm sorry you're not feeling well. Can you tell me a bit more? How long has it been, and do you have a fever, a cough, pain somewhere, or dizziness?"
  }

  if (suggestedSpecialty) {
    return ar
      ? `ألف سلامة عليك.\n\nالأنسب في الحالة دي ${labelFor(suggestedSpecialty, language)}، وهو اللي يقدر يقيّم حالتك بعد الكشف. دول الدكاترة المتاحين، اختار دكتور أو ميعاد على طول.`
      : `I'm sorry to hear that, and I hope you feel better soon.\n\nA ${labelFor(suggestedSpecialty, language)} is the right place to start, and they'll assess you properly. Here's who's available. Choose a doctor or tap a time.`
  }

  if (isFirstTurn) {
    return ar
      ? 'معلش مفهمتش قصدك. ممكن تقولي بتشتكي من إيه؟ زي: "وجع في ضرسي" أو "عايز دكتور جلدية".'
      : 'Sorry, I didn\'t quite catch that. Could you tell me what\'s bothering you? For example: "my tooth hurts" or "I need a skin doctor".'
  }

  return ar
    ? 'معلش مفهمتش. احكيلي بكلامك إيه اللي تاعبك، أو اختار قسم من الأقسام تحت.'
    : "Sorry, I didn't get that. Tell me in your own words what's bothering you, or pick a clinic section below."
}

/** Both languages for one rule-based reply, so the conversation can follow the language toggle. */
export const inBothLanguages = (build) => ({ en: build('en'), ar: build('ar') })

// Back-compat
export const hasHealthConcern = (text = '') => hasClearSymptoms([], text)
