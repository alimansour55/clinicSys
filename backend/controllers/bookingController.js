import appointmentModel from '../models/appointmentModel.js'
import doctorModel from '../models/doctorModel.js'
import prescriptionModel from '../models/prescriptionModel.js'
import { logAudit } from '../services/auditService.js'
import { sendBookingConfirmationEmail } from '../services/appointmentEmailService.js'
import { generateBookingConfirmationPdf, generateInvoicePdf, generatePrescriptionPdf } from '../services/appointmentPdfService.js'
import { buildTeleconsultationLink, normalizeAppointmentType } from '../services/appointmentModeService.js'
import { getAvailabilityForDoctor, getNextAvailableAcrossDoctors } from '../services/availabilityService.js'
import {
  MAX_RESCHEDULES,
  buildQuote,
  findPatientClash,
  isValidId,
  releaseHold,
  toPatientAppointment,
  unlockSlot
} from '../services/bookingService.js'
import { buildGoogleCalendarUrl, buildIcs } from '../services/calendarService.js'
import { canonicalSlotDate, canonicalSlotTime } from '../services/clinicTimeService.js'
import { normalizeVisitFeeType } from '../services/globalVisitFeesService.js'
import { pushNotification } from '../services/notificationService.js'
import { isSlotAllowedBySchedule, resolveClinicLocationForSchedule, usesClinicWeeklySchedule } from '../services/scheduleService.js'
import { acquireSlotForUser, consumeHold, sweepExpiredHolds } from '../services/slotHoldService.js'
import { joinWaitlist, leaveWaitlist, listWaitlistForUser, processWaitlistForDoctor } from '../services/waitlistService.js'

const respondError = (res, error) => {
  console.log(error)
  res.json({ success: false, message: error.message })
}

const queryText = (value) => (typeof value === 'string' ? value.trim() : '')

const getAvailability = async (req, res) => {
  try {
    const { docId } = req.params
    if (!isValidId(docId)) return res.json({ success: false, message: 'Doctor not found' })

    await sweepExpiredHolds({ docId })

    const doctor = await doctorModel.findById(docId).select('-password')
    if (!doctor) return res.json({ success: false, message: 'Doctor not found' })

    const availability = await getAvailabilityForDoctor(doctor, {
      appointmentType: normalizeAppointmentType(queryText(req.query.appointmentType)),
      clinicLocation: queryText(req.query.clinicLocation),
      days: Number(req.query.days) || undefined
    })
    res.json({ success: true, ...availability })
  } catch (error) {
    respondError(res, error)
  }
}

const getNextAvailable = async (req, res) => {
  try {
    const excludeDocId = queryText(req.query.excludeDocId)
    const doctors = await getNextAvailableAcrossDoctors({
      speciality: queryText(req.query.speciality),
      appointmentType: normalizeAppointmentType(queryText(req.query.appointmentType)),
      excludeDocId: isValidId(excludeDocId) ? excludeDocId : '',
      limit: Number(req.query.limit) || 5
    })
    res.json({ success: true, doctors })
  } catch (error) {
    respondError(res, error)
  }
}

/** The price the patient sees, from the same function that charges them. */
const getBookingQuote = async (req, res) => {
  try {
    const { docId } = req.params
    if (!isValidId(docId)) return res.json({ success: false, message: 'Doctor not found' })

    const doctor = await doctorModel.findById(docId).select('fees promoCode name')
    if (!doctor) return res.json({ success: false, message: 'Doctor not found' })

    const pricing = await buildQuote(doctor, {
      appointmentType: normalizeAppointmentType(queryText(req.query.appointmentType)),
      visitFeeType: normalizeVisitFeeType(queryText(req.query.visitFeeType)),
      promoCode: queryText(req.query.promoCode)
    })
    if (pricing.error) return res.json({ success: false, message: pricing.error })

    res.json({
      success: true,
      quote: {
        baseAmount: pricing.baseAmount,
        discountAmount: pricing.discountAmount,
        discountReason: pricing.discountReason,
        promoCode: pricing.promoCode,
        homeVisitSurcharge: pricing.homeVisitSurcharge || 0,
        visitFeeType: pricing.visitFeeType,
        amount: pricing.amount
      }
    })
  } catch (error) {
    respondError(res, error)
  }
}

