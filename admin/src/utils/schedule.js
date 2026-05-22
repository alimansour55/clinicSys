import { hasDoctorPublishedSchedule, resolveClinicLocationForSlots, usesClinicWeeklySchedule } from './doctorBooking'

export const parseMinutes = (value) => {
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

const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const toSlotDate = (date) => `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`

export const slotDateForCalendarOffset = (dayOffset) => {
  const base = new Date()
  const day0 = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  const d = new Date(day0)
  d.setDate(day0.getDate() + dayOffset)
  return toSlotDate(d)
}

const defaultSchedule = {
  workingDays: [0, 1, 2, 3, 4, 5, 6],
  startTime: '10:00',
  endTime: '21:00',
  breaks: [],
  slotDuration: 30,
  blockedDates: []
}

const defaultHomeVisitSchedule = {
  ...defaultSchedule,
  workingDays: [],
  slotDuration: 60
}

const normalizeWorkingDays = (days) => {
  if (!Array.isArray(days)) return []
  return [...new Set(days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
}

const prepareSchedule = (schedule) => ({
  ...defaultSchedule,
  ...schedule,
  workingDays: normalizeWorkingDays(schedule?.workingDays),
  breaks: Array.isArray(schedule?.breaks) ? schedule.breaks : [],
  blockedDates: Array.isArray(schedule?.blockedDates) ? schedule.blockedDates : []
})

const getLocationSchedulesRecord = (doctor) => {
  const raw = doctor?.locationSchedules
  if (!raw || typeof raw !== 'object') return {}
  return raw
}

const getScheduleForType = (doctor, appointmentType, clinicLocation = '') => {
  if (appointmentType === 'Home Visit') {
    return prepareSchedule({ ...defaultHomeVisitSchedule, ...(doctor.homeVisitSchedule || {}) })
  }

  const main = prepareSchedule(doctor.schedule || {})
  const locationKey = usesClinicWeeklySchedule(appointmentType)
    ? resolveClinicLocationForSlots(doctor, clinicLocation)
    : String(clinicLocation || '').trim()
  if (!locationKey) return main

  const branchRaw = getLocationSchedulesRecord(doctor)[locationKey]
  if (!branchRaw) return main

  const branch = prepareSchedule({ ...main, ...branchRaw })
  if (branch.workingDays.length > 0) return branch
  return main
}

const getBookedSlotsForType = (doctor, appointmentType) => appointmentType === 'Home Visit'
  ? doctor.home_visit_slots_booked
  : doctor.slots_booked

const emptyDayRows = (days, today) =>
  Array.from({ length: days }, (_, index) => ({ dateTime: addDays(today, index), slots: [], availableCount: 0 }))

/**
 * @param {null | { slotDate: string, slotTime: string, sourceLocation: string }} holdSelection
 */
export const buildDoctorSlots = (doctor, days = 31, appointmentType = 'Clinic', clinicLocation = '', holdSelection = null) => {
  if (!hasDoctorPublishedSchedule(doctor)) {
    const today = new Date()
    return emptyDayRows(days, today)
  }

  const effectiveClinicLocation = usesClinicWeeklySchedule(appointmentType)
    ? resolveClinicLocationForSlots(doctor, clinicLocation)
    : String(clinicLocation || '').trim()

  const branchCount = (doctor?.locations || []).map((loc) => String(loc || '').trim()).filter(Boolean).length
  if (usesClinicWeeklySchedule(appointmentType) && branchCount > 1 && !effectiveClinicLocation) {
    const today = new Date()
    return emptyDayRows(days, today)
  }

  const schedule = getScheduleForType(doctor, appointmentType, effectiveClinicLocation)
  if (!schedule.workingDays.length) {
    const today = new Date()
    return emptyDayRows(days, today)
  }

  const bookedSlots = getBookedSlotsForType(doctor, appointmentType) || {}
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
      return { dateTime: date, slots: [], availableCount: 0 }
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
      const isHeldOtherBranch =
        usesClinicWeeklySchedule(appointmentType) &&
        holdSelection &&
        holdSelection.slotDate === slotDate &&
        holdSelection.slotTime === time &&
        String(holdSelection.sourceLocation || '').trim() !== String(effectiveClinicLocation || '').trim()
      const isAvailable = !isPast && !overlapsBreak && !isBooked && !isHeldOtherBranch

      slots.push({
        dateTime: slotStart,
        time,
        available: isAvailable,
        reason: isHeldOtherBranch
          ? 'Selected at another branch'
          : isPast
            ? 'Past time'
            : overlapsBreak
              ? 'Break'
              : isBooked
                ? 'Booked'
                : 'Available'
      })
    }

    return { dateTime: date, slots, availableCount: slots.filter((slot) => slot.available).length }
  })
}

const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(date.getDate() + days)
  next.setHours(0, 0, 0, 0)
  return next
}
