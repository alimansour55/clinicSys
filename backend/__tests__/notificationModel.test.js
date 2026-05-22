import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController.js'

vi.mock('../models/notificationModel.js', () => ({
  default: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateMany: vi.fn(),
  },
}))

import notificationModel from '../models/notificationModel.js'

const mockRes = () => {
  const res = { json: vi.fn() }
  return res
}

describe('notification list / mark read (controller + mock DB)', () => {
  const req = { user: { role: 'patient', userId: 'user1' }, query: {}, params: {} }

  beforeEach(() => {
    vi.mocked(notificationModel.find).mockReset()
    vi.mocked(notificationModel.countDocuments).mockReset()
    vi.mocked(notificationModel.findOneAndUpdate).mockReset()
    vi.mocked(notificationModel.updateMany).mockReset()
  })

  it('lists notifications for recipient', async () => {
    const lean = vi.fn().mockResolvedValue([{ _id: 'n1', title: 'Hi' }])
    const limit = vi.fn().mockReturnValue({ lean })
    const sort = vi.fn().mockReturnValue({ limit })
    notificationModel.find.mockReturnValue({ sort })

    const res = mockRes()
    await listNotifications(req, res)

    expect(notificationModel.find).toHaveBeenCalledWith({
      recipientRole: 'patient',
      recipientId: 'user1',
    })
    expect(res.json).toHaveBeenCalledWith({ success: true, notifications: [{ _id: 'n1', title: 'Hi' }] })
  })

  it('returns unread count', async () => {
    notificationModel.countDocuments.mockResolvedValue(3)
    const res = mockRes()
    await getUnreadCount(req, res)
    expect(res.json).toHaveBeenCalledWith({ success: true, unreadCount: 3 })
  })

  it('marks one notification read', async () => {
    notificationModel.findOneAndUpdate.mockResolvedValue({ _id: 'n1', read: true })
    const res = mockRes()
    await markNotificationRead({ ...req, params: { id: 'n1' } }, res)
    expect(notificationModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'n1', recipientRole: 'patient', recipientId: 'user1' },
      { read: true, readAt: expect.any(Number) },
      { new: true }
    )
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
  })

  it('marks all notifications read', async () => {
    notificationModel.updateMany.mockResolvedValue({ modifiedCount: 2 })
    const res = mockRes()
    await markAllNotificationsRead(req, res)
    expect(notificationModel.updateMany).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })
})
