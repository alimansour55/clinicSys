const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

const parseMinutes = (value) => {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  const directMatch = trimmed.match(timePattern)
  if (directMatch) return Number(directMatch[1]) * 60 + Number(directMatch[2])

  const match = trimmed.match(/^(\d{1,2}):([0-5]\d)\s*([AP]M)$/i)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const period = match[3].toUpperCase()

  if (hours < 1 || hours > 12) return null
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0

  return hours * 60 + minutes
}

const parseSlotDate = (slotDate) => {
  if (!slotDate || typeof slotDate !== 'string') return null
  const [day, month, year] = slotDate.split('_').map(Number)
  if (!day || !month || !year) return null
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

const toDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const sanitizeSchedule = (schedule = {}, options = {}) => {
  const defaultWorkingDays = Array.isArray(options.defaultWorkingDays) ? options.defaultWorkingDays : [0, 1, 2, 3, 4, 5, 6]
  const defaultSlotDuration = Number(options.defaultSlotDuration || 30)

  const workingDays = Array.isArray(schedule.workingDays)
    ? [...new Set(schedule.workingDays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : defaultWorkingDays

  const startTime = timePattern.test(schedule.startTime || '') ? schedule.startTime : '10:00'
  const endTime = timePattern.test(schedule.endTime || '') ? schedule.endTime : '21:00'
  const startMinutes = parseMinutes(startTime)
  const endMinutes = parseMinutes(endTime)

  if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
    throw new Error('Schedule start time must be before end time')
  }

  const slotDuration = Number(schedule.slotDuration || defaultSlotDuration)
  if (!Number.isInteger(slotDuration) || slotDuration < 5 || slotDuration > 240) {
    throw new Error('Slot duration must be between 5 and 240 minutes')
  }

  const breaks = Array.isArray(schedule.breaks)
    ? schedule.breaks
      .map((item) => ({
        startTime: timePattern.test(item?.startTime || '') ? item.startTime : '',
        endTime: timePattern.test(item?.endTime || '') ? item.endTime : ''
      }))
      .filter((item) => item.startTime && item.endTime && parseMinutes(item.startTime) < parseMinutes(item.endTime))
    : []

  const blockedDates = Array.isArray(schedule.blockedDates)
    ? [...new Set(schedule.blockedDates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))]
    : []

  return { workingDays, startTime, endTime, breaks, slotDuration, blockedDates }
}

const isHomeVisitType = (appointmentType) => appointmentType === 'Home Visit'

const isTeleconsultationType = (appointmentType) => ['Voice Call', 'Video Call'].includes(appointmentType)

const usesClinicWeeklySchedule = (appointmentType) =>
  appointmentType === 'Clinic' || isTeleconsultationType(appointmentType)

const resolveClinicLocationForSchedule = (doctor, clinicLocation = '', appointmentType = 'Clinic') => {
  if (!usesClinicWeeklySchedule(appointmentType)) return ''
  const key = String(clinicLocation || '').trim()
  if (key) return key
  const locations = (doctor?.locations || []).map((location) => String(location || '').trim()).filter(Boolean)
  if (locations.length === 1) return locations[0]
  return ''
}

const getDoctorSchedule = (doctor, appointmentType = 'Clinic', clinicLocation = '') => {
  if (isHomeVisitType(appointmentType)) {
    return sanitizeSchedule(doctor?.homeVisitSchedule || {}, { defaultWorkingDays: [], defaultSlotDuration: 60 })
  }

  const main = sanitizeSchedule(doctor?.schedule || {}, { defaultWorkingDays: [] })
  const locationKey = usesClinicWeeklySchedule(appointmentType)
    ? resolveClinicLocationForSchedule(doctor, clinicLocation, appointmentType)
    : String(clinicLocation || '').trim()
  if (!locationKey) return main

  const branchRaw = getLocationSchedulesRecord(doctor)[locationKey]
  if (!branchRaw) return main

  const branch = sanitizeSchedule({ ...main, ...branchRaw }, { defaultWorkingDays: [] })
  if (branch.workingDays.length > 0) return branch
  return main
}

const getBookedSlotsField = (appointmentType = 'Clinic') => isHomeVisitType(appointmentType) ? 'home_visit_slots_booked' : 'slots_booked'

const getBookedSlots = (doctor, appointmentType = 'Clinic') => doctor?.[getBookedSlotsField(appointmentType)] || {}

/** True if this slot matches working days, blocked dates, window, grid, and breaks (ignores "past" / booking window). */
const slotFitsWorkingPattern = (schedule, date, slotTime) => {
  const start = parseMinutes(slotTime)
  if (!date || start === null) return false
  if (!schedule.workingDays.includes(date.getDay())) return false
  if (schedule.blockedDates.includes(toDateKey(date))) return false

  const slotEnd = start + schedule.slotDuration
  const dayStart = parseMinutes(schedule.startTime)
  const dayEnd = parseMinutes(schedule.endTime)

  if (start < dayStart || slotEnd > dayEnd) return false
  if ((start - dayStart) % schedule.slotDuration !== 0) return false

  return !schedule.breaks.some((item) => {
    const breakStart = parseMinutes(item.startTime)
    const breakEnd = parseMinutes(item.endTime)
    return start < breakEnd && slotEnd > breakStart
  })
}

const subtractIntervalFromSegments = (segments, cutStart, cutEnd) => {
  const out = []
  for (const [s, e] of segments) {
    if (e <= cutStart || s >= cutEnd) {
      out.push([s, e])
      continue
    }
    if (s < cutStart) out.push([s, Math.min(e, cutStart)])
    if (e > cutEnd) out.push([Math.max(s, cutEnd), e])
  }
  return out.filter(([s, e]) => e > s)
}

/** Open working intervals (minutes from midnight) for one weekday, after subtracting breaks. */
const workingOpenSegmentsForWeekday = (schedule, weekday) => {
  if (!schedule?.workingDays?.includes(weekday)) return []
  const dayStart = parseMinutes(schedule.startTime)
  const dayEnd = parseMinutes(schedule.endTime)
  if (dayStart === null || dayEnd === null || dayStart >= dayEnd) return []
  let segments = [[dayStart, dayEnd]]
  for (const item of schedule.breaks || []) {
    const bS = parseMinutes(item.startTime)
    const bE = parseMinutes(item.endTime)
    if (bS === null || bE === null || bS >= bE) continue
    segments = subtractIntervalFromSegments(segments, bS, bE)
  }
  return segments
}

const segmentsOverlap = (a, b) => {
  for (const [a1, a2] of a) {
    for (const [b1, b2] of b) {
      if (a1 < b2 && b1 < a2) return true
    }
  }
  return false
}

/** True if [startMin, endMin) overlaps any open working segment on that calendar date (respects blockedDates). */
const intervalOverlapsOpenWorkingMinutes = (schedule, date, startMin, endMin) => {
  if (startMin == null || endMin == null || endMin <= startMin || !date) return false
  if (schedule.blockedDates?.includes(toDateKey(date))) return false
  const segs = workingOpenSegmentsForWeekday(schedule, date.getDay())
  for (const [s, e] of segs) {
    if (startMin < e && s < endMin) return true
  }
  return false
}

const weekdayName = (d) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d] || 'Day'

