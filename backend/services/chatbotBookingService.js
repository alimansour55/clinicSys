import doctorModel from '../models/doctorModel.js'
import userModel from '../models/userModel.js'
import appointmentModel from '../models/appointmentModel.js'
import {
  getBookedSlotsField,
  isDoctorOpenForPatientBooking,
  isSlotAllowedBySchedule,
  resolveClinicLocationForSchedule,
  usesClinicWeeklySchedule
} from './scheduleService.js'
import {
  normalizeAppointmentType,
  getDoctorAppointmentModeError,
  buildTeleconsultationLink
} from './appointmentModeService.js'
import { applyAppointmentPricing } from './appointmentPricingService.js'
import { patientCanBookConsultation } from './visitFeeEligibilityService.js'
import { getNextReservationNumber } from './reservationService.js'
import { notifyAppointmentBooked } from './notificationService.js'
import { logAudit } from './auditService.js'
import { normalizeVisitFeeType } from './globalVisitFeesService.js'
import { normalizeHomeVisitAddress, validateHomeVisitAddress } from './homeVisitService.js'
import { getHomeVisitPricingSettings } from './homeVisitPricingService.js'

/**
 * Book appointment from chatbot — same safety checks as patient bookAppointment.
 * Health details from the chat are not stored on the appointment or in the audit log.
 */
