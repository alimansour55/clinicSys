/** Plain rules behind the health hub, kept free of React so they can be tested on their own. */

const DAY = 24 * 60 * 60 * 1000

export const todayIso = (now = new Date()) => {
  const offsetMs = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10)
}

export const formatIsoDate = (iso, language, options = { year: 'numeric', month: 'short', day: 'numeric' }) => {
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', options)
}

export const nextUpcomingVisit = (events = [], today = todayIso()) =>
  events
    .filter((event) => event.type === 'visit' && event.status === 'upcoming' && event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time)))[0] || null

export const dueReminders = (reminders = [], now = Date.now()) =>
  reminders.filter((reminder) => reminder.active && reminder.nextDueAt && reminder.nextDueAt <= now)

/** Reminders still to come today, soonest first. */
export const laterToday = (reminders = [], now = new Date()) => {
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)
  return reminders
    .filter((reminder) => reminder.active && reminder.nextDueAt > now.getTime() && reminder.nextDueAt <= endOfDay.getTime())
    .sort((a, b) => a.nextDueAt - b.nextDueAt)
}

/** Days until a date string, or null when a doctor wrote something that is not a date. */
const daysUntil = (value, now) => {
  const time = Date.parse(String(value || ''))
  if (Number.isNaN(time)) return null
  return Math.ceil((time - now) / DAY)
}

/**
 * What deserves the patient's attention now, most urgent first.
 * Each item is { key, tone, title, description, action, tab | to }, with English keys for t().
 */
export const buildAttention = ({ userData, hub, now = Date.now() }) => {
  const items = []
  if (!userData || !hub) return items

  const due = dueReminders(hub.reminders, now)
  if (due.length) {
    items.push({ key: 'reminders-due', tone: 'accent', title: 'You have a reminder waiting', description: 'Mark it as taken or skip it.', action: 'Open reminders', tab: 'reminders' })
  }

  const finished = (hub.events || []).filter((event) => event.type === 'visit' && event.status === 'finished' && event.prescription?.nextVisit)
  const latest = finished.sort((a, b) => b.date.localeCompare(a.date))[0]
  if (latest) {
    const days = daysUntil(latest.prescription.nextVisit, now)
    const alreadyBooked = (hub.events || []).some((event) => event.type === 'visit' && event.status === 'upcoming' && event.docId === latest.docId)
    if (days !== null && days <= 14 && days > -60 && !alreadyBooked) {
      items.push({ key: 'follow-up', tone: 'accent', title: 'Your follow-up visit is due', description: 'Your doctor asked to see you again. Book a time that suits you.', action: 'Book a follow-up', to: `/appointment/${latest.docId}`, doctorName: latest.doctorName })
    }
  }

  const insurance = userData.insurance || {}
  if (insurance.enabled) {
    const days = daysUntil(insurance.expiryDate, now)
    if (insurance.verificationStatus === 'declined') {
      items.push({ key: 'insurance-declined', tone: 'danger', title: 'Your insurance was declined', description: 'See the reason and update your details.', action: 'Review insurance', to: '/insurance' })
    } else if (days !== null && days < 0) {
      items.push({ key: 'insurance-expired', tone: 'danger', title: 'Your insurance card has expired', description: 'Update it so it can be used on your next visit.', action: 'Update insurance', to: '/insurance' })
    } else if (days !== null && days <= 30) {
      items.push({ key: 'insurance-expiring', tone: 'warning', title: 'Your insurance card expires soon', description: 'Renew it before your next visit.', action: 'Update insurance', to: '/insurance' })
    }
  }

  if (!String(userData.medicalHistory?.allergies || '').trim()) {
    items.push({ key: 'allergies', tone: 'warning', title: 'Tell your doctors about allergies', description: 'It takes a minute and can prevent a serious mistake.', action: 'Add allergies', to: '/medical-history' })
  }
  if (!hub.emergency?.contactPhone) {
    items.push({ key: 'emergency', tone: 'neutral', title: 'Add an emergency contact', description: 'It goes on your health passport.', action: 'Add a contact', tab: 'passport' })
  }
  if (!hub.phoneVerified) {
    items.push({ key: 'phone', tone: 'neutral', title: 'Confirm your phone number', description: 'So the clinic can reach you about your visits.', action: 'Confirm it', tab: 'security' })
  }
  if (!userData.mfa?.enabled) {
    items.push({ key: 'mfa', tone: 'neutral', title: 'Add a second lock to your account', description: 'Your health records deserve more than a password.', action: 'Turn it on', tab: 'security' })
  }
  return items
}

