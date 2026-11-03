/**
 * Slots are stored as clinic wall-clock text ("5_11_2026", "02:30 PM"). The server may run in UTC
 * (Vercel) and patients may browse from abroad, so every "is this in the past" check and every
 * calendar export must convert through the clinic's zone, not the process zone.
 */
const DEFAULT_CLINIC_TIME_ZONE = 'Africa/Cairo'

const isValidTimeZone = (zone) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export const getClinicTimeZone = () => {
  const configured = String(process.env.CLINIC_TIME_ZONE || '').trim()
  return configured && isValidTimeZone(configured) ? configured : DEFAULT_CLINIC_TIME_ZONE
}

const wallClockParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  }).formatToParts(date)
  const read = (type) => Number(parts.find((part) => part.type === type)?.value)
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second')
  }
}

const offsetMs = (date, timeZone) => {
  const p = wallClockParts(date, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000
}

/** Wall-clock time in the clinic zone to an absolute instant. Handles DST on either side of the guess. */
export const clinicWallTimeToDate = ({ year, month, day, minutes = 0 }, timeZone = getClinicTimeZone()) => {
  const guess = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60)
  const first = guess - offsetMs(new Date(guess), timeZone)
  const second = guess - offsetMs(new Date(first), timeZone)
  return new Date(second)
}

export const parseSlotMinutes = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()

  const direct = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (direct) return Number(direct[1]) * 60 + Number(direct[2])

  const match = trimmed.match(/^(\d{1,2}):([0-5]\d)\s*([AP]M)$/i)
  if (!match) return null

  let hours = Number(match[1])
  if (hours < 1 || hours > 12) return null
  const period = match[3].toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + Number(match[2])
}

export const minutesToSlotTime = (minutes) => {
  const hours24 = Math.floor(minutes / 60)
  const hours = String(hours24 % 12 || 12).padStart(2, '0')
  const mins = String(minutes % 60).padStart(2, '0')
  return `${hours}:${mins} ${hours24 >= 12 ? 'PM' : 'AM'}`
}

/** "10:00", "10:00 am" and "10:00 AM" are one slot. Returns the stored form, or '' when invalid. */
export const canonicalSlotTime = (value) => {
  const minutes = parseSlotMinutes(value)
  return minutes === null ? '' : minutesToSlotTime(minutes)
}

export const parseSlotDateParts = (value) => {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{1,2})_(\d{1,2})_(\d{4})$/)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  return { day, month, year }
}

/** "05_01_2026" and "5_1_2026" are one date. Returns the stored form, or '' when invalid. */
export const canonicalSlotDate = (value) => {
  const parts = parseSlotDateParts(value)
  return parts ? `${parts.day}_${parts.month}_${parts.year}` : ''
}

export const slotStartDate = (slotDate, slotTime, timeZone = getClinicTimeZone()) => {
  const parts = parseSlotDateParts(slotDate)
  const minutes = parseSlotMinutes(slotTime)
  if (!parts || minutes === null) return null
  return clinicWallTimeToDate({ ...parts, minutes }, timeZone)
}

export const slotDateToDateKey = (slotDate) => {
  const parts = parseSlotDateParts(slotDate)
  if (!parts) return ''
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

export const slotDateWeekday = (slotDate) => {
  const parts = parseSlotDateParts(slotDate)
  return parts ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay() : null
}

export const addDaysToSlotDate = (slotDate, days) => {
  const parts = parseSlotDateParts(slotDate)
  if (!parts) return ''
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return `${next.getUTCDate()}_${next.getUTCMonth() + 1}_${next.getUTCFullYear()}`
}

/** Today's slot date in the clinic zone. */
export const clinicTodaySlotDate = (now = new Date(), timeZone = getClinicTimeZone()) => {
  const p = wallClockParts(now, timeZone)
  return `${p.day}_${p.month}_${p.year}`
}
