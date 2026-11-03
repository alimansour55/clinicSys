import mongoose from 'mongoose'
import notificationModel from '../models/notificationModel.js'

const recipientQuery = (req) => ({
  recipientRole: req.user.role,
  recipientId: String(req.user.userId)
})

const failed = (res, label, error) => {
  console.error(`${label}:`, error.message)
  return res.json({ success: false, message: 'Something went wrong. Please try again.' })
}

export const listNotifications = async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30))
    const items = await notificationModel.find(recipientQuery(req)).sort({ createdAt: -1 }).limit(limit).lean()
    res.json({ success: true, notifications: items })
  } catch (error) {
    failed(res, 'List notifications', error)
  }
}

export const getUnreadCount = async (req, res) => {
  try {
    const count = await notificationModel.countDocuments({ ...recipientQuery(req), read: false })
    res.json({ success: true, unreadCount: count })
  } catch (error) {
    failed(res, 'Unread count', error)
  }
}

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return res.json({ success: false, message: 'Notification not found' })
    }
    const doc = await notificationModel.findOneAndUpdate(
      { _id: id, ...recipientQuery(req) },
      { read: true, readAt: Date.now() },
      { new: true }
    )
    if (!doc) {
      return res.json({ success: false, message: 'Notification not found' })
    }
    res.json({ success: true, notification: doc })
  } catch (error) {
    failed(res, 'Mark notification read', error)
  }
}

export const markAllNotificationsRead = async (req, res) => {
  try {
    await notificationModel.updateMany({ ...recipientQuery(req), read: false }, { read: true, readAt: Date.now() })
    res.json({ success: true })
  } catch (error) {
    failed(res, 'Mark all notifications read', error)
  }
}
