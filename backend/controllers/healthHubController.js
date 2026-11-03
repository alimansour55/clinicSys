import mongoose from 'mongoose'
import appointmentModel from '../models/appointmentModel.js'
import auditLogModel from '../models/auditLogModel.js'
import familyMemberModel, { BLOOD_TYPES, FAMILY_RELATIONS } from '../models/familyMemberModel.js'
import healthEntryModel, { HEALTH_ENTRY_TYPES } from '../models/healthEntryModel.js'
import healthReminderModel, { REMINDER_FREQUENCIES, REMINDER_KINDS } from '../models/healthReminderModel.js'
import prescriptionModel from '../models/prescriptionModel.js'
import userModel from '../models/userModel.js'
import { logAudit } from '../services/auditService.js'
import { consumeQuota } from '../services/authThrottleService.js'
import { applyReminderAction, computeNextDue, syncDueReminders } from '../services/healthReminderService.js'

const HOUR = 60 * 60 * 1000
const MAX_FAMILY_MEMBERS = 12
const MAX_ENTRIES = 3000
const MAX_REMINDERS = 60
const TIMELINE_LIMIT = 400

const VITAL_LIMITS = {
  systolic: [40, 300],
  diastolic: [20, 200],
  glucose: [10, 1000],
  weight: [0.5, 500],
  heartRate: [20, 300],
  temperature: [25, 45]
}

const SECURITY_ACTIONS = ['login_success', 'login_failed', 'password_reset', 'password_change', 'mfa_enable', 'mfa_disable', 'sign_out_everywhere', 'mfa_login_failed']

const asText = (value, max = 200) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) : '')
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
const todayPlusOne = () => new Date(Date.now() + 24 * HOUR).toISOString().slice(0, 10)

const failed = (res, label, error) => {
  console.error(`${label}:`, error.message)
  return res.json({ success: false, message: 'Something went wrong. Please try again.' })
}

/** The member must belong to this patient. Returns '' for the patient, null when it is not theirs. */
const resolveMemberId = async (ownerId, raw) => {
  const memberId = asText(raw, 40)
  if (!memberId) return ''
  if (!mongoose.isValidObjectId(memberId)) return null
  const member = await familyMemberModel.exists({ _id: memberId, ownerId })
  return member ? memberId : null
}

const validId = (id) => mongoose.isValidObjectId(id)

const NOT_FOUND = { success: false, message: 'Not found' }

// ---- Family ----

const readFamilyBody = (body = {}) => ({
  name: asText(body.name, 120),
  relation: FAMILY_RELATIONS.includes(body.relation) ? body.relation : 'other',
  dob: asText(body.dob, 10),
  gender: ['Male', 'Female'].includes(body.gender) ? body.gender : 'Not Selected',
  bloodType: BLOOD_TYPES.includes(body.bloodType) ? body.bloodType : '',
  allergies: asText(body.allergies, 2000),
  conditions: asText(body.conditions, 2000),
  medications: asText(body.medications, 2000),
  notes: asText(body.notes, 2000)
})

const familyError = (member) => {
  if (!member.name) return 'Please enter a name'
  if (member.dob && (!isDate(member.dob) || member.dob >= todayPlusOne())) return 'Birth date must be in the past'
  return ''
}

export const listFamily = async (req, res) => {
  try {
    const members = await familyMemberModel.find({ ownerId: req.user.userId }).sort({ createdAt: 1 }).lean()
    return res.json({ success: true, members })
  } catch (error) {
    return failed(res, 'List family', error)
  }
}

export const createFamilyMember = async (req, res) => {
  try {
    const ownerId = req.user.userId
    const data = readFamilyBody(req.body)
    const problem = familyError(data)
    if (problem) return res.json({ success: false, message: problem })

    if ((await familyMemberModel.countDocuments({ ownerId })) >= MAX_FAMILY_MEMBERS) {
      return res.json({ success: false, message: 'You have reached the limit of family profiles' })
    }

    const member = await familyMemberModel.create({ ...data, ownerId })
    return res.json({ success: true, message: 'Family member added', member })
  } catch (error) {
    return failed(res, 'Create family member', error)
  }
}

