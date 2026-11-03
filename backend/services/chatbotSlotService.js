import {
  getDoctorSchedule,
  getBookedSlots,
  hasDoctorPublishedSchedule,
  isSlotAllowedBySchedule,
  resolveClinicLocationForSchedule,
  usesClinicWeeklySchedule
} from './scheduleService.js'
import {
  clinicNow,
  nearestSlotDistance,
  slotInDayPart,
  slotMatchesRequestedTime
} from './chatbotScheduling.js'

const parseMinutes = (value) => {
  if (!value) return null
  const direct = String(value).match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (direct) return Number(direct[1]) * 60 + Number(direct[2])

  const match = String(value).match(/^(\d{1,2}):([0-5]\d)\s*([AP]M)$/i)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const period = match[3].toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

const minutesToTime = (minutes) => {
  const hours24 = Math.floor(minutes / 60)
  const hours = String(hours24 % 12 || 12).padStart(2, '0')
  const mins = String(minutes % 60).padStart(2, '0')
  return `${hours}:${mins} ${hours24 >= 12 ? 'PM' : 'AM'}`
}

const toDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const toSlotDate = (date) => `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`

const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(date.getDate() + days)
  next.setHours(0, 0, 0, 0)
  return next
}

const resolveClinicLocation = (doctor, clinicLocation = '') => {
  const locations = (doctor?.locations || []).map((l) => String(l || '').trim()).filter(Boolean)
  const key = String(clinicLocation || '').trim()
  if (key && locations.includes(key)) return key
  if (locations.length === 1) return locations[0]
  return key
}

/**
 * Build patient-facing available slots (mirrors frontend buildDoctorSlots).
 */
export const buildAvailableSlotsForDoctor = (
  doctor,
  { days = 14, appointmentType = 'Clinic', clinicLocation = '', now = new Date() } = {}
) => {
  if (!hasDoctorPublishedSchedule(doctor)) {
    return []
  }

  const effectiveClinicLocation = usesClinicWeeklySchedule(appointmentType)
    ? resolveClinicLocation(doctor, clinicLocation)
    : String(clinicLocation || '').trim()

  const branchCount = (doctor?.locations || []).map((l) => String(l || '').trim()).filter(Boolean).length
  if (usesClinicWeeklySchedule(appointmentType) && branchCount > 1 && !effectiveClinicLocation) {
    return []
  }

  const schedule = getDoctorSchedule(doctor, appointmentType, effectiveClinicLocation)
  if (!schedule.workingDays?.length) return []

  const bookedSlots = getBookedSlots(doctor, appointmentType) || {}
  const slotDuration = Number(schedule.slotDuration || 30)
  const dayStart = parseMinutes(schedule.startTime) ?? 600
  const dayEnd = parseMinutes(schedule.endTime) ?? 1260
  const today = clinicNow(now)

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index)
    const slotDate = toSlotDate(date)
    const isBlocked = schedule.blockedDates?.includes(toDateKey(date))
    const isWorkingDay = schedule.workingDays.includes(date.getDay())

    if (!isWorkingDay || isBlocked || dayStart >= dayEnd) {
      return { slotDate, date: date.toISOString(), slots: [], availableCount: 0 }
    }

    const slots = []
    for (let minutes = dayStart; minutes + slotDuration <= dayEnd; minutes += slotDuration) {
      const slotStart = new Date(date)
      slotStart.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)

      const overlapsBreak = (schedule.breaks || []).some((item) => {
        const breakStart = parseMinutes(item.startTime)
        const breakEnd = parseMinutes(item.endTime)
        return breakStart !== null && breakEnd !== null && minutes < breakEnd && minutes + slotDuration > breakStart
      })

      const time = minutesToTime(minutes)
      const isBooked = bookedSlots?.[slotDate]?.includes(time)
      const isPast = slotStart <= today
      // The same rule booking applies, so nothing offered here can be refused at the last step.
      const isAllowed = isSlotAllowedBySchedule(doctor, slotDate, time, appointmentType, effectiveClinicLocation).allowed
      const available = !isPast && !overlapsBreak && !isBooked && isAllowed

      slots.push({ time, available, reason: isPast ? 'Past' : isBooked ? 'Booked' : overlapsBreak ? 'Break' : isAllowed ? 'Available' : 'Unavailable' })
    }

    return {
      slotDate,
      date: date.toISOString(),
      slots: slots.filter((s) => s.available),
      availableCount: slots.filter((s) => s.available).length
    }
  }).filter((day) => day.availableCount > 0)
}

export const getDefaultClinicLocation = (doctor) => {
  const locations = (doctor?.locations || []).map((l) => String(l || '').trim()).filter(Boolean)
  return locations.length === 1 ? locations[0] : ''
}

/** Every open slot for one visit type, soonest first, across all of the doctor's branches. */
const listOpenSlots = (doctor, { appointmentType, now }) => {
  const locations = (doctor?.locations || []).map((l) => String(l || '').trim()).filter(Boolean)
  const branches = usesClinicWeeklySchedule(appointmentType) && locations.length > 1 ? locations : [locations[0] || '']
  const isClinicVisit = appointmentType === 'Clinic'

  return branches
    .flatMap((branch) =>
      buildAvailableSlotsForDoctor(doctor, { appointmentType, clinicLocation: branch, now }).flatMap((day) =>
        day.slots.map((slot) => ({
          slotDate: day.slotDate,
          date: day.date,
          time: slot.time,
          clinicLocation: usesClinicWeeklySchedule(appointmentType) ? branch : '',
          appointmentType,
          sortKey: new Date(day.date).getTime() + minutesOfTime(slot.time) * 60000
        }))
      )
    )
    .sort((a, b) => a.sortKey - b.sortKey)
}

const minutesOfTime = (time) => parseMinutes(time) ?? 0

/**
 * The few slots to show on a doctor's card, honouring what the patient asked for.
 * `matched` says whether they fit the request or are the nearest alternative.
 */
export const pickNextSlots = (
  doctor,
  { appointmentType = 'Clinic', date = null, dayPart = null, time = null, limit = 3, now = new Date() } = {}
) => {
  const open = listOpenSlots(doctor, { appointmentType, now })
  const dayKey = date ? toSlotDate(date) : null
  const onDay = dayKey ? open.filter((slot) => slot.slotDate === dayKey) : open
  const inPart = dayPart ? onDay.filter((slot) => slotInDayPart(slot.time, dayPart)) : onDay
  const exact = time ? inPart.filter((slot) => slotMatchesRequestedTime(slot.time, time)) : inPart

  const hasRequest = Boolean(date || dayPart || time)
  let chosen = exact
  let matched = exact.length > 0

  if (!chosen.length && time) {
    chosen = [...(onDay.length ? onDay : open)].sort(
      (a, b) => nearestSlotDistance(a.time, time) - nearestSlotDistance(b.time, time)
    )
    matched = false
  }
  if (!chosen.length) {
    chosen = onDay.length ? onDay : open
    matched = false
  }

  return {
    matched: hasRequest ? matched : true,
    totalOpen: open.length,
    slots: chosen.slice(0, limit).map(({ sortKey, ...slot }) => slot)
  }
}
