import express from 'express'
import { authenticateAny } from '../middlewares/rbac.js'
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../controllers/notificationController.js'

const notificationRouter = express.Router()

notificationRouter.get('/unread-count', authenticateAny, getUnreadCount)
notificationRouter.get('/', authenticateAny, listNotifications)
notificationRouter.post('/read-all', authenticateAny, markAllNotificationsRead)
notificationRouter.post('/:id/read', authenticateAny, markNotificationRead)

export default notificationRouter