export const updateFamilyMember = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.json(NOT_FOUND)
    const data = readFamilyBody(req.body)
    const problem = familyError(data)
    if (problem) return res.json({ success: false, message: problem })

    const member = await familyMemberModel.findOneAndUpdate({ _id: req.params.id, ownerId: req.user.userId }, data, { new: true })
    if (!member) return res.json(NOT_FOUND)
    return res.json({ success: true, message: 'Family member updated', member })
  } catch (error) {
    return failed(res, 'Update family member', error)
  }
}

export const deleteFamilyMember = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.json(NOT_FOUND)
    const ownerId = req.user.userId
    const member = await familyMemberModel.findOneAndDelete({ _id: req.params.id, ownerId })
    if (!member) return res.json(NOT_FOUND)

    await Promise.all([
      healthEntryModel.deleteMany({ ownerId, memberId: req.params.id }),
      healthReminderModel.deleteMany({ ownerId, memberId: req.params.id })
    ])
    return res.json({ success: true, message: 'Family member removed' })
  } catch (error) {
    return failed(res, 'Delete family member', error)
  }
}

// ---- Journal entries ----

const readVitals = (raw = {}) => {
  const vitals = {}
  for (const [key, [min, max]] of Object.entries(VITAL_LIMITS)) {
    if (raw[key] === '' || raw[key] === undefined || raw[key] === null) continue
    const number = Number(raw[key])
    if (!Number.isFinite(number) || number < min || number > max) return { error: `vital:${key}` }
    vitals[key] = number
  }
  return { vitals }
}

export const listEntries = async (req, res) => {
  try {
    const filter = { ownerId: req.user.userId }
    if (req.query.memberId !== undefined) {
      const memberId = await resolveMemberId(req.user.userId, req.query.memberId)
      if (memberId === null) return res.json({ success: true, entries: [] })
      filter.memberId = memberId
    }
    if (HEALTH_ENTRY_TYPES.includes(req.query.type)) filter.type = req.query.type
    const entries = await healthEntryModel.find(filter).sort({ date: -1, createdAt: -1 }).limit(500).lean()
    return res.json({ success: true, entries })
  } catch (error) {
    return failed(res, 'List entries', error)
  }
}

export const createEntry = async (req, res) => {
  try {
    const ownerId = req.user.userId
    const body = req.body || {}
    const memberId = await resolveMemberId(ownerId, body.memberId)
    if (memberId === null) return res.json(NOT_FOUND)

    const type = body.type
    if (!HEALTH_ENTRY_TYPES.includes(type)) return res.json({ success: false, message: 'Please choose an entry type' })

    const date = asText(body.date, 10)
    if (!isDate(date) || date >= todayPlusOne()) return res.json({ success: false, message: 'Please choose a date that is not in the future' })

    const title = asText(body.title, 160)
    const note = asText(body.note, 2000)
    const entry = { ownerId, memberId, type, date, title, note }

    if (type === 'vitals') {
      const { vitals, error } = readVitals(body.vitals)
      if (error) return res.json({ success: false, message: 'One of the readings looks out of range. Please check it.', field: error })
      if (!Object.keys(vitals).length) return res.json({ success: false, message: 'Please enter at least one reading' })
      entry.vitals = vitals
    } else if (!title && !note) {
      return res.json({ success: false, message: 'Please add a title or a note' })
    }

    if ((await healthEntryModel.countDocuments({ ownerId })) >= MAX_ENTRIES) {
      return res.json({ success: false, message: 'Your journal is full. Please remove some older entries.' })
    }

    const created = await healthEntryModel.create(entry)
    return res.json({ success: true, message: 'Saved to your timeline', entry: created })
  } catch (error) {
    return failed(res, 'Create entry', error)
  }
}

export const deleteEntry = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.json(NOT_FOUND)
    const removed = await healthEntryModel.findOneAndDelete({ _id: req.params.id, ownerId: req.user.userId })
    if (!removed) return res.json(NOT_FOUND)
    return res.json({ success: true, message: 'Entry removed' })
  } catch (error) {
    return failed(res, 'Delete entry', error)
  }
}

// ---- Reminders ----

