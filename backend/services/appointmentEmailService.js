import transporter from '../config/nodemailer.js'
import {
  APPOINTMENT_BOOKING_EMAIL_TEMPLATE,
  APPOINTMENT_INVOICE_EMAIL_TEMPLATE
} from '../config/EmailTemplates.js'
import { getPublicAppBrand } from '../config/publicBrand.js'
import { normalizeEmail } from '../utils/emailUtils.js'
const isPaidPaymentStatus = (value) => String(value ?? '').trim().toLowerCase() === 'paid'
import {
  formatAppointmentSlotDate,
  generateBookingConfirmationPdf,
  generateInvoicePdf
} from './appointmentPdfService.js'

const isMailConfigured = () => Boolean(String(process.env.SENDER_EMAIL || '').trim())

const getPatientEmail = (appointment) => {
  const email = appointment?.userData?.email || ''
  return normalizeEmail(email)
}

const applyTemplate = (html, vars) => {
  let out = html
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value ?? ''))
  }
  return out
}

const sendPdfEmail = async ({ to, subject, html, filename, pdfBuffer }) => {
  if (!isMailConfigured()) {
    console.warn('appointmentEmail: SENDER_EMAIL not configured — skipping email to', to)
    return false
  }
  if (!to) {
    console.warn('appointmentEmail: patient has no email — skipping')
    return false
  }

  await transporter.sendMail({
    from: process.env.SENDER_EMAIL,
    to,
    subject,
    html,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  })
  return true
}

const commonTemplateVars = (appointment) => {
  const patientName = appointment.userData?.name || 'Patient'
  const doctorName = appointment.docData?.name || 'Doctor'
  const when = `${formatAppointmentSlotDate(appointment.slotDate)} · ${appointment.slotTime || ''}`
  const brand = getPublicAppBrand()
  return {
    patientName,
    doctorName,
    when,
    reservationNumber: appointment.reservationNumber || '',
    FOOTER_YEAR: String(new Date().getFullYear()),
    FOOTER_BRAND: brand
  }
}

/** Booking confirmation PDF — sent when an appointment is created. */
export async function sendBookingConfirmationEmail(appointment) {
  try {
    const plain = appointment?.toObject ? appointment.toObject() : { ...appointment }
    const to = getPatientEmail(plain)
    if (!to) return

    const pdfBuffer = await generateBookingConfirmationPdf(plain)
    const brand = getPublicAppBrand()
    const vars = commonTemplateVars(plain)
    const html = applyTemplate(APPOINTMENT_BOOKING_EMAIL_TEMPLATE, vars)
    const ref = plain.reservationNumber || plain._id
    const filename = `appointment-confirmation-${ref}.pdf`

    await sendPdfEmail({
      to,
      subject: `${brand} — appointment confirmation (${vars.when})`,
      html,
      filename,
      pdfBuffer
    })
  } catch (err) {
    console.error('sendBookingConfirmationEmail failed:', err.message)
  }
}

/** Invoice PDF — sent when payment is recorded (receptionist or online). */
export async function sendInvoiceEmail(appointment) {
  try {
    const plain = appointment?.toObject ? appointment.toObject() : { ...appointment }
    if (!isPaidPaymentStatus(plain.paymentStatus)) return

    const to = getPatientEmail(plain)
    if (!to) return

    const pdfBuffer = await generateInvoicePdf(plain)
    const brand = getPublicAppBrand()
    const vars = commonTemplateVars(plain)
    const html = applyTemplate(APPOINTMENT_INVOICE_EMAIL_TEMPLATE, vars)
    const ref = plain.reservationNumber || plain._id
    const filename = `invoice-${ref}.pdf`

    await sendPdfEmail({
      to,
      subject: `${brand} — payment invoice (${vars.when})`,
      html,
      filename,
      pdfBuffer
    })
  } catch (err) {
    console.error('sendInvoiceEmail failed:', err.message)
  }
}

/** After booking: confirmation always; invoice if already paid (e.g. Visa at checkout). */
export async function sendAppointmentEmailsOnBook(appointment) {
  void sendBookingConfirmationEmail(appointment)
  const plain = appointment?.toObject ? appointment.toObject() : appointment
  if (isPaidPaymentStatus(plain?.paymentStatus)) {
    void sendInvoiceEmail(appointment)
  }
}
