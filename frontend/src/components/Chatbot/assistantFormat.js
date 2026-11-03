import { localizeWesternDigits } from '../../utils/arabicNumerals.js'

/** Fills {placeholders} in a translated string. */
export const fillTemplate = (template, vars = {}) =>
  String(template).replace(/\{(\w+)\}/g, (whole, name) => (vars[name] === undefined ? whole : String(vars[name])))

/** slotDate is d_m_yyyy. Reading it directly avoids any time zone shifting the day. */
export const slotDateToDate = (slotDate = '') => {
  const [day, month, year] = String(slotDate).split('_').map(Number)
  if (!day || !month || !year) return null
  return new Date(year, month - 1, day)
}

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** "Today", "Tomorrow" or "Thu, Nov 5", in the chat's language. */
export const formatDayLabel = (slotDate, language, t, now = new Date()) => {
  const date = slotDateToDate(slotDate)
  if (!date) return ''
  if (sameDay(date, now)) return t('assistant.today')
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (sameDay(date, tomorrow)) return t('assistant.tomorrow')
  return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

export const formatLongDay = (slotDate, language) => {
  const date = slotDateToDate(slotDate)
  if (!date) return ''
  return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

/** "05:30 PM" as "5:30 PM" or "٥:٣٠ م". */
export const formatSlotTime = (time, language, t) => {
  const match = String(time).match(/^0?(\d{1,2}:\d{2})\s*([AP])M$/i)
  if (!match) return localizeWesternDigits(time, language)
  const period = t(match[2].toUpperCase() === 'A' ? 'assistant.am' : 'assistant.pm')
  return localizeWesternDigits(`${match[1]} ${period}`, language)
}

/** The stage of the booking, for the progress ribbon. */
export const journeyStage = (step, steps) => {
  switch (step) {
    case steps.SHOWING_DOCTORS:
      return 1
    case steps.WAITING_APPOINTMENT_TYPE:
    case steps.WAITING_LOCATION:
    case steps.WAITING_HOME_AREA:
    case steps.WAITING_DATE:
    case steps.WAITING_TIME:
      return 2
    case steps.WAITING_VISIT_FEE:
    case steps.CONFIRMING:
    case steps.FAILED:
    case 'needs_login':
      return 3
    case steps.SUCCESS:
      return 4
    default:
      return 0
  }
}

const pad = (value) => String(value).padStart(2, '0')

const toIcsDate = (date) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`

const escapeIcs = (text = '') =>
  String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** A calendar file. The title names the doctor only, so no health detail lands on a shared calendar. */
export const buildCalendarFile = ({ title, slotDate, time, location = '', reservationNumber = '', durationMinutes = 30 }) => {
  const day = slotDateToDate(slotDate)
  const match = String(time).match(/^(\d{1,2}):(\d{2})\s*([AP])M$/i)
  if (!day || !match) return ''
  const start = new Date(day)
  start.setHours((Number(match[1]) % 12) + (match[3].toUpperCase() === 'P' ? 12 : 0), Number(match[2]), 0, 0)
  const end = new Date(start.getTime() + durationMinutes * 60000)

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Clinivo//Assistant//EN',
    'BEGIN:VEVENT',
    `UID:clinivo-${reservationNumber || toIcsDate(start)}@clinivo.shop`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcs(title)}`,
    ...(location ? [`LOCATION:${escapeIcs(location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n')
}

export const downloadCalendarFile = (content, fileName = 'clinivo-appointment.ics') => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