const readReminderBody = (body = {}) => {
  const times = (Array.isArray(body.times) ? body.times : [])
    .map((value) => asText(value, 5))
    .filter((value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value))
  return {
    kind: REMINDER_KINDS.includes(body.kind) ? body.kind : 'other',
    title: asText(body.title, 160),
    note: asText(body.note, 500),
    frequency: REMINDER_FREQUENCIES.includes(body.frequency) ? body.frequency : 'daily',
    times: [...new Set(times)].slice(0, 6),
    startDate: asText(body.startDate, 10),
    endDate: asText(body.endDate, 10),
    tzOffsetMinutes: Number.isFinite(Number(body.tzOffsetMinutes)) ? Math.max(-840, Math.min(840, Number(body.tzOffsetMinutes))) : -120
  }
}

const reminderError = (data) => {
  if (!data.title) return 'Please say what this reminder is for'
  if (!data.times.length) return 'Please choose a time'
  if (!isDate(data.startDate)) return 'Please choose a start date'
  if (data.endDate && (!isDate(data.endDate) || data.endDate < data.startDate)) return 'The end date must be after the start date'
  return ''
}

export const listReminders = async (req, res) => {
  try {
    const reminders = await healthReminderModel.find({ ownerId: req.user.userId }).sort({ active: -1, nextDueAt: 1 }).lean()
    return res.json({ success: true, reminders })
  } catch (error) {
    return failed(res, 'List reminders', error)
  }
}

export const createReminder = async (req, res) => {
  try {
    const ownerId = req.user.userId
    const memberId = await resolveMemberId(ownerId, req.body?.memberId)
    if (memberId === null) return res.json(NOT_FOUND)

    const data = readReminderBody(req.body)
    const problem = reminderError(data)
    if (problem) return res.json({ success: false, message: problem })

    if ((await healthReminderModel.countDocuments({ ownerId })) >= MAX_REMINDERS) {
      return res.json({ success: false, message: 'You have reached the limit of reminders' })
    }

    const nextDueAt = computeNextDue(data, Date.now())
    if (!nextDueAt) return res.json({ success: false, message: 'That time has already passed. Please choose a later one.' })

    const reminder = await healthReminderModel.create({ ...data, ownerId, memberId, nextDueAt })
    return res.json({ success: true, message: 'Reminder set', reminder })
  } catch (error) {
    return failed(res, 'Create reminder', error)
  }
}

export const updateReminder = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.json(NOT_FOUND)
    const ownerId = req.user.userId
    const reminder = await healthReminderModel.findOne({ _id: req.params.id, ownerId })
    if (!reminder) return res.json(NOT_FOUND)

    // Pausing and resuming send only `active`, so an edit does not have to resend the schedule.
    if (req.body?.title !== undefined) {
      const memberId = await resolveMemberId(ownerId, req.body.memberId)
      if (memberId === null) return res.json(NOT_FOUND)
      const data = readReminderBody(req.body)
      const problem = reminderError(data)
      if (problem) return res.json({ success: false, message: problem })
      Object.assign(reminder, data, { memberId })
    }
    if (typeof req.body?.active === 'boolean') reminder.active = req.body.active

    if (reminder.active) {
      reminder.nextDueAt = computeNextDue(reminder, Date.now())
      reminder.notifiedForDueAt = 0
      if (!reminder.nextDueAt) return res.json({ success: false, message: 'That schedule has already finished. Please change the dates.' })
    }

    await reminder.save()
    return res.json({ success: true, message: 'Reminder updated', reminder })
  } catch (error) {
    return failed(res, 'Update reminder', error)
  }
}

export const respondToReminder = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.json(NOT_FOUND)
    const action = req.body?.action
    if (!['taken', 'skipped'].includes(action)) return res.json({ success: false, message: 'Unknown action' })

    const reminder = await healthReminderModel.findOne({ _id: req.params.id, ownerId: req.user.userId })
    if (!reminder) return res.json(NOT_FOUND)
    if (!reminder.active) return res.json({ success: false, message: 'This reminder is paused' })

    applyReminderAction(reminder, action)
    await reminder.save()
    return res.json({ success: true, reminder })
  } catch (error) {
    return failed(res, 'Respond to reminder', error)
  }
}

