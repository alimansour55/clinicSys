import { describe, it, expect } from 'vitest'
import notificationModel from '../../models/notificationModel.js'
import { api, loginPatient, authHeader } from './helpers/harness.js'
import { testIds } from './helpers/seed.js'

describe('T3.14 Notifications API', () => {
  it('lists, counts unread, and marks notifications read', async () => {
    await notificationModel.create({
      recipientRole: 'patient',
      recipientId: testIds.patientId,
      title: 'Test notice',
      message: 'Hello patient',
      type: 'general',
      read: false,
    })

    const loginRes = await loginPatient()
    const headers = authHeader.patient(loginRes.body.token)

    const listRes = await api().get('/api/notifications').set(headers)
    expect(listRes.body.success).toBe(true)
    expect(listRes.body.notifications.length).toBeGreaterThan(0)

    const countRes = await api().get('/api/notifications/unread-count').set(headers)
    expect(countRes.body.unreadCount).toBeGreaterThan(0)

    const id = listRes.body.notifications[0]._id
    const readRes = await api().post(`/api/notifications/${id}/read`).set(headers)
    expect(readRes.body.success).toBe(true)

    const readAllRes = await api().post('/api/notifications/read-all').set(headers)
    expect(readAllRes.body.success).toBe(true)
  })
})
