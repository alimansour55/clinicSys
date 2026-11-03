import healthReminderModel from '../models/healthReminderModel.js'
import { pushNotification } from './notificationService.js'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const HISTORY_LIMIT = 90

/** A dose nobody responded to rolls forward after this long, so one missed day does not stay "due" for ever. */
const graceFor = (frequency) => (frequency === 'daily' ? 6 * HOUR : 7 * DAY)

const parseDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) }
}

const parseTime = (value) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''))
  if (!match) return null
  return { hours: Number(match[1]), minutes: Number(match[2]) }
}

const localToUtc = ({ year, month, day }, { hours, minutes }, tzOffsetMinutes) =>
  Date.UTC(year, month, day, hours, minutes) + tzOffsetMinutes * MINUTE

const addDays = ({ year, month, day }, days) => {
  const date = new Date(Date.UTC(year, month, day + days))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() }
}

/** Same day-of-month, clamped: a monthly reminder started on the 31st falls on the 28th in February. */
const addMonths = (start, months) => {
  const first = new Date(Date.UTC(start.year, start.month + months, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return { year: first.getUTCFullYear(), month: first.getUTCMonth(), day: Math.min(start.day, lastDay) }
}

/**
 * The first occurrence strictly after `afterMs`, as a UTC timestamp, or 0 when the schedule has finished.
 * Pure, so the rules can be tested without a database.
 */
export const computeNextDue = (reminder, afterMs) => {
  const start = parseDate(reminder.startDate)
  if (!start) return 0

  const tz = Number(reminder.tzOffsetMinutes) || 0
  const times = (reminder.times || []).map(parseTime).filter(Boolean).sort((a, b) => a.hours - b.hours || a.minutes - b.minutes)
  if (!times.length) return 0

  const end = parseDate(reminder.endDate)
  const lastAllowed = end ? localToUtc(end, { hours: 23, minutes: 59 }, tz) : Infinity

  if (reminder.frequency === 'once') {
    const at = localToUtc(start, times[0], tz)
    return at > afterMs ? at : 0
  }

  const stepDays = reminder.frequency === 'weekly' ? 7 : 1
  const startMs = localToUtc(start, { hours: 0, minutes: 0 }, tz)
  let index = 0
  if (reminder.frequency !== 'monthly' && afterMs > startMs) {
    index = Math.max(0, Math.floor((afterMs - startMs) / (stepDays * DAY)) - 1)
  } else if (reminder.frequency === 'monthly' && afterMs > startMs) {
    index = Math.max(0, Math.floor((afterMs - startMs) / (31 * DAY)) - 1)
  }

  // A small search window: at most a few steps past the estimate above.
  for (let guard = 0; guard < 400; guard += 1, index += 1) {
    const date = reminder.frequency === 'monthly' ? addMonths(start, index) : addDays(start, index * stepDays)
    for (const time of times) {
      const at = localToUtc(date, time, tz)
      if (at > lastAllowed) return 0
      if (at > afterMs) return at
    }
  }
  return 0
}

const withHistory = (reminder, entry) => {
  reminder.history = [...(reminder.history || []), entry].slice(-HISTORY_LIMIT)
}

/** Records taken or skipped for the current occurrence, and moves on to the next. */
export const applyReminderAction = (reminder, action, now = Date.now()) => {
  const dueAt = reminder.nextDueAt || now
  withHistory(reminder, { dueAt, at: now, action })
  const next = computeNextDue(reminder, Math.max(now, dueAt))
  reminder.nextDueAt = next
  reminder.notifiedForDueAt = 0
  if (!next) reminder.active = false
  return reminder
}

/**
 * Called when the app opens or polls. There is no scheduler on serverless hosting, so reminders become
 * notifications the next time the patient is here. Each occurrence notifies once, even across several tabs.
 */
export const syncDueReminders = async (ownerId, { now = Date.now(), tzOffsetMinutes } = {}) => {
  const due = await healthReminderModel.find({ ownerId, active: true, nextDueAt: { $gt: 0, $lte: now } })
  let notified = 0

  for (const reminder of due) {
    // Egypt changes its clocks, so follow the patient's current offset.
    if (Number.isFinite(tzOffsetMinutes) && tzOffsetMinutes !== reminder.tzOffsetMinutes) {
      reminder.tzOffsetMinutes = tzOffsetMinutes
    }

    if (reminder.frequency !== 'once' && now - reminder.nextDueAt > graceFor(reminder.frequency)) {
      withHistory(reminder, { dueAt: reminder.nextDueAt, at: now, action: 'missed' })
      reminder.nextDueAt = computeNextDue(reminder, now)
      reminder.notifiedForDueAt = 0
      if (!reminder.nextDueAt) reminder.active = false
      await reminder.save()
      continue
    }

    const claimed = await healthReminderModel.updateOne(
      { _id: reminder._id, ownerId, nextDueAt: reminder.nextDueAt, notifiedForDueAt: { $ne: reminder.nextDueAt } },
      { notifiedForDueAt: reminder.nextDueAt }
    )
    if (!claimed.modifiedCount) continue

    notified += 1
    await pushNotification({
      recipientRole: 'patient',
      recipientId: ownerId,
      title: 'Reminder',
      message: reminder.title,
      type: 'health_reminder',
      meta: { reminderId: String(reminder._id), kind: reminder.kind, memberId: reminder.memberId, dueAt: reminder.nextDueAt }
    })
  }

  return { notified }
}
