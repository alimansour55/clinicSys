import {
  getDoctorSchedule,
  getBookedSlots,
  hasDoctorPublishedSchedule,
  resolveClinicLocationForSchedule,
  usesClinicWeeklySchedule
} from './scheduleService.js'

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
  { days = 14, appointmentType = 'Clinic', clinicLocation = '' } = {}
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
  const today = new Date()

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
      const isPast = slotStart <= new Date()
      const available = !isPast && !overlapsBreak && !isBooked

      slots.push({ time, available, reason: isPast ? 'Past' : isBooked ? 'Booked' : overlapsBreak ? 'Break' : 'Available' })
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
