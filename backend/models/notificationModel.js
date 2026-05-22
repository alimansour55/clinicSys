import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    recipientRole: {
      type: String,
      enum: ['admin', 'doctor', 'receptionist', 'patient'],
      required: true,
      index: true
    },
    recipientId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 2000 },
    type: { type: String, default: 'general', maxlength: 64, index: true },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Number, default: 0 },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
)

notificationSchema.index({ recipientRole: 1, recipientId: 1, createdAt: -1 })
notificationSchema.index({ recipientRole: 1, recipientId: 1, read: 1 })

const notificationModel =
  mongoose.models.notification || mongoose.model('notification', notificationSchema)

export default notificationModel
