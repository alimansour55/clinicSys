import mongoose from 'mongoose'

/**
 * A short claim on a slot that is not an appointment yet: a patient paying online, or a waitlist
 * patient who has been offered a freed slot. The slot stays in the doctor's slots_booked while a
 * hold is live, so every booking path (reception, chatbot) sees it as taken.
 */
const slotHoldSchema = new mongoose.Schema({
  docId: { type: String, required: true },
  userId: { type: String, required: true },
  slotDate: { type: String, required: true },
  slotTime: { type: String, required: true },
  appointmentType: { type: String, default: 'Clinic' },
  kind: { type: String, enum: ['payment', 'waitlist'], required: true },
  /** held -> finalizing -> booked | refunded, or held -> released | expired */
  state: {
    type: String,
    enum: ['held', 'finalizing', 'booked', 'refunded', 'released', 'expired'],
    default: 'held'
  },
  /** True once the slot went back to the pool, so a late payment has to win it again. */
  slotReleased: { type: Boolean, default: false },
  expiresAt: { type: Number, required: true },
  claimedAt: { type: Number, default: 0 },
  paymentIntentId: { type: String, default: '' },
  waitlistEntryId: { type: String, default: '' },
  /** What the patient chose, so the appointment is built from server state and not from the client or Stripe metadata. */
  draft: { type: Object, default: {} },
  resultMessage: { type: String, default: '' },
  createdAt: { type: Number, default: Date.now }
}, { minimize: false })

slotHoldSchema.index({ state: 1, expiresAt: 1 })
slotHoldSchema.index({ docId: 1, state: 1 })
slotHoldSchema.index({ userId: 1, state: 1 })
slotHoldSchema.index(
  { paymentIntentId: 1 },
  { unique: true, partialFilterExpression: { paymentIntentId: { $gt: '' } }, name: 'unique_hold_payment_intent' }
)

const slotHoldModel = mongoose.models.slotHold || mongoose.model('slotHold', slotHoldSchema)

export default slotHoldModel
