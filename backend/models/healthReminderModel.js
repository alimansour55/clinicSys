import mongoose from 'mongoose'

export const REMINDER_KINDS = ['medication', 'checkup', 'vaccine', 'other']
export const REMINDER_FREQUENCIES = ['once', 'daily', 'weekly', 'monthly']

/** A medicine or check-up reminder. Shown in the app only. Every query must filter by ownerId. */
const healthReminderSchema = new mongoose.Schema({
  ownerId: { type: String, required: true },
  memberId: { type: String, default: '' }, // empty means the patient themself
  kind: { type: String, enum: REMINDER_KINDS, default: 'medication' },
  title: { type: String, required: true, maxlength: 160 },
  note: { type: String, default: '', maxlength: 500 },
  frequency: { type: String, enum: REMINDER_FREQUENCIES, default: 'daily' },
  times: { type: [String], default: ['09:00'] }, // HH:mm, patient's local time
  startDate: { type: String, required: true }, // YYYY-MM-DD
  endDate: { type: String, default: '' },
  tzOffsetMinutes: { type: Number, default: -120 }, // as Date.getTimezoneOffset(): Egypt is -120 or -180
  active: { type: Boolean, default: true },
  nextDueAt: { type: Number, default: 0 },
  notifiedForDueAt: { type: Number, default: 0 },
  history: [{
    _id: false,
    dueAt: Number,
    at: Number,
    action: { type: String, enum: ['taken', 'skipped', 'missed'] }
  }]
}, { timestamps: true })

healthReminderSchema.index({ ownerId: 1, active: 1, nextDueAt: 1 })

const healthReminderModel = mongoose.models.healthReminder || mongoose.model('healthReminder', healthReminderSchema)

export default healthReminderModel
