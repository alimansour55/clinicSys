import PDFDocument from 'pdfkit'
import { getPublicAppBrand } from '../config/publicBrand.js'

const CURRENCY_LABEL = (process.env.CURRENCY_LABEL || 'EGP').trim() || 'EGP'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const formatAppointmentSlotDate = (slotDate) => {
  if (!slotDate || typeof slotDate !== 'string') return slotDate || ''
  const parts = slotDate.split('_').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return slotDate.replace(/_/g, '/')
  const [day, month, year] = parts
  const name = MONTH_NAMES[month - 1]
  return name ? `${day} ${name} ${year}` : `${day}/${month}/${year}`
}

const formatMoney = (amount) => {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${CURRENCY_LABEL} 0.00`
  return `${CURRENCY_LABEL} ${n.toFixed(2)}`
}

const visitFeeLabel = (visitFeeType) =>
  visitFeeType === 'consultation' ? 'Follow-up consultation' : 'Examination'

const homeVisitAddressLines = (address) => {
  if (!address || typeof address !== 'object') return []
  const lines = []
  if (address.area) lines.push(`Area: ${address.area}`)
  if (address.street) lines.push(`Street: ${address.street}`)
  if (address.building) lines.push(`Building: ${address.building}`)
  if (address.floor) lines.push(`Floor: ${address.floor}`)
  if (address.apartment) lines.push(`Apartment: ${address.apartment}`)
  if (address.notes) lines.push(`Notes: ${address.notes}`)
  return lines
}

const buildPdfBuffer = (draw) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    try {
      draw(doc)
      doc.end()
    } catch (err) {
      reject(err)
    }
  })

const drawHeader = (doc, title, brand) => {
  doc.fontSize(20).fillColor('#0d9488').text(brand, { align: 'center' })
  doc.moveDown(0.3)
  doc.fontSize(16).fillColor('#111827').text(title, { align: 'center' })
  doc.moveDown(1)
  doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke()
  doc.moveDown(0.8)
}

const drawLabelValue = (doc, label, value) => {
  doc.fontSize(10).fillColor('#6b7280').text(label, { continued: false })
  doc.fontSize(11).fillColor('#111827').text(String(value || '—'), { indent: 0 })
  doc.moveDown(0.35)
}

const drawAppointmentDetails = (doc, appointment) => {
  const patient = appointment.userData || {}
  const doctor = appointment.docData || {}
  const when = `${formatAppointmentSlotDate(appointment.slotDate)} at ${appointment.slotTime || ''}`.trim()

  drawLabelValue(doc, 'Reservation #', appointment.reservationNumber || appointment._id)
  drawLabelValue(doc, 'Patient', patient.name || 'Patient')
  if (patient.patientId) drawLabelValue(doc, 'Patient ID', patient.patientId)
  if (patient.phone) drawLabelValue(doc, 'Phone', patient.phone)
  if (patient.email) drawLabelValue(doc, 'Email', patient.email)
  drawLabelValue(doc, 'Doctor', doctor.name ? `Dr. ${doctor.name}` : 'Doctor')
  if (doctor.speciality) drawLabelValue(doc, 'Speciality', doctor.speciality)
  drawLabelValue(doc, 'Appointment type', appointment.appointmentType || 'Clinic')
  drawLabelValue(doc, 'Visit type', visitFeeLabel(appointment.visitFeeType))
  drawLabelValue(doc, 'Date & time', when)
  if (appointment.clinicLocation) drawLabelValue(doc, 'Clinic location', appointment.clinicLocation)
  const addressLines = homeVisitAddressLines(appointment.homeVisitAddress)
  if (addressLines.length > 0) {
    doc.fontSize(10).fillColor('#6b7280').text('Home visit address')
    addressLines.forEach((line) => {
      doc.fontSize(11).fillColor('#111827').text(line)
    })
    doc.moveDown(0.35)
  }
  if (appointment.teleconsultationLink) {
    drawLabelValue(doc, 'Teleconsultation link', appointment.teleconsultationLink)
  }
}

const drawAmountSummary = (doc, appointment, { showPayment = false } = {}) => {
  doc.moveDown(0.5)
  doc.fontSize(12).fillColor('#111827').text('Amount summary', { underline: true })
  doc.moveDown(0.4)

  const original = Number(appointment.originalAmount ?? appointment.amount ?? 0)
  const discount = Number(appointment.discountAmount || 0)
  const total = Number(appointment.amount ?? 0)

  drawLabelValue(doc, 'List amount', formatMoney(original))
  if (discount > 0) {
    drawLabelValue(doc, 'Discount', `− ${formatMoney(discount)}${appointment.discountReason ? ` (${appointment.discountReason})` : ''}`)
  }
  if (appointment.promoCode) drawLabelValue(doc, 'Promo code', appointment.promoCode)
  doc.fontSize(12).fillColor('#0d9488').text(`Total: ${formatMoney(total)}`, { align: 'left' })
  doc.moveDown(0.5)

  if (showPayment) {
    drawLabelValue(doc, 'Payment status', appointment.paymentStatus || 'Not Paid')
    if (appointment.paymentMethod) drawLabelValue(doc, 'Payment method', appointment.paymentMethod)
    if (appointment.paidAt) {
      drawLabelValue(doc, 'Paid on', new Date(appointment.paidAt).toLocaleString('en-GB'))
    }
    if (appointment.paymentNote) drawLabelValue(doc, 'Payment note', appointment.paymentNote)
  } else {
    drawLabelValue(doc, 'Payment status', appointment.paymentStatus || 'Not Paid')
    if (appointment.paymentMethod) drawLabelValue(doc, 'Selected payment', appointment.paymentMethod)
    doc.fontSize(10).fillColor('#6b7280').text(
      appointment.paymentStatus === 'Paid'
        ? 'Payment has been received. See your invoice email for receipt details.'
        : 'Payment is due at the clinic unless you paid online. Please bring this confirmation to your visit.'
    )
  }
}

export async function generateBookingConfirmationPdf(appointment) {
  const brand = getPublicAppBrand()
  const plain = appointment?.toObject ? appointment.toObject() : appointment

  return buildPdfBuffer((doc) => {
    drawHeader(doc, 'Appointment Confirmation', brand)
    drawAppointmentDetails(doc, plain)
    drawAmountSummary(doc, plain, { showPayment: false })
    doc.moveDown(1)
    doc.fontSize(9).fillColor('#9ca3af').text(
      `Generated ${new Date().toLocaleString('en-GB')} · ${brand}`,
      { align: 'center' }
    )
  })
}

export async function generateInvoicePdf(appointment) {
  const brand = getPublicAppBrand()
  const plain = appointment?.toObject ? appointment.toObject() : appointment
  const invoiceNo = plain.reservationNumber || `INV-${String(plain._id || '').slice(-8).toUpperCase()}`

  return buildPdfBuffer((doc) => {
    drawHeader(doc, 'Payment Invoice', brand)
    drawLabelValue(doc, 'Invoice #', invoiceNo)
    drawLabelValue(doc, 'Invoice date', new Date(plain.paidAt || Date.now()).toLocaleDateString('en-GB'))
    doc.moveDown(0.3)
    drawAppointmentDetails(doc, plain)
    drawAmountSummary(doc, plain, { showPayment: true })
    doc.moveDown(1)
    doc.fontSize(9).fillColor('#9ca3af').text(
      'This document serves as proof of payment for your visit.',
      { align: 'center' }
    )
    doc.text(`Generated ${new Date().toLocaleString('en-GB')} · ${brand}`, { align: 'center' })
  })
}
