import mongoose from 'mongoose'
import appointmentModel from '../models/appointmentModel.js'
import doctorModel from '../models/doctorModel.js'
import slotHoldModel from '../models/slotHoldModel.js'
import userModel from '../models/userModel.js'
import { applyAppointmentPricing } from './appointmentPricingService.js'
import { buildTeleconsultationLink, getDoctorAppointmentModeError, normalizeAppointmentTeleconsultationLink, normalizeAppointmentType } from './appointmentModeService.js'
import { canonicalSlotDate, canonicalSlotTime, slotStartDate } from './clinicTimeService.js'
import { normalizeVisitFeeType } from './globalVisitFeesService.js'
import { normalizeHomeVisitAddress, validateHomeVisitAddress } from './homeVisitService.js'
import { getHomeVisitPricingSettings } from './homeVisitPricingService.js'
import { getEffectiveVerificationStatus, isInsuranceExpired } from './insuranceVerificationService.js'
import { getNextReservationNumber } from './reservationService.js'
import {
  getBookedSlotsField,
  getDoctorSchedule,
  isDoctorOpenForPatientBooking,
  isSlotAllowedBySchedule,
  resolveClinicLocationForSchedule,
  usesClinicWeeklySchedule
} from './scheduleService.js'
import { patientCanBookConsultation } from './visitFeeEligibilityService.js'

export const PAYMENT_HOLD_MS = 10 * 60 * 1000
export const MAX_ACTIVE_HOLDS_PER_USER = 3
export const MAX_RESCHEDULES = 3
const TELE_JOIN_OPENS_BEFORE_MS = 15 * 60 * 1000
const DEFAULT_VISIT_MINUTES = 30

const DOCTOR_SECRET_FIELDS = ['password', 'mfa', 'financialCompensation', 'slots_booked', 'home_visit_slots_booked']
const PATIENT_SECRET_FIELDS = [
  'password', 'mfa', 'resetOtp', 'resetOtpExpireAt',
  'emailVerifyOtp', 'emailVerifyOtpExpireAt', 'emailVerifyOtpSentAt',
  'phoneVerifyOtp', 'phoneVerifyOtpExpireAt', 'phoneVerifyOtpSentAt',
  'medicalHistory'
]

const withoutFields = (source, fields) => {
  const plain = typeof source?.toObject === 'function' ? source.toObject() : { ...(source || {}) }
  fields.forEach((field) => delete plain[field])
  return plain
}

/** Appointments copy the doctor and patient. The copy must never carry secrets or medical history. */
export const sanitizeDoctorSnapshot = (doctor) => withoutFields(doctor, DOCTOR_SECRET_FIELDS)
export const sanitizeUserSnapshot = (user) => withoutFields(user, PATIENT_SECRET_FIELDS)

export const isValidId = (value) => typeof value === 'string' && mongoose.isValidObjectId(value)

export const getVisitMinutes = (appointment) => {
  try {
    const schedule = getDoctorSchedule(appointment.docData || {}, appointment.appointmentType, appointment.clinicLocation)
    return Number(schedule.slotDuration) || DEFAULT_VISIT_MINUTES
  } catch {
    return DEFAULT_VISIT_MINUTES
  }
}

const isActiveAppointment = (appointment) =>
  !appointment.cancelled && !appointment.isCompleted && appointment.appointmentStatus !== 'Cancelled' && appointment.appointmentStatus !== 'Finished'

/** What the patient's app receives: only what it shows, plus what they may do next, decided here. */
export const toPatientAppointment = (appointment, { now = Date.now(), rating = null } = {}) => {
  const plain = normalizeAppointmentTeleconsultationLink(appointment)
  const starts = slotStartDate(plain.slotDate, plain.slotTime)
  const startsAt = starts ? starts.getTime() : null
  const endsAt = startsAt === null ? null : startsAt + getVisitMinutes(plain) * 60 * 1000
  const active = isActiveAppointment(plain)
  const notStarted = startsAt === null || startsAt > now
  const untouched = active && plain.appointmentStatus === 'Booked' && notStarted
  const isTele = ['Voice Call', 'Video Call'].includes(plain.appointmentType)
  const doc = plain.docData || {}

  return {
    ...plain,
    docData: {
      name: doc.name,
      image: doc.image,
      speciality: doc.speciality,
      degree: doc.degree,
      address: doc.address,
      i18n: doc.i18n
    },
    userData: {
      name: plain.userData?.name,
      patientId: plain.userData?.patientId
    },
    teleconsultationLink: active && isTele ? plain.teleconsultationLink : '',
    startsAt,
    endsAt,
    joinOpensAt: isTele && startsAt !== null ? startsAt - TELE_JOIN_OPENS_BEFORE_MS : null,
    canCancel: untouched,
    canReschedule: untouched && Number(plain.rescheduleCount || 0) < MAX_RESCHEDULES,
    canPayOnline:
      untouched &&
      plain.paymentStatus !== 'Paid' &&
      plain.paymentMethod !== 'Insurance' &&
      !plain.coveredByInsurance &&
      plain.refundStatus === 'Not Refunded' &&
      Number(plain.amount) > 0,
    myRating: rating
  }
}