const rescheduleAppointment = async (req, res) => {
  try {
    const userId = req.user.userId
    const { appointmentId } = req.body
    const slotDate = canonicalSlotDate(req.body.slotDate)
    const slotTime = canonicalSlotTime(req.body.slotTime)

    if (!isValidId(appointmentId)) return res.json({ success: false, message: 'Appointment not found' })
    if (!slotDate || !slotTime) return res.json({ success: false, message: 'Invalid appointment date or time' })

    const appointment = await appointmentModel.findById(appointmentId)
    if (!appointment) return res.json({ success: false, message: 'Appointment not found' })
    if (appointment.userId !== userId) {
      await logAudit({
        action: 'appointment_reschedule',
        status: 'failed',
        reason: 'Patient attempted to reschedule another patient appointment',
        targetUserId: appointment.userId,
        entityType: 'appointment',
        entityId: appointmentId,
        req
      })
      return res.json({ success: false, message: 'Unauthorized action' })
    }

    // Retrying a reschedule that already went through is success, not a conflict with itself.
    if (appointment.slotDate === slotDate && appointment.slotTime === slotTime && !appointment.cancelled) {
      return res.json({ success: true, message: 'Appointment rescheduled', appointment: toPatientAppointment(appointment) })
    }
    if (!toPatientAppointment(appointment).canCancel) {
      return res.json({ success: false, message: 'This appointment can no longer be changed' })
    }
    if (Number(appointment.rescheduleCount || 0) >= MAX_RESCHEDULES) {
      return res.json({ success: false, message: 'This appointment has been rescheduled too many times. Please contact reception.' })
    }

    const { docId, appointmentType } = appointment
    const doctor = await doctorModel.findById(docId).select('-password')
    if (!doctor || doctor.available === false) {
      return res.json({ success: false, message: 'This doctor is not accepting appointments right now' })
    }

    const requestedLocation = usesClinicWeeklySchedule(appointmentType) ? appointment.clinicLocation : ''
    const clinicLocation = resolveClinicLocationForSchedule(doctor, requestedLocation, appointmentType)
    const scheduleCheck = isSlotAllowedBySchedule(doctor, slotDate, slotTime, appointmentType, clinicLocation)
    if (!scheduleCheck.allowed) return res.json({ success: false, message: scheduleCheck.reason })

    if (await findPatientClash({ userId, slotDate, slotTime, excludeId: appointment._id })) {
      return res.json({ success: false, message: 'You already have another appointment at this time' })
    }

    const acquired = await acquireSlotForUser({ userId, docId, slotDate, slotTime, appointmentType })
    if (!acquired.ok) return res.json({ success: false, message: 'Slot not available' })

    const newSlot = { docId, slotDate, slotTime, appointmentType }
    const isTele = ['Voice Call', 'Video Call'].includes(appointmentType)
    let updated
    try {
      // Guarded on the old slot and status, so a concurrent reschedule or cancel cannot both win.
      updated = await appointmentModel.findOneAndUpdate(
        {
          _id: appointment._id,
          userId,
          cancelled: false,
          appointmentStatus: 'Booked',
          slotDate: appointment.slotDate,
          slotTime: appointment.slotTime
        },
        {
          slotDate,
          slotTime,
          teleconsultationLink: isTele ? buildTeleconsultationLink({ appointmentId: appointment._id, docId, userId, slotDate, slotTime, appointmentType }) : '',
          statusUpdatedAt: Date.now(),
          $inc: { rescheduleCount: 1 },
          $push: {
            rescheduleHistory: {
              fromSlotDate: appointment.slotDate,
              fromSlotTime: appointment.slotTime,
              toSlotDate: slotDate,
              toSlotTime: slotTime,
              at: Date.now(),
              by: 'patient'
            }
          }
        },
        { new: true }
      )
    } catch (error) {
      if (acquired.hold) await releaseHold(acquired.hold).catch(() => {})
      else await unlockSlot(newSlot).catch(() => {})
      if (error?.code === 11000) return res.json({ success: false, message: 'Slot not available' })
      throw error
    }

    if (!updated) {
      if (acquired.hold) await releaseHold(acquired.hold).catch(() => {})
      else await unlockSlot(newSlot).catch(() => {})
      return res.json({ success: false, message: 'This appointment can no longer be changed' })
    }

    await consumeHold(acquired.hold)

    await unlockSlot({ docId, slotDate: appointment.slotDate, slotTime: appointment.slotTime, appointmentType })

    await logAudit({
      action: 'appointment_reschedule',
      status: 'success',
      targetUserId: userId,
      entityType: 'appointment',
      entityId: appointment._id,
      metadata: {
        patientId: userId,
        doctorId: docId,
        oldValue: { slotDate: appointment.slotDate, slotTime: appointment.slotTime },
        newValue: { slotDate, slotTime }
      },
      req
    })

    const when = `${slotDate.replace(/_/g, ' ')} · ${slotTime}`
    void pushNotification({
      recipientRole: 'doctor',
      recipientId: docId,
      title: 'Appointment rescheduled',
      message: `${appointment.userData?.name || 'A patient'} moved their visit to ${when}.`,
      type: 'appointment_rescheduled',
      meta: { appointmentId: String(appointment._id), userId }
    })
    void pushNotification({
      recipientRole: 'patient',
      recipientId: userId,
      title: 'Appointment rescheduled',
      message: `Your visit with Dr. ${appointment.docData?.name || ''} is now on ${when}.`,
      type: 'appointment_rescheduled',
      meta: { appointmentId: String(appointment._id), docId },
      i18n: { templateId: 'patient_appt_rescheduled', params: { doctorName: appointment.docData?.name || '', when } }
    })
    void sendBookingConfirmationEmail(updated)

    await processWaitlistForDoctor(docId).catch((error) => console.error('waitlist', error.message))

    res.json({ success: true, message: 'Appointment rescheduled', appointment: toPatientAppointment(updated) })
  } catch (error) {
    respondError(res, error)
  }
}

