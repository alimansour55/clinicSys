import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatAppointmentSlotDate,
  generateBookingConfirmationPdf,
  generateInvoicePdf,
} from '../services/appointmentPdfService.js'

vi.mock('../config/publicBrand.js', () => ({
  getPublicAppBrand: () => 'TestClinic',
}))

const sampleAppointment = {
  _id: 'apt12345678',
  reservationNumber: 'RES000001',
  slotDate: '21_5_2026',
  slotTime: '10:30',
  appointmentType: 'Clinic',
  visitFeeType: 'examination',
  amount: 250,
  originalAmount: 300,
  discountAmount: 50,
  discountReason: 'Promo',
  promoCode: 'SAVE10',
  paymentStatus: 'Paid',
  paymentMethod: 'Cash',
  paidAt: Date.now(),
  userData: { name: 'Patient One', email: 'p@example.com', phone: '01012345678' },
  docData: { name: 'Smith', speciality: 'Cardiology' },
}

describe('appointmentPdfService', () => {
  describe('formatAppointmentSlotDate', () => {
    it('formats DD_MM_YYYY slots', () => {
      expect(formatAppointmentSlotDate('21_5_2026')).toBe('21 May 2026')
    })

    it('returns original for invalid input', () => {
      expect(formatAppointmentSlotDate('bad')).toBe('bad')
    })
  })

  describe('generateBookingConfirmationPdf', () => {
    it('returns a non-empty PDF buffer', async () => {
      const buffer = await generateBookingConfirmationPdf(sampleAppointment)
      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBeGreaterThan(500)
      expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
    })
  })

  describe('generateInvoicePdf', () => {
    it('returns invoice PDF buffer with metadata', async () => {
      const buffer = await generateInvoicePdf(sampleAppointment)
      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
    })
  })
})
