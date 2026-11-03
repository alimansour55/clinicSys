/*
 * Reads a plain-language doctor search in English or Egyptian/Modern Standard Arabic,
 * for example "skin rash in New Cairo under 500 tomorrow" or "دكتورة أطفال بالفيديو النهارده".
 * Runs in the browser, needs no service or API key, and only proposes filters the
 * catalogue can satisfy.
 */
import { detectSpecialtyFromMessage } from '../../utils/chatbotSpecialty'
import { HAS_ARABIC, normalizeSearchText, tokenMatches } from './searchText'

const phrases = (list) => list.map((item) => normalizeSearchText(item).split(' '))

const MODE_WORDS = {
  tele: phrases(['video call', 'video', 'videocall', 'online', 'telemedicine', 'فيديو', 'مكالمة فيديو', 'اونلاين', 'أون لاين']),
  home: phrases(['home visit', 'house call', 'at home', 'to my home', 'home', 'زيارة منزلية', 'في البيت', 'البيت', 'المنزل', 'منزلي', 'منزلية']),
  voice: phrases(['voice call', 'phone call', 'by phone', 'voice', 'phone', 'call', 'مكالمة صوتية', 'مكالمة', 'تليفون', 'هاتف', 'صوتي', 'صوتية']),
  clinic: phrases(['in person', 'clinic visit', 'at the clinic', 'في العيادة', 'العيادة', 'عيادة']),
}

const WHEN_WORDS = {
  today: phrases(['today', 'tonight', 'اليوم', 'النهارده', 'النهاردة', 'انهارده', 'الليلة']),
  tomorrow: phrases(['tomorrow', 'بكرة', 'بكره', 'بكرا', 'غدا', 'غداً']),
  week: phrases(['this week', 'within a week', 'next few days', 'هذا الأسبوع', 'الأسبوع ده', 'الاسبوع ده', 'خلال أسبوع']),
}

const SOONEST_WORDS = phrases(['as soon as possible', 'asap', 'soonest', 'earliest', 'urgent', 'أقرب موعد', 'في أسرع وقت', 'أسرع', 'أقرب', 'ضروري', 'مستعجل'])
const RATING_WORDS = phrases(['top rated', 'best rated', 'highest rated', 'best', 'الأعلى تقييما', 'أعلى تقييم', 'الأفضل', 'أفضل'])
const CHEAP_WORDS = phrases(['cheapest', 'lowest price', 'affordable', 'cheap', 'الأرخص', 'أرخص', 'رخيص'])

const GENDER_WORDS = {
  Female: phrases(['female doctor', 'woman doctor', 'lady doctor', 'female', 'دكتورة', 'طبيبة', 'دكتوره']),
  Male: phrases(['male doctor', 'man doctor', 'male', 'دكتور راجل', 'طبيب رجل', 'راجل']),
}

/* Speciality names and everyday words for them. Symptoms are handled by the chatbot's detector. */
const SPECIALITY_ALIASES = {
  dermatologist: ['dermatologist', 'dermatology', 'skin doctor', 'جلدية', 'الجلدية', 'دكتور جلدية', 'جلد'],
  gastroenterologist: ['gastroenterologist', 'gastroenterology', 'gastro', 'stomach', 'digestive', 'colon', 'باطنة', 'الجهاز الهضمي', 'هضمي', 'معدة', 'قولون'],
  'general physician': ['general physician', 'general practitioner', 'gp', 'family doctor', 'طب عام', 'الطب العام', 'ممارس عام'],
  gynecologist: ['gynecologist', 'gynaecologist', 'gynecology', 'obgyn', 'نساء وتوليد', 'النساء والتوليد', 'نسا'],
  neurologist: ['neurologist', 'neurology', 'أعصاب', 'مخ وأعصاب', 'طب الأعصاب'],
  pediatricians: ['pediatrician', 'pediatricians', 'paediatrician', 'pediatrics', 'kids doctor', 'أطفال', 'طب الأطفال', 'دكتور أطفال'],
  cardiologist: ['cardiologist', 'cardiology', 'heart doctor', 'قلب', 'أمراض القلب'],
  dentist: ['dentist', 'dental', 'أسنان', 'دكتور أسنان'],
  orthopedic: ['orthopedic', 'orthopaedic', 'bones', 'عظام'],
  psychiatrist: ['psychiatrist', 'psychiatry', 'نفسي', 'طب نفسي'],
}

const STOP_WORDS = new Set(
  normalizeSearchText(
    'i im need needs a an the for my me in at by on near with doctor doctors dr find book booking want looking someone who is to of and or please can get see visit appointment egp le pounds pound l.e. ' +
      'انا أنا عايز عايزة عاوز محتاج محتاجة اريد أريد ابحث عن دكتور طبيب في من مع على الى إلى او أو و حجز موعد ميعاد لو سمحت ممكن جنيه ج.م ج',
  ).split(' '),
)

const PRICE_NUMBER = /^(\d{2,6})(?:egp|le|ج)?$/
const PRICE_LEAD = phrases(['under', 'below', 'less than', 'max', 'up to', 'upto', 'within', 'budget', 'cheaper than', '<', '<=', 'أقل من', 'اقل من', 'تحت', 'لحد', 'حتى', 'بحد أقصى', 'ميزانية', 'في حدود'])