export const buildQuote = async (doctor, { appointmentType, visitFeeType, promoCode = '' }) => {
  const homeVisitPricing = await getHomeVisitPricingSettings()
  return applyAppointmentPricing(doctor, { promoCode, appointmentType, homeVisitPricing, visitFeeType })
}

const fail = (message) => ({ error: message })

const getPaymentMethodError = (doctor, user, paymentMethod) => {
  if (paymentMethod === 'Cash' && doctor.acceptsCash === false) return 'This doctor does not accept cash payment'
  if (paymentMethod === 'Visa' && doctor.acceptsOnlinePayment === false) return 'This doctor does not accept online payment'
  if (paymentMethod === 'Insurance') {
    const insurance = user?.insurance || {}
    if (!insurance.enabled) return 'Add your insurance card in your profile first'
    if (isInsuranceExpired(insurance.expiryDate)) return 'Your insurance card has expired. Please update it or choose another payment method.'
    if (getEffectiveVerificationStatus(insurance) === 'declined') return 'Your insurance was declined. Please update it or choose another payment method.'
  }
  return ''
}

/**
 * Every check a patient booking must pass, shared by cash, insurance and online payment.
 * The amount is always computed here, from the doctor record, never taken from the client.
 */
export const validateBookingRequest = async ({ userId, body = {}, paymentMethod, now = new Date() }) => {
  const docId = body.docId
  if (!isValidId(docId)) return fail('Doctor not found')

  const slotDate = canonicalSlotDate(body.slotDate)
  const slotTime = canonicalSlotTime(body.slotTime)
  if (!slotDate || !slotTime) return fail('Invalid appointment date or time')

  const appointmentType = normalizeAppointmentType(body.appointmentType)
  const visitFeeType = normalizeVisitFeeType(body.visitFeeType)
  const homeVisitAddress = normalizeHomeVisitAddress(body.homeVisitAddress || {})
  const clinicLocation = String(body.clinicLocation || '').trim()

  const doctor = await doctorModel.findById(docId).select('-password')
  if (!doctor) return fail('Doctor not found')
  if (doctor.available === false) return fail('This doctor is not accepting appointments right now')

  if (appointmentType === 'Home Visit') {
    const addressError = validateHomeVisitAddress(homeVisitAddress, doctor)
    if (addressError) return fail(addressError)
  }
  if (visitFeeType === 'consultation') {
    const eligibility = await patientCanBookConsultation(userId, docId, { slotDate })
    if (!eligibility.allowed) {
      return fail('Follow-up consultation is only available within 30 days of a completed examination with this doctor')
    }
  }
  if (!isDoctorOpenForPatientBooking(doctor)) {
    return fail('This doctor has not opened appointments yet. Please check back later.')
  }
  const modeError = getDoctorAppointmentModeError(doctor, appointmentType)
  if (modeError) return fail(modeError)

  const doctorLocations = (doctor.locations || []).map((location) => String(location || '').trim()).filter(Boolean)
  const resolvedClinicLocation = resolveClinicLocationForSchedule(doctor, clinicLocation, appointmentType)
  if (usesClinicWeeklySchedule(appointmentType) && doctorLocations.length > 1 && !resolvedClinicLocation) {
    return fail('Please choose a clinic location')
  }
  if (usesClinicWeeklySchedule(appointmentType) && resolvedClinicLocation && doctorLocations.length > 0 && !doctorLocations.includes(resolvedClinicLocation)) {
    return fail('Please choose a valid clinic location')
  }

  const user = await userModel.findById(userId).select('-password')
  if (!user || user.isActive === false) return fail('Patient account is deactivated')

  const paymentError = getPaymentMethodError(doctor, user, paymentMethod)
  if (paymentError) return fail(paymentError)

  const scheduleCheck = isSlotAllowedBySchedule(doctor, slotDate, slotTime, appointmentType, resolvedClinicLocation, { now })
  if (!scheduleCheck.allowed) return fail(scheduleCheck.reason)

  const pricing = await buildQuote(doctor, { appointmentType, visitFeeType, promoCode: String(body.promoCode || '').trim() })
  if (pricing.error) return fail(pricing.error)

  return {
    docId,
    doctor,
    user,
    slotDate,
    slotTime,
    appointmentType,
    visitFeeType,
    homeVisitAddress,
    clinicLocation: usesClinicWeeklySchedule(appointmentType) ? resolvedClinicLocation : '',
    pricing
  }
}

