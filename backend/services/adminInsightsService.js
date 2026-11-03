/**
 * Everything on the admin command centre, worked out from real records. Pure, so it can be tested
 * without a database: the controller loads the rows and passes them in.
 */
import { getClinicTimeZone } from './clinicTimeService.js'

const CLINIC_TIME_ZONE = getClinicTimeZone()
const DAY_MS = 24 * 60 * 60 * 1000

/** The clinic's calendar date for a moment. Slots are stored as clinic time and the server may run in UTC. */
const clinicDateParts = (ms) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(new Date(ms))
  const value = (type) => Number(parts.find((part) => part.type === type)?.value)
  return { day: value('day'), month: value('month'), year: value('year'), hour: value('hour'), minute: value('minute') }
}

const keyOf = ({ day, month, year }) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
export const clinicDateKey = (ms) => keyOf(clinicDateParts(ms))

/** "3_11_2026" to "2026-11-03", or '' when the value is not a date. */
export const slotDateKey = (slotDate) => {
  const [day, month, year] = String(slotDate || '').split('_').map(Number)
  return day && month && year ? keyOf({ day, month, year }) : ''
}

/** "14:30" and "2:30 PM" both occur in stored slots. Returns minutes since midnight, or null. */
export const slotMinutes = (slotTime) => {
  const match = String(slotTime || '').trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/)
  if (!match) return null
  let hour = Number(match[1])
  const meridiem = match[3]?.toLowerCase()
  if (meridiem === 'pm' && hour < 12) hour += 12
  if (meridiem === 'am' && hour === 12) hour = 0
  return hour * 60 + Number(match[2])
}

const isCancelled = (appointment) => appointment.cancelled === true || appointment.appointmentStatus === 'Cancelled'
const isFinished = (appointment) => appointment.isCompleted === true || appointment.appointmentStatus === 'Finished'
const isRefunded = (appointment) => appointment.refundStatus === 'Refunded'
const isCollected = (appointment) => appointment.paymentStatus === 'Paid' && !isRefunded(appointment)
const amountOf = (appointment) => Number(appointment.amount || 0)

const percentChange = (current, previous) => {
  if (!previous) return current ? null : 0
  return Math.round(((current - previous) / previous) * 100)
}

const idTime = (row) => (typeof row?._id?.getTimestamp === 'function' ? row._id.getTimestamp().getTime() : 0)

const statusLabel = (appointment) => {
  if (isCancelled(appointment)) return 'Cancelled'
  if (isFinished(appointment)) return 'Finished'
  return appointment.appointmentStatus || 'Booked'
}

const summarizeVisit = (appointment) => ({
  _id: appointment._id,
  slotDate: appointment.slotDate,
  slotTime: appointment.slotTime,
  status: statusLabel(appointment),
  type: appointment.appointmentType || 'Clinic',
  paymentStatus: appointment.paymentStatus,
  amount: amountOf(appointment),
  patientName: appointment.userData?.name || '',
  doctorName: appointment.docData?.name || '',
  doctorNameI18n: appointment.docData?.i18n?.name || null,
  doctorImage: appointment.docData?.image || ''
})

const countBy = (rows, keyFn) => {
  const counts = new Map()
  rows.forEach((row) => {
    const key = keyFn(row)
    if (key) counts.set(key, (counts.get(key) || 0) + 1)
  })
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
}