/** Turns what a doctor wrote ("3 times a day") into suggested times. Unknown wording falls back to one dose. */
export const suggestTimes = (frequency = '') => {
  const text = String(frequency).toLowerCase()
  const match = text.match(/(\d+)/)
  let count = match ? Number(match[1]) : 0
  if (!count) {
    if (/(once|مرة واحدة|مرة)/.test(text)) count = 1
    if (/(twice|مرتين)/.test(text)) count = 2
    if (/(three|ثلاث)/.test(text)) count = 3
    if (/(four|أربع)/.test(text)) count = 4
  }
  if (/every\s*(\d+)\s*h/.test(text)) {
    count = Math.round(24 / Number(text.match(/every\s*(\d+)\s*h/)[1]))
  }
  const plans = {
    2: ['09:00', '21:00'],
    3: ['08:00', '14:00', '20:00'],
    4: ['08:00', '12:00', '16:00', '20:00']
  }
  return plans[count] || ['09:00']
}

/** "7 days" or "2 weeks" from a start date. Returns '' when the course length cannot be read. */
export const suggestEndDate = (duration = '', startIso = todayIso()) => {
  const text = String(duration).toLowerCase()
  const match = text.match(/(\d+)/)
  if (!match) return ''
  const amount = Number(match[1])
  let days = 0
  if (/(day|يوم|أيام)/.test(text)) days = amount
  else if (/(week|أسبوع|أسابيع)/.test(text)) days = amount * 7
  else if (/(month|شهر|أشهر|شهور)/.test(text)) days = amount * 30
  if (!days) return ''
  const start = new Date(`${startIso}T00:00:00Z`)
  return new Date(start.getTime() + (days - 1) * DAY).toISOString().slice(0, 10)
}

export const reminderFromMedication = (item, startIso = todayIso()) => ({
  kind: 'medication',
  title: [item.name, item.dosage].filter(Boolean).join(' '),
  note: item.instructions || '',
  frequency: 'daily',
  times: suggestTimes(item.frequency),
  startDate: startIso,
  endDate: suggestEndDate(item.duration, startIso)
})

/** Taken share of recent answered doses, or null when there is nothing to report yet. */
export const adherence = (reminder, sample = 14) => {
  const recent = (reminder.history || []).slice(-sample)
  if (!recent.length) return null
  return Math.round((recent.filter((entry) => entry.action === 'taken').length / recent.length) * 100)
}

/** Latest and previous value for one reading, plus its points for a trend line. */
export const vitalSeries = (entries = [], key) => {
  const points = entries
    .filter((entry) => Number.isFinite(entry.vitals?.[key]))
    .map((entry) => ({ date: entry.date, value: entry.vitals[key] }))
  return { points, latest: points.at(-1)?.value ?? null }
}

/**
 * The text inside the passport QR code. It carries the facts themselves rather than a link,
 * so it reads with no connection and no account, and nothing leaves the patient's device.
 */
export const passportText = ({ labels, name, dob, bloodType, allergies, conditions, medications, contactName, contactPhone }) => {
  const line = (label, value) => (String(value || '').trim() ? `${label}: ${String(value).trim().replace(/\s+/g, ' ').slice(0, 160)}` : '')
  return [
    labels.title,
    line(labels.name, name),
    line(labels.dob, dob),
    line(labels.blood, bloodType),
    line(labels.allergies, allergies),
    line(labels.conditions, conditions),
    line(labels.medications, medications),
    line(labels.contact, [contactName, contactPhone].filter(Boolean).join(' '))
  ].filter(Boolean).join('\n')
}