/**
 * Returns null if OK, otherwise a user-facing message.
 * Detects overlapping weekly working hours between clinic branches and home visit (same weekday, open hours minus breaks).
 */
const validateDoctorNoScheduleOverlap = (doctor) => {
  if (!doctor) return null

  const locs = (doctor.locations || []).map((location) => String(location || '').trim()).filter(Boolean)

  const clinicLayers = []
  if (locs.length === 0) {
    clinicLayers.push({ label: 'Clinic', schedule: getDoctorSchedule(doctor, 'Clinic', '') })
  } else {
    for (const loc of locs) {
      clinicLayers.push({ label: `Clinic (${loc})`, schedule: getDoctorSchedule(doctor, 'Clinic', loc) })
    }
  }

  const homeSch = getDoctorSchedule(doctor, 'Home Visit', '')
  const layers = [...clinicLayers]
  if ((homeSch.workingDays || []).length > 0) {
    layers.push({ label: 'Home visit', schedule: homeSch })
  }

  if (layers.length < 2) return null

  for (let day = 0; day < 7; day += 1) {
    for (let i = 0; i < layers.length; i += 1) {
      const segA = workingOpenSegmentsForWeekday(layers[i].schedule, day)
      if (!segA.length) continue
      for (let j = i + 1; j < layers.length; j += 1) {
        const segB = workingOpenSegmentsForWeekday(layers[j].schedule, day)
        if (!segB.length) continue
        if (segmentsOverlap(segA, segB)) {
          return `Schedule overlap on ${weekdayName(day)} between ${layers[i].label} and ${layers[j].label}. You cannot be available in two places (or clinic and home visit) at the same time.`
        }
      }
    }
  }

  return null
}

const getLocationSchedulesRecord = (doctor) => {
  const raw = doctor?.locationSchedules
  if (!raw) return {}
  if (raw instanceof Map) return Object.fromEntries(raw.entries())
  return typeof raw === 'object' ? raw : {}
}

const hasWorkingDays = (days) =>
  Array.isArray(days) && days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).length > 0

