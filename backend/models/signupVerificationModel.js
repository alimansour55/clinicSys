import mongoose from 'mongoose'

const signupVerificationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    type: { type: String, enum: ['email', 'phone'], required: true },
    otp: { type: String, default: '' },
    otpExpireAt: { type: Number, default: 0 },
    otpSentAt: { type: Number, default: 0 },
    verified: { type: Boolean, default: false }
  },
  { timestamps: true }
)

signupVerificationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 })

const signupVerificationModel =
  mongoose.models.signupVerification ||
  mongoose.model('signupVerification', signupVerificationSchema)

export default signupVerificationModel
