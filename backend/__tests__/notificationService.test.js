import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  pushNotification,
  resolveAppointmentPatientUserId,
  isPaidPaymentStatus,
  getAdminRecipientId,
  notifyAppointmentBooked,
} from '../services/notificationService.js'

vi.mock('../models/notificationModel.js', () => ({
  default: { create: vi.fn().mockResolvedValue({}) },
}))
vi.mock('../models/receptionistModel.js', () => ({
  default: {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    }),
  },
}))
vi.mock('../services/appointmentEmailService.js', () => ({
  sendAppointmentEmailsOnBook: vi.fn(),
  sendInvoiceEmail: vi.fn(),
}))

import notificationModel from '../models/notificationModel.js'

describe('notificationService', () => {
  beforeEach(() => {
    vi.mocked(notificationModel.create).mockClear()
  })

  describe('resolveAppointmentPatientUserId', () => {
    it('reads userId from appointment or userData', () => {
      expect(resolveAppointmentPatientUserId({ userId: 'u1' })).toBe('u1')
      expect(resolveAppointmentPatientUserId({ userData: { _id: 'u2' } })).toBe('u2')
      expect(resolveAppointmentPatientUserId({})).toBe('')
    })
  })

  describe('isPaidPaymentStatus / getAdminRecipientId', () => {
    it('detects paid status case-insensitively', () => {
      expect(isPaidPaymentStatus('Paid')).toBe(true)
      expect(isPaidPaymentStatus('pending')).toBe(false)
    })

    it('uses ADMIN_EMAIL env for admin recipient', () => {
      vi.stubEnv('ADMIN_EMAIL', 'admin@clinic.com')
      expect(getAdminRecipientId()).toBe('admin@clinic.com')
      vi.unstubAllEnvs()
    })
  })

  describe('pushNotification', () => {
    it('creates notification with trimmed fields and i18n meta', async () => {
      await pushNotification({
        recipientRole: 'patient',
        recipientId: 'user1',
        title: 'Test',
        message: 'Hello',
        type: 'general',
        meta: { foo: 'bar' },
        i18n: { templateId: 'test_tpl', params: { x: 1 } },
      })

      expect(notificationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientRole: 'patient',
          recipientId: 'user1',
          read: false,
          meta: expect.objectContaining({
            foo: 'bar',
            i18n: { templateId: 'test_tpl', params: { x: 1 } },
          }),
        })
      )
    })

    it('skips create when recipient missing', async () => {
      await pushNotification({ recipientRole: 'patient', recipientId: '' })
      expect(notificationModel.create).not.toHaveBeenCalled()
    })
  })

  describe('notifyAppointmentBooked', () => {
    it('queues patient, doctor, and admin notifications', () => {
      notifyAppointmentBooked({
        appointment: {
          _id: 'apt1',
          userId: 'pat1',
          docId: 'doc1',
          slotDate: '21_5_2026',
          slotTime: '10:00',
          userData: { name: 'Patient A' },
          docData: { name: 'Dr. B' },
        },
        bookedBy: 'Patient',
      })

      expect(notificationModel.create.mock.calls.length).toBeGreaterThanOrEqual(3)
    })
  })
})