const hasDoctorPublishedSchedule = (doctor) => {
  if (hasWorkingDays(doctor?.schedule?.workingDays)) return true

  return Object.values(getLocationSchedulesRecord(doctor)).some((schedule) =>
    hasWorkingDays(schedule?.workingDays)
  )
}

/** Patient-facing booking: doctor published weekly clinic slots (main or branch). */
const isDoctorOpenForPatientBooking = (doctor) => {
  if (!doctor) return false
  return hasDoctorPublishedSchedule(doctor)
}

const isSlotAllowedBySchedule = (doctor, slotDate, slotTime, appointmentType = 'Clinic', clinicLocation = '') => {
  if (!hasDoctorPublishedSchedule(doctor)) {
    return { allowed: false, reason: 'Doctor has not published appointment slots yet' }
  }

  const resolvedClinicLocation = resolveClinicLocationForSchedule(doctor, clinicLocation, appointmentType)
  const schedule = getDoctorSchedule(doctor, appointmentType, resolvedClinicLocation)
  const date = parseSlotDate(slotDate)
  const start = parseMinutes(slotTime)

  if (!date || start === null) return { allowed: false, reason: 'Invalid appointment date or time' }

  const slotStart = new Date(date)
  slotStart.setHours(Math.floor(start / 60), start % 60, 0, 0)
  const now = new Date()
  const maxBookingDate = new Date(now)
  maxBookingDate.setMonth(maxBookingDate.getMonth() + 1)

  if (slotStart <= now) return { allowed: false, reason: 'Cannot book a past time' }
  if (slotStart > maxBookingDate) return { allowed: false, reason: 'Appointments can only be booked within one month' }

  if (!schedule.workingDays.includes(date.getDay())) {
    return { allowed: false, reason: isHomeVisitType(appointmentType) ? 'Doctor has no home visit slots on this day' : 'Doctor is not working on this day' }
  }
  if (schedule.blockedDates.includes(toDateKey(date))) return { allowed: false, reason: 'Doctor is blocked on this date' }

  const slotEnd = start + schedule.slotDuration
  const dayStart = parseMinutes(schedule.startTime)
  const dayEnd = parseMinutes(schedule.endTime)

  if (start < dayStart || slotEnd > dayEnd) return { allowed: false, reason: 'Slot is outside doctor working hours' }
  if ((start - dayStart) % schedule.slotDuration !== 0) return { allowed: false, reason: 'Slot does not match doctor schedule' }

  const overlapsBreak = schedule.breaks.some((item) => {
    const breakStart = parseMinutes(item.startTime)
    const breakEnd = parseMinutes(item.endTime)
    return start < breakEnd && slotEnd > breakStart
  })

  if (overlapsBreak) return { allowed: false, reason: 'Slot overlaps a doctor break' }

  const clinicLocs = (doctor.locations || []).map((location) => String(location || '').trim()).filter(Boolean)
  const locKey = resolvedClinicLocation

  if (usesClinicWeeklySchedule(appointmentType)) {
    if (clinicLocs.length > 1) {
      for (const other of clinicLocs) {
        if (other === locKey) continue
        const otherSch = getDoctorSchedule(doctor, 'Clinic', other)
        if (intervalOverlapsOpenWorkingMinutes(otherSch, date, start, slotEnd)) {
          return { allowed: false, reason: `This time overlaps availability at another branch (${other}). Choose a different time or location.` }
        }
      }
    }
    const homeSch = getDoctorSchedule(doctor, 'Home Visit', '')
    if ((homeSch.workingDays || []).length > 0 && intervalOverlapsOpenWorkingMinutes(homeSch, date, start, slotEnd)) {
      return { allowed: false, reason: 'This time overlaps home visit hours. Choose a different time or appointment type.' }
    }
  }

  if (isHomeVisitType(appointmentType)) {
    const clinicCandidates = clinicLocs.length > 0 ? clinicLocs : ['']
    for (const other of clinicCandidates) {
      const otherSch = getDoctorSchedule(doctor, 'Clinic', other)
      if (intervalOverlapsOpenWorkingMinutes(otherSch, date, start, slotEnd)) {
        const label = other ? `clinic (${other})` : 'clinic'
        return { allowed: false, reason: `This time overlaps ${label} hours. Choose a different time or appointment type.` }
      }
    }
  }

  return { allowed: true, schedule }
}

export {
  getBookedSlots,
  getBookedSlotsField,
  getDoctorSchedule,
  getLocationSchedulesRecord,
  hasDoctorPublishedSchedule,
  isDoctorOpenForPatientBooking,
  isSlotAllowedBySchedule,
  resolveClinicLocationForSchedule,
  sanitizeSchedule,
  usesClinicWeeklySchedule,
  validateDoctorNoScheduleOverlap
}