const buildToday = (appointments, todayKey, nowMinutes) => {
  const rows = appointments.filter((appointment) => slotDateKey(appointment.slotDate) === todayKey)
  const active = rows.filter((appointment) => !isCancelled(appointment))
  const byHour = new Map()
  active.forEach((appointment) => {
    const minutes = slotMinutes(appointment.slotTime)
    if (minutes === null) return
    const hour = Math.floor(minutes / 60)
    byHour.set(hour, (byHour.get(hour) || 0) + 1)
  })
  const byMinutes = (a, b) => (slotMinutes(a.slotTime) ?? 0) - (slotMinutes(b.slotTime) ?? 0)

  return {
    date: todayKey,
    total: rows.length,
    booked: active.filter((a) => statusLabel(a) === 'Booked').length,
    checkedIn: active.filter((a) => statusLabel(a) === 'Checked In').length,
    inProgress: active.filter((a) => statusLabel(a) === 'In Progress').length,
    finished: active.filter(isFinished).length,
    cancelled: rows.length - active.length,
    expectedRevenue: active.filter((a) => !isRefunded(a)).reduce((sum, a) => sum + amountOf(a), 0),
    collectedRevenue: active.filter(isCollected).reduce((sum, a) => sum + amountOf(a), 0),
    byHour: [...byHour.entries()].sort(([a], [b]) => a - b).map(([hour, count]) => ({ hour, count })),
    next: active
      .filter((a) => !isFinished(a) && (slotMinutes(a.slotTime) ?? 0) >= nowMinutes - 30)
      .sort(byMinutes)
      .slice(0, 6)
      .map(summarizeVisit)
  }
}

const buildPulse = (appointments, users, now, windowDays) => {
  const start = now - windowDays * DAY_MS
  const previousStart = start - windowDays * DAY_MS
  const within = (ms, from, to) => ms >= from && ms < to
  const measure = (from, to) => {
    const booked = appointments.filter((a) => within(Number(a.date || 0), from, to))
    const paid = appointments.filter((a) => isCollected(a) && within(Number(a.paidAt || a.date || 0), from, to))
    return {
      bookings: booked.length,
      cancellations: booked.filter(isCancelled).length,
      revenue: paid.reduce((sum, a) => sum + amountOf(a), 0),
      newPatients: users.filter((user) => within(idTime(user), from, to)).length
    }
  }
  const current = measure(start, now + 1)
  const previous = measure(previousStart, start)
  return Object.fromEntries(
    Object.keys(current).map((key) => [
      key,
      { current: current[key], previous: previous[key], change: percentChange(current[key], previous[key]) }
    ])
  )
}

const buildSeries = (appointments, now, days) => {
  const series = new Map()
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    series.set(clinicDateKey(now - offset * DAY_MS), { date: clinicDateKey(now - offset * DAY_MS), bookings: 0, cancelled: 0, revenue: 0 })
  }
  appointments.forEach((appointment) => {
    const created = series.get(clinicDateKey(Number(appointment.date || 0)))
    if (created) {
      created.bookings += 1
      if (isCancelled(appointment)) created.cancelled += 1
    }
    if (isCollected(appointment)) {
      const paidOn = series.get(clinicDateKey(Number(appointment.paidAt || appointment.date || 0)))
      if (paidOn) paidOn.revenue += amountOf(appointment)
    }
  })
  return [...series.values()]
}

/** Visits by weekday and hour, over the last `days`: where the clinic is actually busy. */
const buildHeatmap = (appointments, todayKey, days) => {
  const today = new Date(`${todayKey}T12:00:00Z`).getTime()
  const counts = new Map()
  appointments.forEach((appointment) => {
    if (isCancelled(appointment)) return
    const key = slotDateKey(appointment.slotDate)
    const minutes = slotMinutes(appointment.slotTime)
    if (!key || minutes === null) return
    const date = new Date(`${key}T12:00:00Z`).getTime()
    if (date > today || today - date > days * DAY_MS) return
    const cell = `${new Date(date).getUTCDay()}-${Math.floor(minutes / 60)}`
    counts.set(cell, (counts.get(cell) || 0) + 1)
  })
  return [...counts.entries()].map(([cell, count]) => {
    const [weekday, hour] = cell.split('-').map(Number)
    return { weekday, hour, count }
  })
}

