import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  sendBookingConfirmationEmail,
  sendInvoiceEmail,
  sendAppointmentEmailsOnBook,
} from '../services/appointmentEmailService.js'

vi.mock('../config/nodemailer.js', () => ({
  default: { sendMail: vi.fn().mockResolvedValue({}) },
}))
vi.mock('../services/appointmentPdfService.js', () => ({
  formatAppointmentSlotDate: () => '21 May 2026',
  generateBookingConfirmationPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
  generateInvoicePdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-invoice')),
}))
vi.mock('../config/publicBrand.js', () => ({
  getPublicAppBrand: () => 'TestClinic',
}))

import transporter from '../config/nodemailer.js'
import {
  generateBookingConfirmationPdf,
  generateInvoicePdf,
} from '../services/appointmentPdfService.js'

const appointment = {
  _id: 'apt1',
  reservationNumber: 'RES000001',
  slotDate: '21_5_2026',
  slotTime: '10:00',
  paymentStatus: 'Paid',
  userData: { name: 'Patient', email: 'Patient@Example.com' },
  docData: { name: 'Jones' },
}

describe('appointmentEmailService', () => {
  beforeEach(() => {
    vi.mocked(transporter.sendMail).mockClear()
    vi.stubEnv('SENDER_EMAIL', 'noreply@test.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends booking confirmation with PDF attachment', async () => {
    await sendBookingConfirmationEmail(appointment)

    expect(generateBookingConfirmationPdf).toHaveBeenCalled()
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'patient@example.com',
        attachments: expect.arrayContaining([
          expect.objectContaining({ filename: expect.stringContaining('appointment-confirmation'), contentType: 'application/pdf' }),
        ]),
      })
    )
  })

  it('sends invoice only when payment is paid', async () => {
    await sendInvoiceEmail(appointment)
    expect(generateInvoicePdf).toHaveBeenCalled()
    expect(transporter.sendMail).toHaveBeenCalled()

    vi.mocked(transporter.sendMail).mockClear()
    await sendInvoiceEmail({ ...appointment, paymentStatus: 'Not Paid' })
    expect(transporter.sendMail).not.toHaveBeenCalled()
  })

  it('skips email when SENDER_EMAIL not configured', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('SENDER_EMAIL', '')
    await sendBookingConfirmationEmail(appointment)
    expect(transporter.sendMail).not.toHaveBeenCalled()
  })

  it('sendAppointmentEmailsOnBook triggers confirmation and invoice when paid', async () => {
    sendAppointmentEmailsOnBook(appointment)
    await vi.waitFor(() => {
      expect(generateBookingConfirmationPdf).toHaveBeenCalled()
      expect(generateInvoicePdf).toHaveBeenCalled()
    })
  })
})