/**
 * @param {string} text the patient's words
 * @param {{ specialities: string[], areas: { key: string, labels: string[] }[] }} catalogue
 *   only what exists in the doctor list, so the parser never proposes an empty filter
 */
export function parseDoctorQuery(text, catalogue = {}) {
  const original = String(text || '').trim().split(/\s+/).filter(Boolean)
  const tokens = original.map(normalizeSearchText)
  const used = new Array(tokens.length).fill(false)
  const result = { spans: {} }

  /* Find a phrase as consecutive unused tokens. Returns [start, end) or null. */
  const findPhrase = (phrase) => {
    for (let i = 0; i + phrase.length <= tokens.length; i += 1) {
      let ok = true
      for (let j = 0; j < phrase.length; j += 1) {
        if (used[i + j] || !tokenMatches(tokens[i + j], phrase[j])) {
          ok = false
          break
        }
      }
      if (ok) return [i, i + phrase.length]
    }
    return null
  }

  const take = (dimension, value, range) => {
    for (let i = range[0]; i < range[1]; i += 1) used[i] = true
    result[dimension] = value
    result.spans[dimension] = [...(result.spans[dimension] || []), ...rangeIndexes(range)]
  }

  const firstMatch = (lists) => {
    for (const [value, list] of Object.entries(lists)) {
      for (const phrase of [...list].sort((a, b) => b.length - a.length)) {
        const range = findPhrase(phrase)
        if (range) return { value, range }
      }
    }
    return null
  }

  // Price: a lead word then a number, or a bare number followed by a currency word
  for (let i = 0; i < tokens.length && result.maxPrice == null; i += 1) {
    const number = tokens[i].match(PRICE_NUMBER)
    if (!number || used[i]) continue
    const lead = PRICE_LEAD.find((phrase) => phrase.every((word, j) => tokenMatches(tokens[i - phrase.length + j], word)))
    const currencyAfter = /^(egp|le|pounds?|جنيه|ج)$/.test(tokens[i + 1] || '')
    if (lead) take('maxPrice', Number(number[1]), [i - lead.length, i + 1])
    else if (currencyAfter) take('maxPrice', Number(number[1]), [i, i + 2])
  }

  const when = firstMatch(WHEN_WORDS)
  if (when) take('when', when.value, when.range)

  for (const [sort, list] of [['soonest', SOONEST_WORDS], ['rating', RATING_WORDS], ['price-asc', CHEAP_WORDS]]) {
    const hit = firstMatch({ [sort]: list })
    if (hit && !result.sort) take('sort', sort, hit.range)
  }

  const mode = firstMatch(MODE_WORDS)
  if (mode) take('mode', mode.value, mode.range)

  const gender = firstMatch(GENDER_WORDS)
  if (gender) take('gender', gender.value, gender.range)

  // Area: only places some doctor actually practises in
  for (const area of catalogue.areas || []) {
    const range = area.labels
      .map((label) => normalizeSearchText(label).split(' '))
      .sort((a, b) => b.length - a.length)
      .map(findPhrase)
      .find(Boolean)
    if (range) {
      take('area', area.key, range)
      break
    }
  }

  // Speciality by name or everyday word
  const available = new Map((catalogue.specialities || []).map((name) => [normalizeSearchText(name), name]))
  for (const [key, aliases] of Object.entries(SPECIALITY_ALIASES)) {
    const range = phrases(aliases).sort((a, b) => b.length - a.length).map(findPhrase).find(Boolean)
    if (!range) continue
    const match = available.get(key) || [...available.entries()].find(([name]) => name.startsWith(key.slice(0, 6)))?.[1]
    if (match) take('speciality', match, range)
    else take('missingSpeciality', key, range)
    break
  }

  // Symptoms ("rash", "حرارة الطفل") through the same rules the booking assistant uses
  if (!result.speciality && !result.missingSpeciality) {
    const rest = original.filter((_, i) => !used[i]).join(' ')
    const detected = detectSpecialtyFromMessage(rest)
    if (detected.needsClarification === 'adult_or_child') {
      result.clarify = 'adult_or_child'
    } else if (detected.specialty) {
      const match = available.get(normalizeSearchText(detected.specialty))
      if (match) {
        const symptomTokens = tokens
          .map((_, i) => i)
          .filter((i) => !used[i] && detectSpecialtyFromMessage(original[i]).specialty === detected.specialty)
        symptomTokens.forEach((i) => {
          used[i] = true
        })
        result.speciality = match
        result.specialityFromSymptom = true
        result.spans.speciality = symptomTokens
      }
    }
  }

  // Anything left becomes free text, minus filler words
  result.terms = tokens
    .map((token, i) => ({ token, i }))
    .filter(({ token, i }) => !used[i] && token && !STOP_WORDS.has(token) && (token.length > 1 || HAS_ARABIC.test(token)))
    .map(({ token }) => token)
  result.termSpans = tokens.map((_, i) => i).filter((i) => !used[i] && result.terms.includes(tokens[i]))
  result.words = original
  return result
}

const rangeIndexes = ([start, end]) => Array.from({ length: end - start }, (_, k) => start + k)

/** The query with the words behind one understood filter taken out. */
export const removeQueryPart = (parsed, dimension) => {
  const drop = new Set(dimension === 'terms' ? parsed.termSpans : parsed.spans[dimension] || [])
  return parsed.words.filter((_, i) => !drop.has(i)).join(' ')
}