const buildDoctorBoard = (appointments, doctors, now, days) => {
  const since = now - days * DAY_MS
  const board = new Map()
  appointments.forEach((appointment) => {
    if (Number(appointment.date || 0) < since) return
    const docId = String(appointment.docId || '')
    if (!docId) return
    const row = board.get(docId) || {
      docId,
      name: appointment.docData?.name || '',
      nameI18n: appointment.docData?.i18n?.name || null,
      image: appointment.docData?.image || '',
      speciality: appointment.docData?.speciality || '',
      visits: 0,
      cancelled: 0,
      revenue: 0
    }
    row.visits += 1
    if (isCancelled(appointment)) row.cancelled += 1
    if (isCollected(appointment)) row.revenue += amountOf(appointment)
    board.set(docId, row)
  })
  const byId = new Map(doctors.map((doctor) => [String(doctor._id), doctor]))
  return [...board.values()]
    .map((row) => {
      const doctor = byId.get(row.docId)
      return {
        ...row,
        name: doctor?.name || row.name,
        nameI18n: doctor?.i18n?.name || row.nameI18n,
        image: doctor?.image || row.image,
        speciality: doctor?.speciality || row.speciality,
        specialityI18n: doctor?.i18n?.speciality || null,
        cancelRate: row.visits ? Math.round((row.cancelled / row.visits) * 100) : 0
      }
    })
    .sort((a, b) => b.visits - a.visits || b.revenue - a.revenue)
}

const buildAttention = ({ appointments, doctors, users, failedLogins, pendingTranslations, adminMfaOn, todayKey }) => {
  const isPast = (appointment) => {
    const key = slotDateKey(appointment.slotDate)
    return Boolean(key) && key < todayKey
  }
  const open = appointments.filter((a) => !isCancelled(a) && !isFinished(a))
  const items = [
    {
      key: 'staleAppointments',
      tone: 'warning',
      path: '/actual-appointments',
      count: open.filter(isPast).length
    },
    {
      key: 'unpaidVisits',
      tone: 'warning',
      path: '/finished-appointments',
      count: appointments.filter((a) => isFinished(a) && a.paymentStatus !== 'Paid').length
    },
    {
      key: 'refundProblems',
      tone: 'danger',
      path: '/all-appointments',
      count: appointments.filter((a) => a.refundStatus === 'Refund Failed' || a.refundStatus === 'Refund Pending').length
    },
    {
      key: 'insuranceReviews',
      tone: 'info',
      path: '/patients',
      count: users.filter((user) => user.insurance?.enabled && user.insurance?.verificationStatus === 'pending').length
    },
    {
      key: 'doctorsNotBookable',
      tone: 'warning',
      path: '/doctor-list',
      count: doctors.filter((doctor) => doctor.available === false).length
    },
    {
      key: 'doctorsWithoutClinic',
      tone: 'info',
      path: '/clinics',
      count: doctors.filter((doctor) => !(doctor.clinics || []).length).length
    },
    { key: 'failedLogins', tone: 'danger', path: '/audit-logs', count: failedLogins },
    { key: 'pendingTranslations', tone: 'info', path: '/language-settings', count: pendingTranslations },
    { key: 'adminMfaOff', tone: 'danger', path: '/admin-profile', count: adminMfaOn ? 0 : 1 }
  ]
  return items.filter((item) => item.count > 0)
}

