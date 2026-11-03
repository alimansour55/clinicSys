import mongoose from 'mongoose'

const waitlistSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  docId: { type: String, required: true },
  appointmentType: { type: String, default: 'Clinic' },
  clinicLocation: { type: String, default: '' },
  visitFeeType: { type: String, default: 'examination' },
  /** Inclusive range as YYYYMMDD numbers, so entries compare without parsing. */
  fromDateKey: { type: Number, required: true },
  toDateKey: { type: Number, required: true },
  status: {
    type: String,
    enum: ['waiting', 'offered', 'booked', 'left', 'expired'],
    default: 'waiting'
  },
  offer: {
    slotDate: { type: String, default: '' },
    slotTime: { type: String, default: '' },
    expiresAt: { type: Number, default: 0 },
    holdId: { type: String, default: '' }
  },
  /** Patient declined or let these lapse. Never offered the same slot twice. */
  passedSlots: { type: [String], default: [] },
  doctorName: { type: String, default: '' },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now }
}, { minimize: false })

waitlistSchema.index({ docId: 1, status: 1, createdAt: 1 })
waitlistSchema.index({ userId: 1, status: 1 })

const waitlistModel = mongoose.models.waitlist || mongoose.model('waitlist', waitlistSchema)

export default waitlistModel