export const bookChatbotAppointment = async ({
  userId,
  docId,
  slotDate,
  slotTime,
  clinicLocation = '',
  paymentMethod = 'Cash',
  appointmentType = 'Clinic',
  visitFeeType = 'examination',
  promoCode = '',
  homeVisitAddress = {},
  req
}) => {
  if (!userId) {
    return { success: false, needLogin: true, message: 'Please log in or register to confirm your appointment.' }
  }

  if (!['Cash', 'Visa'].includes(String(paymentMethod).trim())) {
    return { success: false, message: 'Please choose Cash or Visa payment method' }
  }

  const docData = await doctorModel.findById(docId).select('-password -mfa.secret')
  if (!docData) {
    return { success: false, message: 'Doctor not found' }
  }

  const normalizedType = normalizeAppointmentType(appointmentType)
  const normalizedVisitFee = normalizeVisitFeeType(visitFeeType)

  if (normalizedVisitFee === 'consultation') {
    const eligibility = await patientCanBookConsultation(userId, docId)
    if (!eligibility.allowed) {
      return {
        success: false,
        message:
          'Follow-up consultation is only available within 30 days of a completed examination with this doctor'
      }
    }
  }

  if (!isDoctorOpenForPatientBooking(docData)) {
    return {
      success: false,
      message: 'This doctor has not opened appointments yet. Please check back later.'
    }
  }

  const appointmentModeError = getDoctorAppointmentModeError(docData, normalizedType)
  if (appointmentModeError) {
    return { success: false, message: appointmentModeError }
  }

  const doctorLocations = (docData.locations || []).map((l) => String(l || '').trim()).filter(Boolean)
  const resolvedClinicLocation = resolveClinicLocationForSchedule(docData, clinicLocation, normalizedType)

  if (usesClinicWeeklySchedule(normalizedType) && doctorLocations.length > 1 && !resolvedClinicLocation) {
    return { success: false, message: 'Please choose a clinic location' }
  }

  if (
    usesClinicWeeklySchedule(normalizedType) &&
    resolvedClinicLocation &&
    doctorLocations.length > 0 &&
    !doctorLocations.includes(resolvedClinicLocation)
  ) {
    return { success: false, message: 'Please choose a valid clinic location' }
  }

  if (String(paymentMethod).trim() === 'Cash' && docData.acceptsCash === false) {
    return { success: false, message: 'This doctor does not accept cash payment' }
  }
  if (String(paymentMethod).trim() === 'Visa' && docData.acceptsOnlinePayment === false) {
    return { success: false, message: 'This doctor does not accept online payment' }
  }

  const normalizedHomeAddress = normalizeHomeVisitAddress(homeVisitAddress || {})
  if (normalizedType === 'Home Visit') {
    const addressError = validateHomeVisitAddress(normalizedHomeAddress, docData)
    if (addressError) {
      return { success: false, message: addressError }
    }
  }

  const homeVisitPricing = await getHomeVisitPricingSettings()
  const pricing = await applyAppointmentPricing(docData, {
    promoCode: String(promoCode || '').trim(),
    appointmentType: normalizedType,
    homeVisitPricing,
    visitFeeType: normalizedVisitFee
  })
  if (pricing.error) {
    return { success: false, message: pricing.error }
  }

  const scheduleCheck = isSlotAllowedBySchedule(docData, slotDate, slotTime, normalizedType, clinicLocation)
  if (!scheduleCheck.allowed) {
    return { success: false, message: scheduleCheck.reason }
  }

  const userData = await userModel.findById(userId).select('-password -mfa.secret')
  if (!userData || userData.isActive === false) {
    return { success: false, message: 'Patient account is deactivated' }
  }

  const conflictingAppointment = await appointmentModel.findOne({
    docId,
    slotDate,
    slotTime,
    appointmentType: normalizedType,
    appointmentStatus: { $ne: 'Cancelled' }
  })

  if (conflictingAppointment) {
    return {
      success: false,
      message: `Doctor is already booked for this time slot at ${conflictingAppointment.clinicLocation || 'another location'}`
    }
  }

  const bookedSlotsField = getBookedSlotsField(normalizedType)
  const slotUpdate = await doctorModel.updateOne(
    { _id: docId, [`${bookedSlotsField}.${slotDate}`]: { $ne: slotTime } },
    { $addToSet: { [`${bookedSlotsField}.${slotDate}`]: slotTime } }
  )

  if (slotUpdate.modifiedCount === 0) {
    return { success: false, message: 'Slot not available' }
  }

  const appointmentDocData = docData.toObject()
  delete appointmentDocData.slots_booked
  delete appointmentDocData.home_visit_slots_booked

  const appointmentId = new appointmentModel()._id
  const teleconsultationLink = ['Voice Call', 'Video Call'].includes(normalizedType)
    ? buildTeleconsultationLink({ appointmentId, docId, userId, slotDate, slotTime })
    : ''

  const appointmentData = {
    _id: appointmentId,
    reservationNumber: await getNextReservationNumber(),
    userId,
    docId,
    userData,
    docData: appointmentDocData,
    amount: pricing.amount,
    originalAmount: pricing.baseAmount,
    discountAmount: pricing.discountAmount,
    discountReason: pricing.discountReason,
    promoCode: pricing.promoCode,
    visitFeeType: pricing.visitFeeType,
    slotTime,
    slotDate,
    clinicLocation: usesClinicWeeklySchedule(normalizedType) ? resolvedClinicLocation : '',
    appointmentType: normalizedType,
    teleconsultationLink,
    homeVisitAddress:
      normalizedType === 'Home Visit'
        ? { ...normalizedHomeAddress, updatedBy: 'Patient', updatedAt: Date.now() }
        : {},
    date: Date.now(),
    appointmentStatus: 'Booked',
    paymentStatus: 'Not Paid',
    paymentMethod: String(paymentMethod).trim(),
    bookedBy: 'Patient'
  }

  const newAppointment = new appointmentModel(appointmentData)
  try {
    await newAppointment.save()
  } catch (error) {
    // Give the slot back, or a failed save would hide it from every other patient.
    await doctorModel.updateOne({ _id: docId }, { $pull: { [`${bookedSlotsField}.${slotDate}`]: slotTime } })
    throw error
  }

  await logAudit({
    action: 'appointment_create',
    status: 'success',
    targetUserId: userId,
    entityType: 'appointment',
    entityId: newAppointment._id,
    metadata: {
      bookedBy: 'chatbot',
      patientId: userId,
      patientName: userData.name,
      doctorId: docId,
      slotDate,
      slotTime,
      appointmentType: normalizedType
    },
    req
  })

  notifyAppointmentBooked({ appointment: newAppointment, bookedBy: 'Patient' })

  return {
    success: true,
    message: 'Appointment booked successfully',
    appointment: newAppointment,
    reservationNumber: newAppointment.reservationNumber
  }
}

/** Booking needs a logged-in patient. A phone number alone must never act for an account. */
/** Booking needs a logged-in patient. A phone number alone must never act for an account. */
export const resolvePatientForChatbot = async ({ userId }) => {
  if (!userId) {
    return {
      needRegistration: true,
      message: 'Please log in or register to confirm your appointment.'
    }
  }
  const user = await userModel.findById(userId).select('-password -mfa.secret')
  if (user && user.isActive !== false) return { userId: user._id.toString(), user }
  return { error: 'Patient account not found or deactivated' }
}