/** Sentences worth saying out loud. Each needs enough data to mean something, so none are padding. */
const buildInsights = ({ pulse, heatmap, doctorBoard, appointments }) => {
  const insights = []

  const { bookings, revenue, cancellations } = pulse
  if (bookings.previous >= 3 && bookings.change !== null && Math.abs(bookings.change) >= 10) {
    insights.push({
      key: bookings.change > 0 ? 'bookingsUp' : 'bookingsDown',
      tone: bookings.change > 0 ? 'success' : 'warning',
      vars: { pct: Math.abs(bookings.change), count: bookings.current, previous: bookings.previous }
    })
  }
  if (revenue.previous > 0 && revenue.change !== null && Math.abs(revenue.change) >= 10) {
    insights.push({
      key: revenue.change > 0 ? 'revenueUp' : 'revenueDown',
      tone: revenue.change > 0 ? 'success' : 'warning',
      vars: { pct: Math.abs(revenue.change) }
    })
  }
  if (bookings.current >= 5 && cancellations.current / bookings.current >= 0.2) {
    insights.push({
      key: 'cancellationsHigh',
      tone: 'danger',
      vars: { pct: Math.round((cancellations.current / bookings.current) * 100), count: cancellations.current }
    })
  }

  const totalVisits = heatmap.reduce((sum, cell) => sum + cell.count, 0)
  if (totalVisits >= 10) {
    const busiest = heatmap.reduce((best, cell) => (cell.count > best.count ? cell : best), heatmap[0])
    insights.push({ key: 'busiestSlot', tone: 'info', vars: { weekday: busiest.weekday, hour: busiest.hour, count: busiest.count } })
  }

  const leader = doctorBoard[0]
  const totalBooked = doctorBoard.reduce((sum, row) => sum + row.visits, 0)
  if (leader && doctorBoard.length >= 2 && totalBooked >= 10) {
    insights.push({
      key: 'doctorLead',
      tone: 'info',
      vars: { name: leader.name, nameI18n: leader.nameI18n, pct: Math.round((leader.visits / totalBooked) * 100) }
    })
  }
  const struggling = doctorBoard.find((row) => row.visits >= 5 && row.cancelRate >= 30)
  if (struggling) {
    insights.push({
      key: 'doctorCancellations',
      tone: 'warning',
      vars: { name: struggling.name, nameI18n: struggling.nameI18n, pct: struggling.cancelRate }
    })
  }

  const remote = appointments.filter((a) => !isCancelled(a) && ['Voice Call', 'Video Call'].includes(a.appointmentType)).length
  const live = appointments.filter((a) => !isCancelled(a)).length
  if (live >= 10 && remote / live >= 0.25) {
    insights.push({ key: 'remoteShare', tone: 'info', vars: { pct: Math.round((remote / live) * 100) } })
  }
  return insights
}

export function buildCommandCenter({
  now = Date.now(),
  appointments = [],
  doctors = [],
  users = [],
  activity = [],
  failedLogins = 0,
  pendingTranslations = 0,
  adminMfaOn = false,
  windowDays = 7,
  seriesDays = 30,
  heatmapDays = 90
}) {
  const parts = clinicDateParts(now)
  const todayKey = keyOf(parts)
  const today = buildToday(appointments, todayKey, parts.hour * 60 + parts.minute)
  const pulse = buildPulse(appointments, users, now, windowDays)
  const heatmap = buildHeatmap(appointments, todayKey, heatmapDays)
  const doctorBoard = buildDoctorBoard(appointments, doctors, now, seriesDays)
  const live = appointments.filter((a) => !isCancelled(a))

  return {
    generatedAt: now,
    today,
    pulse,
    series: buildSeries(appointments, now, seriesDays),
    heatmap,
    doctors: doctorBoard.slice(0, 6),
    mix: {
      types: countBy(live, (a) => a.appointmentType || 'Clinic'),
      payments: countBy(appointments.filter(isCollected), (a) => a.paymentMethod || 'Other'),
      bookedBy: countBy(live, (a) => a.bookedBy || 'Patient')
    },
    totals: {
      doctors: doctors.length,
      doctorsAvailable: doctors.filter((doctor) => doctor.available !== false).length,
      patients: users.length,
      activePatients: users.filter((user) => user.isActive !== false).length,
      appointments: appointments.length,
      revenue: appointments.filter(isCollected).reduce((sum, a) => sum + amountOf(a), 0)
    },
    attention: buildAttention({ appointments, doctors, users, failedLogins, pendingTranslations, adminMfaOn, todayKey }),
    insights: buildInsights({ pulse, heatmap, doctorBoard, appointments }),
    activity
  }
}
