import { suggestSpecialtyFromSymptoms } from './chatbotSymptomMap.js'

const GREETING_PATTERNS = [
  /^(hi|hello|hey|hola|good\s*(morning|afternoon|evening|night)|howdy|greetings)\b/i,
  /^(مرحبا|مرحباً|السلام|أهلا|اهلا|صباح|مساء|هاي)/,
  /^salam\b/i
]

export const isGreetingOnly = (text = '') => {
  const trimmed = String(text).trim()
  if (!trimmed || trimmed.length > 60) return false
  if (suggestSpecialtyFromSymptoms(trimmed)) return false
  if (/\b(pain|hurt|fever|cough|rash|ache|symptom|ألم|حمى|سعال|وجع)\b/i.test(trimmed)) return false
  return GREETING_PATTERNS.some((re) => re.test(trimmed))
}

export const hasHealthConcern = (text = '') => {
  const trimmed = String(text).trim()
  if (!trimmed) return false
  if (suggestSpecialtyFromSymptoms(trimmed)) return true
  if (trimmed.length >= 12) return true
  return /\b(pain|hurt|fever|cough|rash|ache|symptom|problem|sick|ill|cold|flu|injury|ألم|حمى|سعال|وجع|مرض|مريض|برد|إنفلونزا)\b/i.test(trimmed)
}

export const countUserTurns = (messages = []) =>
  messages.filter((m) => m.role === 'user').length

/** When to show doctor picker chips in the UI */
export const shouldOfferDoctorPicker = ({ userText, messages, suggestedDoctors }) => {
  if (!suggestedDoctors?.length) return false
  if (isGreetingOnly(userText)) return false
  if (hasHealthConcern(userText)) return true
  return countUserTurns(messages) >= 2
}

const specialtyLabelAr = {
  Dentist: 'طبيب أسنان',
  Ophthalmologist: 'طبيب عيون',
  Pediatricians: 'طبيب أطفال',
  Cardiologist: 'طبيب قلب',
  Dermatologist: 'طبيب جلدية',
  Gynecologist: 'طبيب نساء وتوليد',
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
  isFirstTurn = false
}) => {
  const ar = language === 'ar'

  if (isGreetingOnly(userText)) {
    return ar
      ? `مرحباً! أهلاً بك في ${siteName}. كيف يمكنني مساعدتك اليوم؟ من فضلك أخبرني عن الأعراض أو المشكلة الصحية التي تعاني منها، وسأقترح عليك التخصص والطبيب المناسب.`
      : `Hello! Welcome to ${siteName}. How can I help you today? Please tell me what symptoms or health concern you have, and I will suggest the right specialty and doctor for you.`
  }

  if (!hasHealthConcern(userText) && isFirstTurn) {
    return ar
      ? 'شكراً لتواصلك. من فضلك صف لي ما تشعر به (مثل: ألم، حمى، سعال) حتى أتمكن من مساعدتك في اختيار الطبيب المناسب.'
      : 'Thanks for reaching out. Please describe what you are feeling (for example: pain, fever, cough) so I can help you choose the right doctor.'
  }

  if (suggestedSpecialty) {
    const specAr = specialtyLabelAr[suggestedSpecialty] || suggestedSpecialty
    return ar
      ? `آسف لسماع ذلك، أتمنى لك الشفاء العاجل.\n\nبناءً على ما ذكرت، أنصحك بزيارة ${specAr}. يمكنك اختيار أحد الأطباء المتاحين أدناه ثم تحديد موعد يناسبك.\n\nالطبيب هو من يحدد التشخيص النهائي بعد الفحص.`
      : `I'm sorry to hear that — I hope you feel better soon.\n\nBased on what you shared, I recommend seeing a ${suggestedSpecialty}. You can choose one of the available doctors below, then pick a time that works for you.\n\nYour doctor will make the final decision after examining you.`
  }

  return ar
    ? 'شكراً لمشاركتك. سأساعدك في إيجاد طبيب مناسب — اختر من القائمة أدناه أو صف أعراضك بتفصيل أكثر.'
    : 'Thank you for sharing. I will help you find a suitable doctor — choose from the list below, or describe your symptoms in more detail.'
}
