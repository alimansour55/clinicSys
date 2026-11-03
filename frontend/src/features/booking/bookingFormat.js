export const CLINIC_TIME_ZONE = 'Africa/Cairo'

export const fill = (text, vars = {}) =>
  Object.entries(vars).reduce((out, [key, value]) => out.split(`{{${key}}}`).join(String(value)), String(text))

const locale = (language) => (language === 'ar' ? 'ar-EG' : 'en-GB')

/** "02:30 PM" as people read it in each language. Slot text itself never changes. */
export const formatSlotTime = (slotTime, language, localizeDigits = (value) => value) => {
  const text = String(slotTime || '').trim().replace(/^0(\d:)/, '$1')
  if (language !== 'ar') return text
  return localizeDigits(text.replace(/\s*AM$/i, ' ص').replace(/\s*PM$/i, ' م'))
}

export const dayPart = (minutes) => {
  if (minutes < 12 * 60) return 'morning'
  if (minutes < 17 * 60) return 'afternoon'
  return 'evening'
}

export const groupSlotsByPart = (slots = []) => {
  const groups = { morning: [], afternoon: [], evening: [] }
  slots.forEach((slot) => groups[dayPart(slot.minutes)].push(slot))
  return ['morning', 'afternoon', 'evening']
    .map((part) => ({ part, slots: groups[part] }))
    .filter((group) => group.slots.length > 0)
}

/** The date a clinic-time instant falls on, in the clinic's zone. */
const clinicDayNumber = (timestamp, timeZone = CLINIC_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(timestamp))
  const read = (type) => Number(parts.find((part) => part.type === type)?.value)
  return Date.UTC(read('year'), read('month') - 1, read('day')) / 86400000
}

export const formatDayLong = (timestamp, language, timeZone = CLINIC_TIME_ZONE) =>
  new Intl.DateTimeFormat(locale(language), { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(new Date(timestamp))

export const formatDayShort = (timestamp, language, timeZone = CLINIC_TIME_ZONE) =>
  new Intl.DateTimeFormat(locale(language), { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(new Date(timestamp))

/** "Today", "Tomorrow", or the date. Counted in clinic days, so it matches the booking calendar. */
export const formatRelativeDay = (timestamp, language, now = Date.now(), timeZone = CLINIC_TIME_ZONE) => {
  const diff = clinicDayNumber(timestamp, timeZone) - clinicDayNumber(now, timeZone)
  if (diff === 0 || diff === 1) {
    const label = new Intl.RelativeTimeFormat(locale(language), { numeric: 'auto' }).format(diff, 'day')
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  return formatDayShort(timestamp, language, timeZone)
}

/** "in 3 hours", in whichever language is showing. */
export const formatCountdown = (timestamp, language, now = Date.now()) => {
  const minutes = Math.round((timestamp - now) / 60000)
  const formatter = new Intl.RelativeTimeFormat(locale(language), { numeric: 'always' })
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 36) return formatter.format(hours, 'hour')
  return formatter.format(Math.round(hours / 24), 'day')
}

/** The patient's own clock for a slot, only when it differs from the clinic's. Null at home in Egypt. */
export const localTimeIfAbroad = (timestamp, language, timeZone = CLINIC_TIME_ZONE, patientZone = Intl.DateTimeFormat().resolvedOptions().timeZone) => {
  if (!patientZone || patientZone === timeZone) return null
  const format = (zone) => new Intl.DateTimeFormat(locale(language), { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short', timeZone: zone }).format(new Date(timestamp))
  const local = format(patientZone)
  return local === format(timeZone) ? null : local
}

export const availabilityLevel = (day) => {
  if (!day || day.slots.length === 0) return 'closed'
  if (day.availableCount === 0) return day.slots.every((slot) => slot.status === 'past') ? 'closed' : 'full'
  return day.availableCount <= 3 ? 'few' : 'open'
}

/** The open slot closest in time to the one just lost, so the patient is offered something instead of a dead end. */
export const nearestOpenSlot = (days = [], startsAt) => {
  let best = null
  for (const day of days) {
    for (const slot of day.slots) {
      if (!slot.available) continue
      if (!best || Math.abs(slot.startsAt - startsAt) < Math.abs(best.startsAt - startsAt)) {
        best = { slotDate: day.slotDate, slotTime: slot.time, startsAt: slot.startsAt }
      }
    }
  }
  return best
}

export const appointmentBucket = (appointment, now = Date.now()) => {
  if (appointment.cancelled || appointment.appointmentStatus === 'Cancelled') return 'cancelled'
  if (appointment.isCompleted || appointment.appointmentStatus === 'Finished') return 'past'
  if (appointment.appointmentStatus !== 'Booked') return 'upcoming'
  const ends = appointment.endsAt ?? appointment.startsAt
  return ends !== null && ends !== undefined && ends < now ? 'past' : 'upcoming'
}

export const splitAppointments = (appointments = [], now = Date.now()) => {
  const buckets = { upcoming: [], past: [], cancelled: [] }
  appointments.forEach((appointment) => buckets[appointmentBucket(appointment, now)].push(appointment))
  buckets.upcoming.sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0))
  buckets.past.sort((a, b) => (b.startsAt ?? 0) - (a.startsAt ?? 0))
  buckets.cancelled.sort((a, b) => (b.statusUpdatedAt ?? 0) - (a.statusUpdatedAt ?? 0))
  return buckets
}

export const shouldHighlightJoin = (appointment, now = Date.now()) =>
  Boolean(appointment.teleconsultationLink && appointment.joinOpensAt && now >= appointment.joinOpensAt && now <= (appointment.endsAt ?? Infinity))
