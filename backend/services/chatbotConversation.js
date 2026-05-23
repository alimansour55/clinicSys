import {
  suggestSpecialtyFromText,
  suggestSpecialtyFromConversation,
  isVagueOnlyMessage
} from './chatbotSymptomMap.js'

const GREETING_PATTERNS = [
  /^(hi|hello|hey|hola|good\s*(morning|afternoon|evening|night)|howdy|greetings)\b/i,
  /^(مرحبا|مرحباً|السلام|أهلا|اهلا|صباح|مساء|هاي)/,
  /^salam\b/i
]

export const isGreetingOnly = (text = '') => {
  const trimmed = String(text).trim()
  if (!trimmed || trimmed.length > 60) return false
  if (suggestSpecialtyFromText(trimmed)) return false
  if (isVagueOnlyMessage(trimmed)) return false
  if (/\b(pain|hurt|fever|cough|rash|ache|symptom|ألم|حمى|سعال|وجع)\b/i.test(trimmed)) return false
  return GREETING_PATTERNS.some((re) => re.test(trimmed))
}

export const hasClearSymptoms = (messages = [], lastText = '') => {
  const combined = [
    ...messages.filter((m) => m.role === 'user').map((m) => m.content),
    lastText
  ].join(' ')

  if (suggestSpecialtyFromConversation(messages) || suggestSpecialtyFromText(lastText)) {
    return true
  }

  if (isVagueOnlyMessage(lastText) && !suggestSpecialtyFromConversation(messages)) {
    return false
  }

  return /\b(pain|hurt|fever|cough|rash|ache|symptom|problem|sick|ill|cold|flu|injury|child|baby|ألم|حمى|سعال|وجع|مرض|مريض|برد|طفل|أطفال)\b/i.test(
    combined
  )
}

export const needsMoreSymptomInfo = (messages = [], lastText = '') => {
  if (isGreetingOnly(lastText)) return false
  if (hasClearSymptoms(messages, lastText)) return false
  if (isVagueOnlyMessage(lastText)) return true
  const userTexts = messages.filter((m) => m.role === 'user').map((m) => String(m.content || '').trim())
  const last = userTexts[userTexts.length - 1] || lastText
  return last.length < 15 && userTexts.length <= 2
}

export const countUserTurns = (messages = []) => messages.filter((m) => m.role === 'user').length

/** When to show doctor picker chips in the UI */
export const shouldOfferDoctorPicker = ({ userText, messages, suggestedDoctors, bookingContext = {} }) => {
  if (!suggestedDoctors?.length) return false
  if (bookingContext?.docId) return false
  if (isGreetingOnly(userText)) return false
  if (needsMoreSymptomInfo(messages, userText)) return false
  if (!hasClearSymptoms(messages, userText)) return false
  return true
}

const specialtyLabelAr = {
  Dentist: 'طبيب أسنان',
  Ophthalmologist: 'طبيب عيون',
  Pediatricians: 'أطباء أطفال',
  Cardiologist: 'طبيب قلب',
  Dermatologist: 'طبيب جلدية',
  Gynecologist: 'طبيب / أخصائي نساء وتوليد',
  Orthopedic: 'طبيب عظام',
  Neurologist: 'طبيب أعصاب',
  Gastroenterologist: 'طبيب جهاز هضمي',
  'General physician': 'طبيب عام'
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
      ? `مرحباً! أهلاً بك في ${siteName}. كيف يمكنني مساعدتك اليوم؟ من فضلك أخبرني عن الأعراض أو المشكلة الصحية (مثل: حمى، ألم، سعال، أو أنك تبحث عن طبيب أطفال).`
      : `Hello! Welcome to ${siteName}. How can I help you today? Please tell me your symptoms or what kind of doctor you need (for example: fever, pain, cough, or a children's doctor).`
  }

  if (needsFollowUp || isVagueOnlyMessage(userText)) {
    return ar
      ? 'آسف أنك تشعر بتعب. هل يمكنك إخباري أكثر؟ مثلاً: منذ متى؟ هل لديك حمى، سعال، ألم، دوخة، أو صعوبة في النوم؟ هذا يساعدني في اختيار الطبيب المناسب.'
      : "I'm sorry you're feeling tired. Can you tell me more? For example: how long has it been, and do you have fever, cough, pain, dizziness, or trouble sleeping? That helps me choose the right doctor."
  }

  if (noDoctorsForSpecialty && suggestedSpecialty) {
    const specAr = specialtyLabelAr[suggestedSpecialty] || suggestedSpecialty
    return ar
      ? `عذراً، لا يوجد حالياً ${specAr} متاح للحجز. هل تريد البحث عن تخصص آخر أو صف مشكلتك بطريقة مختلفة؟`
      : `Sorry, there is no ${suggestedSpecialty} available to book right now. Would you like another specialty or to describe your issue differently?`
  }

  if (suggestedSpecialty) {
    const specAr = specialtyLabelAr[suggestedSpecialty] || suggestedSpecialty
    return ar
      ? `آسف لسماع ذلك، أتمنى لك الشفاء العاجل.\n\nبناءً على ما ذكرت، أنصحك بزيارة ${specAr}. اختر طبيباً من القائمة أدناه ثم حدّد الموعد المناسب.`
      : `I'm sorry to hear that — I hope you feel better soon.\n\nBased on what you shared, I recommend a ${suggestedSpecialty}. Choose a doctor from the list below, then pick a suitable time.`
  }

  if (!hasClearSymptoms([], userText) && isFirstTurn) {
    return ar
      ? 'شكراً لتواصلك. من فضلك صف أعراضك أو التخصص الذي تبحث عنه (مثل: طبيب أطفال، حمى، ألم أسنان).'
      : 'Thanks for reaching out. Please describe your symptoms or the type of doctor you need (for example: children’s doctor, fever, tooth pain).'
  }

  return ar
    ? 'شكراً. صف مشكلتك بتفصيل أكثر لأقترح الطبيب المناسب.'
    : 'Thank you. Please describe your concern in more detail so I can suggest the right doctor.'
}

// Back-compat
export const hasHealthConcern = (text = '') => hasClearSymptoms([], text)
