import appointmentModel from '../models/appointmentModel.js'
import doctorModel from '../models/doctorModel.js'
import { addDaysToSlotDate, canonicalSlotTime, clinicTodaySlotDate, getClinicTimeZone, minutesToSlotTime, parseSlotMinutes, slotDateToDateKey, slotDateWeekday, slotStartDate } from './clinicTimeService.js'
import { doctorOffersHomeVisit } from './homeVisitService.js'
import { BOOKING_WINDOW_DAYS, getBookedSlots, getDoctorSchedule, hasDoctorPublishedSchedule, isSlotAllowedBySchedule, resolveClinicLocationForSchedule, usesClinicWeeklySchedule } from './scheduleService.js'
import { getDoctorAppointmentModeError } from './appointmentModeService.js'

const scheduleGridMinutes = (schedule) => {
  const start = parseSlotMinutes(schedule.startTime)
  const end = parseSlotMinutes(schedule.endTime)
  const duration = Number(schedule.slotDuration)
  if (start === null || end === null || !duration) return []
  const grid = []
  for (let minutes = start; minutes + duration <= end; minutes += duration) grid.push(minutes)
  return grid
}

const windowSlotDates = (now, days) => {
  const today = clinicTodaySlotDate(now)
  return Array.from({ length: days }, (_, index) => addDaysToSlotDate(today, index))
}

const takenMap = (doctor, appointmentType, liveAppointments) => {
  const taken = {}
  const add = (slotDate, slotTime) => {
    const time = canonicalSlotTime(slotTime)
    if (!time) return
    if (!taken[slotDate]) taken[slotDate] = new Set()
    taken[slotDate].add(time)
  }
  const booked = getBookedSlots(doctor, appointmentType)
  Object.entries(booked || {}).forEach(([slotDate, times]) => {
    if (Array.isArray(times)) times.forEach((time) => add(slotDate, time))
  })
  liveAppointments.forEach((row) => add(row.slotDate, row.slotTime))
  return taken
}

const canBookType = (doctor, appointmentType) => {
  if (doctor.available === false) return false
  if (!hasDoctorPublishedSchedule(doctor)) return false
  if (appointmentType === 'Home Visit' && !doctorOffersHomeVisit(doctor)) return false
  return !getDoctorAppointmentModeError(doctor, appointmentType)
}

const buildDays = (doctor, { appointmentType, clinicLocation, slotDates, liveAppointments, now }) => {
  if (!canBookType(doctor, appointmentType)) return []

  let schedule
  try {
    schedule = getDoctorSchedule(doctor, appointmentType, clinicLocation)
  } catch {
    return []
  }
  const grid = scheduleGridMinutes(schedule)
  const taken = takenMap(doctor, appointmentType, liveAppointments)
  const nowMs = now.getTime()

  return slotDates.map((slotDate) => {
    const slots = []
    for (const minutes of grid) {
      const time = minutesToSlotTime(minutes)
      const starts = slotStartDate(slotDate, time)
      const isPast = starts.getTime() <= nowMs
      // Validation is the single source of truth, so a slot shown here is one the booking call accepts.
      if (!isPast && !isSlotAllowedBySchedule(doctor, slotDate, time, appointmentType, clinicLocation, { now }).allowed) continue
      if (isPast && !schedule.workingDays.includes(slotDateWeekday(slotDate))) continue
      if (isPast && schedule.blockedDates.includes(slotDateToDateKey(slotDate))) continue

      const isTaken = Boolean(taken[slotDate]?.has(time))
      slots.push({
        time,
        minutes,
        startsAt: starts.getTime(),
        available: !isPast && !isTaken,
        status: isPast ? 'past' : isTaken ? 'taken' : 'available'
      })
    }
    return {
      slotDate,
      dateKey: slotDateToDateKey(slotDate),
      weekday: slotDateWeekday(slotDate),
      availableCount: slots.filter((slot) => slot.available).length,
      takenCount: slots.filter((slot) => slot.status === 'taken').length,
      slots
    }
  })
}

const firstOpenSlot = (days) => {
  for (const day of days) {
    const slot = day.slots.find((row) => row.available)
    if (slot) return { slotDate: day.slotDate, slotTime: slot.time, startsAt: slot.startsAt }
  }
  return null
}