/** Atomic on the doctor document, the same primitive reception and the chatbot use. */
export const lockSlot = async ({ docId, slotDate, slotTime, appointmentType }) => {
  const field = getBookedSlotsField(appointmentType)
  const result = await doctorModel.updateOne(
    { _id: docId, [`${field}.${slotDate}`]: { $ne: slotTime } },
    { $addToSet: { [`${field}.${slotDate}`]: slotTime } }
  )
  return result.modifiedCount > 0
}

/** Gives the slot back unless a live appointment owns it. $pull, never a rewrite, so concurrent bookings survive. */
export const unlockSlot = async ({ docId, slotDate, slotTime, appointmentType }) => {
  const stillBooked = await appointmentModel.exists({ docId, slotDate, slotTime, cancelled: false })
  if (stillBooked) return false
  const field = getBookedSlotsField(appointmentType)
  await doctorModel.updateOne({ _id: docId }, { $pull: { [`${field}.${slotDate}`]: slotTime } })
  return true
}

export const findActiveUserHold = ({ userId, docId, slotDate, slotTime, now = Date.now() }) =>
  slotHoldModel.findOne({ userId, docId, slotDate, slotTime, state: 'held', expiresAt: { $gt: now } })

export const releaseHold = async (hold, nextState = 'released') => {
  const claimed = await slotHoldModel.findOneAndUpdate(
    { _id: hold._id, state: 'held' },
    { state: nextState, slotReleased: true },
    { new: true }
  )
  if (!claimed) return false
  await unlockSlot(claimed)
  return true
}

export const findOwnActiveAppointment = ({ userId, docId, slotDate, slotTime }) =>
  appointmentModel.findOne({ userId, docId, slotDate, slotTime, cancelled: false })

export const findPatientClash = ({ userId, slotDate, slotTime, excludeId }) =>
  appointmentModel.findOne({
    userId,
    slotDate,
    slotTime,
    cancelled: false,
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  }).select('_id docId').lean()

const isDuplicateKey = (error) => error?.code === 11000

/**
 * Turns a validated request into an appointment. The slot must already be locked by the caller,
 * and if the write fails the caller gets `slotConflict`.
 */
export const createAppointmentFromBooking = async (booking, payment) => {
  const { docId, doctor, user, slotDate, slotTime, appointmentType, visitFeeType, homeVisitAddress, clinicLocation, pricing } = booking
  const userId = String(user._id)
  const appointmentId = new appointmentModel()._id
  const isTele = ['Voice Call', 'Video Call'].includes(appointmentType)

  const paymentFields = payment.amountOverride === undefined && Number(pricing.amount) <= 0
    ? { paymentMethod: 'Free', paymentStatus: 'Paid', paidAt: Date.now() }
    : payment.fields

  try {
    const appointment = await new appointmentModel({
      _id: appointmentId,
      reservationNumber: await getNextReservationNumber(),
      userId,
      docId,
      userData: sanitizeUserSnapshot(user),
      docData: sanitizeDoctorSnapshot(doctor),
      amount: payment.amountOverride ?? pricing.amount,
      originalAmount: pricing.baseAmount,
      discountAmount: pricing.discountAmount,
      discountReason: pricing.discountReason,
      homeVisitSurcharge: pricing.homeVisitSurcharge || 0,
      promoCode: pricing.promoCode,
      visitFeeType: pricing.visitFeeType || visitFeeType,
      slotTime,
      slotDate,
      clinicLocation,
      appointmentType,
      teleconsultationLink: isTele ? buildTeleconsultationLink({ appointmentId, docId, userId, slotDate, slotTime, appointmentType }) : '',
      homeVisitAddress: appointmentType === 'Home Visit' ? { ...homeVisitAddress, updatedBy: 'Patient', updatedAt: Date.now() } : {},
      date: Date.now(),
      appointmentStatus: 'Booked',
      bookedBy: 'Patient',
      ...paymentFields
    }).save()
    return { appointment }
  } catch (error) {
    if (isDuplicateKey(error)) return { slotConflict: true, keyPattern: error.keyPattern }
    throw error
  }
}
