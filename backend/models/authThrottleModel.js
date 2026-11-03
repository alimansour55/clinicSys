import mongoose from 'mongoose'

/**
 * Failure and request counters for sign-in, OTP and MFA endpoints.
 * Kept in MongoDB because the API runs on serverless instances that share no memory.
 * `key` is an HMAC, so emails, phone numbers and IP addresses are never stored here.
 */
const authThrottleSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  windowStartedAt: { type: Number, default: 0 },
  lockedUntil: { type: Number, default: 0 },
  expireAt: { type: Date, required: true }
})

authThrottleSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 })

const authThrottleModel = mongoose.models.authThrottle || mongoose.model('authThrottle', authThrottleSchema)

export default authThrottleModel