export const deleteReminder = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.json(NOT_FOUND)
    const removed = await healthReminderModel.findOneAndDelete({ _id: req.params.id, ownerId: req.user.userId })
    if (!removed) return res.json(NOT_FOUND)
    return res.json({ success: true, message: 'Reminder removed' })
  } catch (error) {
    return failed(res, 'Delete reminder', error)
  }
}

export const syncReminders = async (req, res) => {
  try {
    const tz = Number(req.body?.tzOffsetMinutes)
    const result = await syncDueReminders(req.user.userId, { tzOffsetMinutes: Number.isFinite(tz) ? tz : undefined })
    return res.json({ success: true, ...result })
  } catch (error) {
    return failed(res, 'Sync reminders', error)
  }
}

// ---- Timeline and hub ----

/** Appointment dates are stored as D_M_YYYY. */
const slotToIso = (slotDate) => {
  const [day, month, year] = String(slotDate || '').split('_').map(Number)
  if (!day || !month || !year) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const visitStatus = (a) => {
  if (a.cancelled || a.appointmentStatus === 'Cancelled') return 'cancelled'
  if (a.isCompleted || a.appointmentStatus === 'Finished') return 'finished'
  return 'upcoming'
}

export const buildTimeline = async (ownerId, { memberId = '' } = {}) => {
  const events = []

  const entries = await healthEntryModel.find({ ownerId, memberId }).sort({ date: -1 }).limit(TIMELINE_LIMIT).lean()
  for (const entry of entries) {
    events.push({
      id: `entry-${entry._id}`,
      source: 'entry',
      type: entry.type,
      date: entry.date,
      sortAt: new Date(entry.createdAt).getTime(),
      title: entry.title,
      note: entry.note,
      vitals: entry.vitals,
      entryId: String(entry._id)
    })
  }

  // Visits, prescriptions and history belong to the patient's own record, not to a family profile.
  if (!memberId) {
    const [appointments, prescriptions, user] = await Promise.all([
      appointmentModel.find({ userId: ownerId })
        .select('slotDate slotTime appointmentType appointmentStatus cancelled isCompleted clinicLocation docId docData.name docData.speciality reservationNumber')
        .lean(),
      prescriptionModel.find({ userId: ownerId })
        .select('appointmentId slotDate diagnosis medicationItems medicines instructions nextVisit labTests docData.name createdAt')
        .lean(),
      userModel.findById(ownerId).select('medicalHistory.updatedAt medicalHistory.updatedBy insurance.updatedAt insurance.provider insurance.enabled').lean()
    ])

    const prescriptionByVisit = new Map(prescriptions.map((p) => [String(p.appointmentId), p]))

    for (const appointment of appointments) {
      const date = slotToIso(appointment.slotDate)
      if (!date) continue
      const prescription = prescriptionByVisit.get(String(appointment._id))
      events.push({
        id: `visit-${appointment._id}`,
        source: 'visit',
        type: 'visit',
        date,
        time: appointment.slotTime,
        status: visitStatus(appointment),
        appointmentType: appointment.appointmentType,
        location: appointment.clinicLocation,
        doctorName: appointment.docData?.name || '',
        speciality: appointment.docData?.speciality || '',
        docId: appointment.docId,
        appointmentId: String(appointment._id),
        prescription: prescription
          ? {
              diagnosis: prescription.diagnosis,
              medicationItems: prescription.medicationItems || [],
              medicines: prescription.medicines,
              instructions: prescription.instructions,
              nextVisit: prescription.nextVisit,
              labTests: prescription.labTests
            }
          : null
      })
    }

    if (user?.medicalHistory?.updatedAt) {
      const at = new Date(user.medicalHistory.updatedAt)
      events.push({
        id: 'history-latest',
        source: 'record',
        type: 'history',
        date: at.toISOString().slice(0, 10),
        sortAt: at.getTime(),
        updatedBy: user.medicalHistory.updatedBy
      })
    }
    if (user?.insurance?.enabled && user.insurance.updatedAt) {
      const at = new Date(user.insurance.updatedAt)
      events.push({
        id: 'insurance-latest',
        source: 'record',
        type: 'insurance',
        date: at.toISOString().slice(0, 10),
        sortAt: at.getTime(),
        provider: user.insurance.provider
      })
    }
  }

  return events
    .sort((a, b) => b.date.localeCompare(a.date) || (b.sortAt || 0) - (a.sortAt || 0))
    .slice(0, TIMELINE_LIMIT)
}

export const getTimeline = async (req, res) => {
  try {
    const memberId = await resolveMemberId(req.user.userId, req.query.memberId)
    if (memberId === null) return res.json({ success: true, events: [] })
    return res.json({ success: true, events: await buildTimeline(req.user.userId, { memberId }) })
  } catch (error) {
    return failed(res, 'Timeline', error)
  }
}

/** Everything the hub's first screen needs, in one call. */
export const getHub = async (req, res) => {
  try {
    const ownerId = req.user.userId
    const tz = Number(req.query.tz)
    await syncDueReminders(ownerId, { tzOffsetMinutes: Number.isFinite(tz) ? tz : undefined })

    const [user, members, reminders, events, vitals] = await Promise.all([
      userModel.findById(ownerId).select('onboarding emergency phoneVerified createdAt passwordChangedAt').lean(),
      familyMemberModel.find({ ownerId }).sort({ createdAt: 1 }).lean(),
      healthReminderModel.find({ ownerId }).sort({ active: -1, nextDueAt: 1 }).lean(),
      buildTimeline(ownerId),
      healthEntryModel.find({ ownerId, memberId: '', type: 'vitals' }).sort({ date: 1, createdAt: 1 }).limit(120).select('date vitals').lean()
    ])
    if (!user) return res.json({ success: false, message: 'User not found' })

    return res.json({
      success: true,
      onboarding: user.onboarding || {},
      createdAt: user.createdAt,
      emergency: user.emergency || {},
      phoneVerified: Boolean(user.phoneVerified),
      members,
      reminders,
      events,
      vitals
    })
  } catch (error) {
    return failed(res, 'Hub', error)
  }
}

export const getSecurityActivity = async (req, res) => {
  try {
    const rows = await auditLogModel.find({ actorUserId: String(req.user.userId), action: { $in: SECURITY_ACTIONS } })
      .sort({ createdAt: -1 })
      .limit(12)
      .select('action status createdAt location.city location.country userAgent')
      .lean()
    return res.json({ success: true, activity: rows })
  } catch (error) {
    return failed(res, 'Security activity', error)
  }
}

/** A complete copy of what the clinic holds about this patient, for the patient only. */
export const exportMyData = async (req, res) => {
  try {
    const ownerId = req.user.userId
    if (!(await consumeQuota('data-export', ownerId, { max: 5, windowMs: HOUR }))) {
      return res.json({ success: false, message: 'Too many exports. Please try again later.' })
    }

    const [profile, family, entries, reminders, appointments, prescriptions] = await Promise.all([
      userModel.findById(ownerId)
        .select('name email phone gender dob address patientId insurance medicalHistory emergency createdAt')
        .lean(),
      familyMemberModel.find({ ownerId }).select('-ownerId -__v').lean(),
      healthEntryModel.find({ ownerId }).select('-ownerId -__v').lean(),
      healthReminderModel.find({ ownerId }).select('-ownerId -__v -notifiedForDueAt').lean(),
      appointmentModel.find({ userId: ownerId })
        .select('reservationNumber slotDate slotTime appointmentType appointmentStatus clinicLocation amount paymentStatus paymentMethod docData.name docData.speciality')
        .lean(),
      prescriptionModel.find({ userId: ownerId })
        .select('appointmentId slotDate diagnosis symptoms medicines medicationItems instructions nextVisit labTests docData.name')
        .lean()
    ])
    if (!profile) return res.json({ success: false, message: 'User not found' })

    await logAudit({ action: 'data_export', status: 'success', actorUserId: ownerId, actorRole: 'patient', entityType: 'user', entityId: ownerId, req })
    return res.json({ success: true, exportedAt: new Date().toISOString(), data: { profile, family, entries, reminders, appointments, prescriptions } })
  } catch (error) {
    return failed(res, 'Data export', error)
  }
}