const loadLiveAppointments = (docId, slotDates) =>
  appointmentModel.find({ docId: String(docId), cancelled: false, slotDate: { $in: slotDates } }).select('slotDate slotTime').lean()

const doctorBranches = (doctor) => (doctor.locations || []).map((location) => String(location || '').trim()).filter(Boolean)

/** Everything the booking screen shows for one doctor, for one way of being seen. */
export const getAvailabilityForDoctor = async (doctor, { appointmentType = 'Clinic', clinicLocation = '', days = BOOKING_WINDOW_DAYS, now = new Date() } = {}) => {
  const slotDates = windowSlotDates(now, Math.min(BOOKING_WINDOW_DAYS, Math.max(1, Number(days) || BOOKING_WINDOW_DAYS)))
  const liveAppointments = await loadLiveAppointments(doctor._id, slotDates)
  const branches = usesClinicWeeklySchedule(appointmentType) ? doctorBranches(doctor) : []
  const resolvedLocation = resolveClinicLocationForSchedule(doctor, clinicLocation, appointmentType)
  const needsBranchChoice = branches.length > 1 && !resolvedLocation

  const branchRows = branches.length > 1
    ? branches.map((location) => {
      const rows = buildDays(doctor, { appointmentType, clinicLocation: location, slotDates, liveAppointments, now })
      return {
        location,
        next: firstOpenSlot(rows),
        availableThisWeek: rows.slice(0, 7).reduce((sum, row) => sum + row.availableCount, 0)
      }
    })
    : []

  const dayRows = needsBranchChoice
    ? []
    : buildDays(doctor, { appointmentType, clinicLocation: resolvedLocation, slotDates, liveAppointments, now })

  return {
    timeZone: getClinicTimeZone(),
    serverTime: now.getTime(),
    appointmentType,
    clinicLocation: resolvedLocation,
    needsBranchChoice,
    branches: branchRows,
    days: dayRows,
    nextAvailable: firstOpenSlot(dayRows)
  }
}

const PUBLIC_DOCTOR_FIELDS = 'name image speciality degree experience fees available locations locationSchedules schedule homeVisitSchedule homeVisitAreas acceptsVoiceCall acceptsVideoCall slots_booked home_visit_slots_booked i18n'

/** The soonest open slot for one doctor across all their branches. */
const soonestForDoctor = async (doctor, appointmentType, now) => {
  const slotDates = windowSlotDates(now, BOOKING_WINDOW_DAYS)
  const liveAppointments = await loadLiveAppointments(doctor._id, slotDates)
  const branches = usesClinicWeeklySchedule(appointmentType) ? doctorBranches(doctor) : []
  const locations = branches.length ? branches : ['']

  let best = null
  for (const location of locations) {
    const next = firstOpenSlot(buildDays(doctor, { appointmentType, clinicLocation: location, slotDates, liveAppointments, now }))
    if (next && (!best || next.startsAt < best.startsAt)) best = { ...next, clinicLocation: location }
  }
  return best
}

/** "Who can see me soonest?" across doctors, optionally inside one speciality. */
export const getNextAvailableAcrossDoctors = async ({ speciality = '', appointmentType = 'Clinic', excludeDocId = '', limit = 5, now = new Date() } = {}) => {
  const query = { available: { $ne: false } }
  if (speciality) query.speciality = String(speciality)
  if (excludeDocId) query._id = { $ne: excludeDocId }

  const doctors = await doctorModel.find(query).select(PUBLIC_DOCTOR_FIELDS).limit(60).lean()
  const rows = await Promise.all(doctors.map(async (doctor) => {
    const soonest = await soonestForDoctor(doctor, appointmentType, now)
    if (!soonest) return null
    return {
      docId: String(doctor._id),
      name: doctor.name,
      image: doctor.image,
      speciality: doctor.speciality,
      degree: doctor.degree,
      i18n: doctor.i18n,
      appointmentType,
      ...soonest
    }
  }))

  return rows
    .filter(Boolean)
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, Math.min(20, Math.max(1, Number(limit) || 5)))
}
