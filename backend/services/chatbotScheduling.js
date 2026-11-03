/**
 * Detect scheduling / availability questions and parse day and time references,
 * in English, Arabic, Egyptian dialect and Franco Arabic.
 */
import { hasAnyTerm, hasTerm, normalizeText } from './chatbotText.js'
import { getClinicTimeZone } from './clinicTimeService.js'

/** Same zone as booking, so the chatbot and the booking checks agree on "today" and "past". */
export const CLINIC_TIME_ZONE = getClinicTimeZone()

/**
 * The clinic's wall clock, as a Date whose local fields read as clinic time.
 * The server runs in UTC on Vercel, so `new Date()` is wrong for "today" around midnight in Cairo.
 */
export const clinicNow = (now = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: CLINIC_TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    })
      .formatToParts(now)
      .map((part) => [part.type, Number(part.value)])
  )
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
}

const TODAY_TERMS = ['today', 'tonight', 'اليوم', 'النهارده', 'النهاردا', 'انهارده', 'انهاردا', 'naharda', 'elnaharda', 'enaharda', 'el naharda']
const TOMORROW_TERMS = ['tomorrow', 'غدا', 'بكره', 'بكرا', 'bokra', 'bukra']
const AFTER_TOMORROW_TERMS = ['day after tomorrow', 'بعد غد', 'بعد غدا', 'بعد بكره', 'بعد بكرا', 'ba3d bokra', 'ba3d bukra']
const NEXT_WEEK_TERMS = ['next week', 'الاسبوع الجاي', 'الاسبوع القادم', 'الاسبوع اللي جاي', 'el esbo3 el gay']

const WEEKDAYS = [
  { day: 0, terms: ['sunday', 'الاحد', 'الحد', 'يوم حد', 'el7ad', 'el had', 'el 7ad'] },
  { day: 1, terms: ['monday', 'الاثنين', 'الاتنين', 'etnen', 'el etnen'] },
  { day: 2, terms: ['tuesday', 'الثلاثاء', 'التلات', 'الثلاث', 'التلاتاء', 'el talat'] },
  { day: 3, terms: ['wednesday', 'الاربعاء', 'الاربع', 'el arba3'] },
  { day: 4, terms: ['thursday', 'الخميس', 'el 5amis', 'el khamis'] },
  { day: 5, terms: ['friday', 'الجمعه', 'el gom3a'] },
  { day: 6, terms: ['saturday', 'السبت', 'el sabt'] }
]

const DAY_PARTS = [
  { part: 'evening', terms: ['evening', 'tonight', 'night', 'مساء', 'بالليل', 'بليل', 'الليل', 'المغرب', 'العشا', 'بعد المغرب', 'belleil', 'bel leil', 'bellel', 'bel lel', 'bleel'], from: 17 * 60, to: 24 * 60 },
  { part: 'afternoon', terms: ['afternoon', 'noon', 'بعد الظهر', 'بعد الضهر', 'الظهر', 'الضهر', 'العصر', 'ba3d el dohr', 'el dohr', 'el 3asr'], from: 12 * 60, to: 17 * 60 },
  { part: 'morning', terms: ['morning', 'الصبح', 'صباحا', 'الصباح', 'بدري', 'sob7', 'el sob7', 'elsob7', 'badry'], from: 0, to: 12 * 60 }
]

const SOONEST_TERMS = ['soonest', 'earliest', 'asap', 'as soon as possible', 'first available', 'right now', 'now', 'اقرب', 'اقرب ميعاد', 'اقرب معاد', 'اقرب وقت', 'اسرع', 'دلوقتي', 'حالا', 'delwa2ty', 'dlw2ty', 'a2rab']

const SCHEDULE_TERMS = [
  'available', 'availability', 'appointment', 'slot', 'what time', 'schedule', 'book', 'booking', 'another day', 'different day', 'specific day', 'this week',
  'موعد', 'مواعيد', 'ميعاد', 'معاد', 'متاح', 'متاحه', 'حجز', 'احجز', 'وقت', 'اوقات', 'امتي', 'يوم', 'تاريخ', 'الساعه',
  'me3ad', 'ma3ad', 'mia3ad', 'a7gez', '7agz', 'emta'
]

const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const addDays = (date, n) => {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return startOfDay(d)
}

const toSlotDateKey = (date) => `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`

const mentionsDay = (norm) =>
  hasAnyTerm(norm, [...TODAY_TERMS, ...TOMORROW_TERMS, ...AFTER_TOMORROW_TERMS, ...NEXT_WEEK_TERMS]) ||
  WEEKDAYS.some(({ terms }) => hasAnyTerm(norm, terms))

export const isSchedulingQuery = (text = '') => {
  const norm = normalizeText(text)
  if (!norm) return false
  return hasAnyTerm(norm, SCHEDULE_TERMS) || mentionsDay(norm) || Boolean(parseRequestedDayPart(text)) || Boolean(parseRequestedTime(text))
}

/** Resolve a calendar day the patient asked about, in clinic time. */
export const parseRequestedDay = (text = '', now = clinicNow()) => {
  const norm = normalizeText(text)
  const today = startOfDay(now)

  // Longest phrase first: "day after tomorrow" also contains "tomorrow".
  if (hasAnyTerm(norm, AFTER_TOMORROW_TERMS)) return addDays(today, 2)
  if (hasAnyTerm(norm, TOMORROW_TERMS)) return addDays(today, 1)
  if (hasAnyTerm(norm, TODAY_TERMS)) return today

  const numeric = norm.match(/(?:^|\s)(\d{1,2})\s*\/\s*(\d{1,2})(?:\s|$)/)
  if (numeric) {
    const day = Number(numeric[1])
    const month = Number(numeric[2])
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const candidate = new Date(today.getFullYear(), month - 1, day)
      if (candidate.getMonth() === month - 1) {
        return candidate < today ? new Date(today.getFullYear() + 1, month - 1, day) : candidate
      }
    }
  }

  const nextWeek = hasAnyTerm(norm, NEXT_WEEK_TERMS) || hasTerm(norm, 'next')
  for (const { day, terms } of WEEKDAYS) {
    if (hasAnyTerm(norm, terms)) {
      const diff = (day - today.getDay() + 7) % 7 || 7
      return addDays(today, nextWeek && diff < 7 ? diff + 7 : diff)
    }
  }

  return null
}

