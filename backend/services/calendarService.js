import { slotStartDate } from './clinicTimeService.js'
import { getVisitMinutes } from './bookingService.js'
import { getPublicAppBrand } from '../config/publicBrand.js'

const TYPE_LABELS = {
  en: { Clinic: 'Clinic visit', 'Voice Call': 'Voice call', 'Video Call': 'Video call', 'Home Visit': 'Home visit' },
  ar: { Clinic: 'زيارة العيادة', 'Voice Call': 'مكالمة صوتية', 'Video Call': 'مكالمة فيديو', 'Home Visit': 'زيارة منزلية' }
}

const COPY = {
  en: { with: 'with Dr.', ref: 'Reservation', join: 'Join the call' },
  ar: { with: 'مع د.', ref: 'رقم الحجز', join: 'رابط المكالمة' }
}

const toIcsUtc = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

const escapeIcsText = (value) => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n')

/** RFC 5545 limits lines to 75 octets. Folding by bytes keeps Arabic text valid. */
const foldIcsLine = (line) => {
  const encoder = new TextEncoder()
  const out = []
  let current = ''
  let size = 0
  for (const char of line) {
    const bytes = encoder.encode(char).length
    if (size + bytes > (out.length ? 74 : 75)) {
      out.push(current)
      current = ''
      size = 0
    }
    current += char
    size += bytes
  }
  out.push(current)
  return out.join('\r\n ')
}

const appointmentPlace = (appointment) => {
  if (appointment.appointmentType === 'Home Visit') {
    const address = appointment.homeVisitAddress || {}
    return [address.street, address.building, address.area].filter(Boolean).join(', ')
  }
  if (['Voice Call', 'Video Call'].includes(appointment.appointmentType)) return ''
  return appointment.clinicLocation || appointment.docData?.address?.line1 || ''
}

export const buildCalendarEvent = (appointment, { lang = 'en' } = {}) => {
  const copy = COPY[lang] || COPY.en
  const labels = TYPE_LABELS[lang] || TYPE_LABELS.en
  const starts = slotStartDate(appointment.slotDate, appointment.slotTime)
  if (!starts) return null
  const ends = new Date(starts.getTime() + getVisitMinutes(appointment) * 60 * 1000)

  const description = [
    appointment.reservationNumber ? `${copy.ref}: ${appointment.reservationNumber}` : '',
    appointment.teleconsultationLink && !appointment.cancelled ? `${copy.join}: ${appointment.teleconsultationLink}` : ''
  ].filter(Boolean).join('\n')

  return {
    uid: `appointment-${appointment._id}@clinivo`,
    starts,
    ends,
    summary: `${labels[appointment.appointmentType] || labels.Clinic} ${copy.with} ${appointment.docData?.name || ''}`.trim(),
    location: appointmentPlace(appointment),
    description
  }
}

/** One event per appointment, stable across re-downloads, so a rescheduled visit updates rather than duplicates. */
export const buildIcs = (appointment, { lang = 'en', now = new Date() } = {}) => {
  const event = buildCalendarEvent(appointment, { lang })
  if (!event) return ''

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${escapeIcsText(getPublicAppBrand())}//Appointments//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `SEQUENCE:${Number(appointment.rescheduleCount || 0)}`,
    `DTSTART:${toIcsUtc(event.starts)}`,
    `DTEND:${toIcsUtc(event.ends)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    event.location ? `LOCATION:${escapeIcsText(event.location)}` : '',
    event.description ? `DESCRIPTION:${escapeIcsText(event.description)}` : '',
    `STATUS:${appointment.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(event.summary)}`,
    'TRIGGER:-PT2H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean)

  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}

export const buildGoogleCalendarUrl = (appointment, { lang = 'en' } = {}) => {
  const event = buildCalendarEvent(appointment, { lang })
  if (!event) return ''
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    dates: `${toIcsUtc(event.starts)}/${toIcsUtc(event.ends)}`,
    details: event.description,
    location: event.location
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
