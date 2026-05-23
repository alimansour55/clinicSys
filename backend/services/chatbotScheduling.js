/**
 * Detect scheduling / availability questions and parse day references.
 */

const SCHEDULE_PATTERNS = [
  /\b(available|availability|appointment|slot|time|schedule|book)\b/i,
  /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(next week|this week|another day|different day|specific day)\b/i,
  /(موعد|مواعيد|متاح|متاحة|availability|حجز|وقت|أوقات|غدا|غداً|بكرة|اليوم|يوم|تاريخ|السبت|الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة)/
]

export const isSchedulingQuery = (text = '') => {
  const t = String(text).trim()
  if (!t) return false
  return SCHEDULE_PATTERNS.some((re) => re.test(t))
}

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

const WEEKDAY_EN = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
}

const WEEKDAY_AR = {
  'الأحد': 0,
  'الاحد': 0,
  'الاثنين': 1,
  'الإثنين': 1,
  'الثلاثاء': 2,
  'الاربعاء': 3,
  'الأربعاء': 3,
  'الخميس': 4,
  'الجمعة': 5,
  'السبت': 6
}

/** Resolve a calendar day the patient asked about (local date). */
export const parseRequestedDay = (text = '') => {
  const raw = String(text).trim()
  const lower = raw.toLowerCase()
  const today = startOfDay(new Date())

  if (/\b(today|اليوم)\b/i.test(lower) || raw.includes('اليوم')) return today
  if (/\b(tomorrow|غدا|غداً|بكرة|بكره)\b/i.test(lower)) return addDays(today, 1)
  if (/\b(day after tomorrow)\b/i.test(lower) || /بعد غد|بعد غدا/.test(raw)) return addDays(today, 2)

  for (const [name, day] of Object.entries(WEEKDAY_EN)) {
    if (lower.includes(name)) {
      const diff = (day - today.getDay() + 7) % 7 || 7
      return addDays(today, diff === 7 && lower.includes('next') ? 7 : diff === 0 ? 7 : diff)
    }
  }

  for (const [name, day] of Object.entries(WEEKDAY_AR)) {
    if (raw.includes(name)) {
      const diff = (day - today.getDay() + 7) % 7 || 7
      return addDays(today, diff === 0 ? 7 : diff)
    }
  }

  return null
}

export const filterSlotDaysForDate = (slotDays = [], targetDate) => {
  if (!targetDate) return slotDays
  const target = startOfDay(targetDate).getTime()
  return slotDays.filter((day) => {
    const d = new Date(day.date)
    return startOfDay(d).getTime() === target
  })
}

export const formatSlotDayReply = ({ language, doctorName, slotDays, requestedDate }) => {
  const ar = language === 'ar'
  if (!slotDays.length) {
    return ar
      ? `لا توجد مواعيد متاحة مع ${doctorName} في هذا اليوم. جرّب يوماً آخر من القائمة أدناه أو اكتب "غداً" أو يوماً آخر.`
      : `No available times with ${doctorName} on that day. Try another day from the list below, or type "tomorrow" or another day.`
  }

  const lines = slotDays.flatMap((day) =>
    day.slots.map((s) => `• ${s.time}`)
  )

  const dayLabel = requestedDate
    ? requestedDate.toLocaleDateString(ar ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    : ''

  if (ar) {
    return `المواعيد المتاحة مع ${doctorName}${dayLabel ? ` يوم ${dayLabel}` : ''}:\n${lines.join('\n')}\n\nاضغط على الوقت المناسب أدناه لتأكيد الحجز.`
  }

  return `Available times with ${doctorName}${dayLabel ? ` on ${dayLabel}` : ''}:\n${lines.join('\n')}\n\nTap a time below to confirm booking.`
}