const getOwnAppointment = async (req) => {
  const { appointmentId } = req.params
  if (!isValidId(appointmentId)) return null
  const appointment = await appointmentModel.findById(appointmentId)
  return appointment && appointment.userId === req.user.userId ? appointment : null
}

const sendAttachment = (res, { contentType, filename, body }) => {
  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Cache-Control', 'private, no-store')
  res.send(body)
}

const downloadCalendar = async (req, res) => {
  try {
    const appointment = await getOwnAppointment(req)
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' })

    const lang = req.query.lang === 'ar' ? 'ar' : 'en'
    const plain = toPatientAppointment(appointment)
    const body = buildIcs(plain, { lang })
    if (!body) return res.status(422).json({ success: false, message: 'Invalid appointment date or time' })

    sendAttachment(res, {
      contentType: 'text/calendar; charset=utf-8',
      filename: `appointment-${appointment.reservationNumber || appointment._id}.ics`,
      body
    })
  } catch (error) {
    respondError(res, error)
  }
}

const getCalendarLinks = async (req, res) => {
  try {
    const appointment = await getOwnAppointment(req)
    if (!appointment) return res.json({ success: false, message: 'Appointment not found' })
    const lang = req.query.lang === 'ar' ? 'ar' : 'en'
    res.json({ success: true, googleCalendarUrl: buildGoogleCalendarUrl(toPatientAppointment(appointment), { lang }) })
  } catch (error) {
    respondError(res, error)
  }
}