export const parseRequestedDayPart = (text = '') => {
  const norm = normalizeText(text)
  return DAY_PARTS.find(({ terms }) => hasAnyTerm(norm, terms))?.part || null
}

export const wantsSoonest = (text = '') => hasAnyTerm(normalizeText(text), SOONEST_TERMS)

const ARABIC_HOUR_WORDS = [
  ['واحده', 1], ['اتنين', 2], ['تلاته', 3], ['تلات', 3], ['اربعه', 4], ['اربع', 4], ['خمسه', 5], ['خمس', 5], ['سته', 6], ['ست', 6],
  ['سبعه', 7], ['سبع', 7], ['تمانيه', 8], ['تمنيه', 8], ['تمن', 8], ['تسعه', 9], ['تسع', 9], ['عشره', 10], ['عشر', 10],
  ['حداشر', 11], ['اتناشر', 12]
]

/**
 * A clock time such as "5:30", "5 pm", "الساعة 5 ونص" or "الساعة خمسة".
 * Returns minutes since midnight, or `candidates` when AM/PM is not stated.
 */
export const parseRequestedTime = (text = '') => {
  const norm = normalizeText(text)
  let hour = null
  let minute = 0
  let meridiem = null

  const clock = norm.match(/(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*(am|pm|ص|م|صباحا|مساء)?(?=\s|$)/)
  const hasClockCue = /(?::\d{2})|(?:am|pm)|الساعه|sa3a|(?:^|\s)at\s/.test(norm) || Boolean(clock?.[3])

  if (clock && hasClockCue && Number(clock[1]) >= 1 && Number(clock[1]) <= 23) {
    hour = Number(clock[1])
    minute = Number(clock[2] || 0)
    meridiem = clock[3] || null
  } else if (/الساعه/.test(norm)) {
    const word = ARABIC_HOUR_WORDS.find(([name]) => new RegExp(`الساعه\\s+${name}(?=\\s|$)`).test(norm))
    if (word) hour = word[1]
  }

  if (hour === null || minute > 59) return null
  if (/(?:^|\s)ونص(?=\s|$)/.test(norm)) minute = 30
  else if (/(?:^|\s)وربع(?=\s|$)/.test(norm)) minute = 15

  const part = parseRequestedDayPart(text)
  const isPm = ['pm', 'م', 'مساء'].includes(meridiem) || part === 'evening' || part === 'afternoon'
  const isAm = ['am', 'ص', 'صباحا'].includes(meridiem) || part === 'morning'

  if (hour > 12) return { minutes: hour * 60 + minute, candidates: [hour * 60 + minute] }
  const am = (hour % 12) * 60 + minute
  const pm = ((hour % 12) + 12) * 60 + minute
  if (isPm) return { minutes: pm, candidates: [pm] }
  if (isAm) return { minutes: am, candidates: [am] }
  return { minutes: null, candidates: [am, pm] }
}

const slotMinutes = (time = '') => {
  const match = String(time).match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i)
  if (!match) return null
  const hours = (Number(match[1]) % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0)
  return hours * 60 + Number(match[2])
}

export const slotInDayPart = (time, part) => {
  const range = DAY_PARTS.find((item) => item.part === part)
  const minutes = slotMinutes(time)
  if (!range || minutes === null) return true
  return minutes >= range.from && minutes < range.to
}

export const slotMatchesRequestedTime = (time, requested) =>
  Boolean(requested?.candidates?.includes(slotMinutes(time)))

/** The closest offered slot, for "any time near 5" when 5:00 itself has gone. */
export const nearestSlotDistance = (time, requested) => {
  const minutes = slotMinutes(time)
  if (minutes === null || !requested?.candidates?.length) return Infinity
  return Math.min(...requested.candidates.map((candidate) => Math.abs(candidate - minutes)))
}

export const filterSlotDaysForDate = (slotDays = [], targetDate) => {
  if (!targetDate) return slotDays
  const key = toSlotDateKey(targetDate)
  return slotDays.filter((day) => day.slotDate === key)
}

export const slotDateKey = toSlotDateKey

export const formatSlotDayReply = ({ language, doctorName, slotDays, requestedDate }) => {
  const ar = language === 'ar'
  if (!slotDays.length) {
    return ar
      ? `مفيش مواعيد متاحة مع ${doctorName} في اليوم ده. جرّب يوم تاني من القائمة تحت، أو اكتب "بكرة" أو أي يوم تاني.`
      : `No available times with ${doctorName} on that day. Try another day from the list below, or type "tomorrow" or another day.`
  }

  const dayLabel = requestedDate
    ? requestedDate.toLocaleDateString(ar ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    : ''

  if (ar) {
    return `دي المواعيد المتاحة مع ${doctorName}${dayLabel ? ` يوم ${dayLabel}` : ''}. اختار الوقت اللي يناسبك.`
  }

  return `Here are the available times with ${doctorName}${dayLabel ? ` on ${dayLabel}` : ''}. Tap the one that suits you.`
}
