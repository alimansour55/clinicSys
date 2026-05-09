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

const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const toSlotDate = (date) => `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`

const defaultSchedule = {
  workingDays: [0, 1, 2, 3, 4, 5, 6],
  startTime: '10:00',
  endTime: '21:00',
  breaks: [],
  slotDuration: 30,
  blockedDates: []
}

export const buildDoctorSlots = (doctor, days = 31) => {
  if (!doctor?.available) return Array.from({ length: days }, (_, index) => ({ dateTime: addDays(new Date(), index), slots: [], availableCount: 0 }))

  const schedule = { ...defaultSchedule, ...(doctor.schedule || {}) }
  const slotDuration = Number(schedule.slotDuration || 30)
  const dayStart = parseMinutes(schedule.startTime) ?? 600
  const dayEnd = parseMinutes(schedule.endTime) ?? 1260
  const today = new Date()

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index)
    const slotDate = toSlotDate(date)
    const isBlocked = schedule.blockedDates?.includes(toDateKey(date))
    const isWorkingDay = schedule.workingDays?.includes(date.getDay())

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
      const isBooked = doctor.slots_booked?.[slotDate]?.includes(time)
      const isPast = slotStart <= new Date()
      const isAvailable = !isPast && !overlapsBreak && !isBooked

      slots.push({
        dateTime: slotStart,
        time,
        available: isAvailable,
        reason: isPast ? 'Past time' : overlapsBreak ? 'Break' : isBooked ? 'Booked' : 'Available'
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