const downloadAppointmentPdf = async (req, res) => {
  try {
    const appointment = await getOwnAppointment(req)
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' })

    const wantsInvoice = req.query.kind === 'invoice'
    if (wantsInvoice && appointment.paymentStatus !== 'Paid') {
      return res.status(409).json({ success: false, message: 'An invoice is available once the appointment is paid' })
    }

    const ref = appointment.reservationNumber || appointment._id
    sendAttachment(res, {
      contentType: 'application/pdf',
      filename: `${wantsInvoice ? 'invoice' : 'appointment-confirmation'}-${ref}.pdf`,
      body: await (wantsInvoice ? generateInvoicePdf(appointment) : generateBookingConfirmationPdf(appointment))
    })
  } catch (error) {
    respondError(res, error)
  }
}

const downloadPrescriptionPdf = async (req, res) => {
  try {
    const { appointmentId } = req.params
    if (!isValidId(appointmentId)) return res.status(404).json({ success: false, message: 'Prescription not found' })

    const prescription = await prescriptionModel.findOne({ appointmentId, userId: req.user.userId })
    if (!prescription) return res.status(404).json({ success: false, message: 'Prescription not found' })

    sendAttachment(res, {
      contentType: 'application/pdf',
      filename: `prescription-${prescription.reservationNumber || appointmentId}.pdf`,
      body: await generatePrescriptionPdf(prescription)
    })
  } catch (error) {
    respondError(res, error)
  }
}

const joinDoctorWaitlist = async (req, res) => {
  try {
    const userId = req.user.userId
    const { docId } = req.body
    if (!isValidId(docId)) return res.json({ success: false, message: 'Doctor not found' })

    const fromSlotDate = canonicalSlotDate(req.body.fromSlotDate)
    const toSlotDate = canonicalSlotDate(req.body.toSlotDate || req.body.fromSlotDate)
    if (!fromSlotDate || !toSlotDate) return res.json({ success: false, message: 'Please choose a valid date' })

    const doctor = await doctorModel.findById(docId).select('-password')
    if (!doctor || doctor.available === false) {
      return res.json({ success: false, message: 'This doctor is not accepting appointments right now' })
    }

    const appointmentType = normalizeAppointmentType(req.body.appointmentType)
    const clinicLocation = resolveClinicLocationForSchedule(doctor, String(req.body.clinicLocation || '').trim(), appointmentType)
    const branches = (doctor.locations || []).map((location) => String(location || '').trim()).filter(Boolean)
    if (usesClinicWeeklySchedule(appointmentType) && branches.length > 1 && !branches.includes(clinicLocation)) {
      return res.json({ success: false, message: 'Please choose a clinic location' })
    }

    const result = await joinWaitlist({
      userId,
      doctor,
      appointmentType,
      clinicLocation,
      visitFeeType: normalizeVisitFeeType(req.body.visitFeeType),
      fromSlotDate,
      toSlotDate
    })
    if (result.error) return res.json({ success: false, message: result.error, slotsOpen: Boolean(result.slotsOpen) })

    res.json({ success: true, message: 'You are on the waitlist', entryId: result.entry._id, alreadyJoined: Boolean(result.alreadyJoined) })
  } catch (error) {
    respondError(res, error)
  }
}

const getMyWaitlist = async (req, res) => {
  try {
    await sweepExpiredHolds({})
    res.json({ success: true, entries: await listWaitlistForUser(req.user.userId) })
  } catch (error) {
    respondError(res, error)
  }
}

const leaveDoctorWaitlist = async (req, res) => {
  try {
    const { entryId } = req.body
    if (!isValidId(entryId)) return res.json({ success: false, message: 'Waitlist entry not found' })
    const left = await leaveWaitlist({ userId: req.user.userId, entryId })
    // Leaving twice ends in the same place as leaving once.
    res.json({ success: true, left })
  } catch (error) {
    respondError(res, error)
  }
}

export {
  downloadAppointmentPdf,
  downloadCalendar,
  downloadPrescriptionPdf,
  getAvailability,
  getBookingQuote,
  getCalendarLinks,
  getMyWaitlist,
  getNextAvailable,
  joinDoctorWaitlist,
  leaveDoctorWaitlist,
  rescheduleAppointment
}
