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

const sanitizeSchedule = (schedule = {}) => {
  const workingDays = Array.isArray(schedule.workingDays)
    ? [...new Set(schedule.workingDays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : [0, 1, 2, 3, 4, 5, 6]

  const startTime = timePattern.test(schedule.startTime || '') ? schedule.startTime : '10:00'
  const endTime = timePattern.test(schedule.endTime || '') ? schedule.endTime : '21:00'
  const startMinutes = parseMinutes(startTime)
  const endMinutes = parseMinutes(endTime)

  if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
    throw new Error('Schedule start time must be before end time')
  }

  const slotDuration = Number(schedule.slotDuration || 30)
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

const getDoctorSchedule = (doctor) => sanitizeSchedule(doctor?.schedule || {})

const isSlotAllowedBySchedule = (doctor, slotDate, slotTime) => {
  if (!doctor?.available) return { allowed: false, reason: 'Doctor not available' }

  const schedule = getDoctorSchedule(doctor)
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

  if (!schedule.workingDays.includes(date.getDay())) return { allowed: false, reason: 'Doctor is not working on this day' }
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

  return { allowed: true, schedule }
}

export { getDoctorSchedule, isSlotAllowedBySchedule, sanitizeSchedule }
