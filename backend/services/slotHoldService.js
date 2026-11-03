import appointmentModel from '../models/appointmentModel.js'
import doctorModel from '../models/doctorModel.js'
import slotHoldModel from '../models/slotHoldModel.js'
import userModel from '../models/userModel.js'
import stripe from '../config/stripe.js'
import { logAudit } from './auditService.js'
import {
  createAppointmentFromBooking,
  findActiveUserHold,
  lockSlot,
  unlockSlot
} from './bookingService.js'
import { getDoctorAppointmentModeError, normalizeAppointmentType } from './appointmentModeService.js'
import { canonicalSlotDate, canonicalSlotTime } from './clinicTimeService.js'
import { normalizeVisitFeeType } from './globalVisitFeesService.js'
import { normalizeHomeVisitAddress } from './homeVisitService.js'
import { notifyAppointmentBooked } from './notificationService.js'
import { isSlotAllowedBySchedule, resolveClinicLocationForSchedule, usesClinicWeeklySchedule } from './scheduleService.js'
import { expireWaitlistOffer, markWaitlistBooked, closeWaitlistAfterBooking, processWaitlistForDoctor } from './waitlistService.js'

const STALE_FINALIZING_MS = 60 * 1000
const SWEEP_THROTTLE_MS = 15 * 1000
const lastSweepByDoctor = new Map()

const getStripeChargeId = (intent) => {
  if (typeof intent?.latest_charge === 'string') return intent.latest_charge
  return intent?.latest_charge?.id || ''
}

/** Safe to call repeatedly: Stripe returns the first refund for the same key, and an already-refunded charge is not an error here. */
export const refundIntent = async (intent, reason, metadata = {}) => {
  try {
    return await stripe.refunds.create(
      { payment_intent: intent.id, metadata: { reason, ...metadata } },
      { idempotencyKey: `refund_intent_${intent.id}` }
    )
  } catch (error) {
    if (error?.code === 'charge_already_refunded') return null
    throw error
  }
}

/**
 * Takes a slot for this patient: their own live hold counts as theirs, otherwise an atomic lock.
 * If someone else's hold has lapsed the slot is reclaimed first, so an abandoned checkout
 * never makes the next patient see "not available".
 */
export const acquireSlotForUser = async ({ userId, docId, slotDate, slotTime, appointmentType }) => {
  const ownHold = await findActiveUserHold({ userId, docId, slotDate, slotTime })
  if (ownHold) return { ok: true, hold: ownHold }

  if (await lockSlot({ docId, slotDate, slotTime, appointmentType })) return { ok: true, hold: null }

  await sweepExpiredHolds({ docId, force: true })
  if (await lockSlot({ docId, slotDate, slotTime, appointmentType })) return { ok: true, hold: null }
  return { ok: false }
}

export const consumeHold = async (hold) => {
  if (!hold) return
  await slotHoldModel.updateOne({ _id: hold._id }, { state: 'booked', slotReleased: false })
  await markWaitlistBooked(hold)
}

const bookingFromMetadata = (intent, hold) => {
  const metadata = intent.metadata || {}
  const draft = hold?.draft || {}
  return {
    slotDate: canonicalSlotDate(hold?.slotDate || metadata.slotDate),
    slotTime: canonicalSlotTime(hold?.slotTime || metadata.slotTime),
    appointmentType: normalizeAppointmentType(hold?.appointmentType || metadata.appointmentType),
    visitFeeType: normalizeVisitFeeType(draft.visitFeeType || metadata.visitFeeType),
    clinicLocation: draft.clinicLocation ?? metadata.clinicLocation ?? '',
    homeVisitAddress: normalizeHomeVisitAddress(draft.homeVisitAddress || {
      area: metadata.homeVisitArea,
      street: metadata.homeVisitStreet,
      building: metadata.homeVisitBuilding,
      floor: metadata.homeVisitFloor,
      apartment: metadata.homeVisitApartment,
      notes: metadata.homeVisitNotes
    }),
    pricing: draft.pricing || {
      baseAmount: Number(metadata.originalAmount || 0),
      discountAmount: Number(metadata.discountAmount || 0),
      discountReason: metadata.discountReason || '',
      homeVisitSurcharge: Number(metadata.homeVisitSurcharge || 0),
      promoCode: metadata.promoCode || ''
    }
  }
}

const refundAndClose = async ({ intent, hold, reason, message, userId, docId, releaseSlot }) => {
  await refundIntent(intent, reason, { userId, docId })
  await slotHoldModel.updateOne({ _id: hold._id }, {
    state: 'refunded',
    resultMessage: message,
    ...(releaseSlot ? { slotReleased: true } : {})
  })
  if (releaseSlot) await unlockSlot(hold)
  return { status: 'refunded', message }
}

const claimHoldForFinalizing = async (intent, now) => {
  const claimed = await slotHoldModel.findOneAndUpdate(
    {
      paymentIntentId: intent.id,
      $or: [
        { state: { $in: ['held', 'expired', 'released'] } },
        { state: 'finalizing', claimedAt: { $lt: now - STALE_FINALIZING_MS } }
      ]
    },
    { state: 'finalizing', claimedAt: now },
    { new: false }
  )
  if (claimed) {
    return { hold: claimed, slotStillOurs: !claimed.slotReleased }
  }
  return { hold: await slotHoldModel.findOne({ paymentIntentId: intent.id }), notClaimed: true }
}

/**
 * Exactly-once creation of an appointment from a succeeded payment. Runs from the patient's
 * confirm call, from a retry of that call, and from the sweep when the browser never came back.
 * Whichever arrives first wins the hold; the others find the result.
 */
export const finalizePaidBooking = async ({ intent, req, now = Date.now() }) => {
  const existing = await appointmentModel.findOne({ stripePaymentIntentId: intent.id })
  if (existing) return { status: 'booked', appointment: existing, alreadyConfirmed: true }

  const metadata = intent.metadata || {}
  const userId = metadata.userId
  const docId = metadata.docId
  let { hold, slotStillOurs, notClaimed } = await claimHoldForFinalizing(intent, now)

  if (notClaimed && hold) {
    if (hold.state === 'booked') {
      const booked = await appointmentModel.findOne({ stripePaymentIntentId: intent.id })
      if (booked) return { status: 'booked', appointment: booked, alreadyConfirmed: true }
    }
    if (hold.state === 'refunded') return { status: 'refunded', message: hold.resultMessage }
    return { status: 'pending', message: 'Your payment is being confirmed' }
  }

  if (!hold) {
    // A payment started before holds existed, or whose hold was lost. Treat the slot as not yet ours.
    const legacy = bookingFromMetadata(intent, null)
    hold = await slotHoldModel.create({
      docId,
      userId,
      slotDate: legacy.slotDate,
      slotTime: legacy.slotTime,
      appointmentType: legacy.appointmentType,
      kind: 'payment',
      state: 'finalizing',
      claimedAt: now,
      expiresAt: now,
      slotReleased: true,
      paymentIntentId: intent.id,
      draft: {}
    })
    slotStillOurs = false
  }

  const booking = bookingFromMetadata(intent, hold)
  const refund = (reason, message, releaseSlot = slotStillOurs) =>
    refundAndClose({ intent, hold, reason, message, userId, docId, releaseSlot })

  const doctor = await doctorModel.findById(docId).select('-password')
  const user = await userModel.findById(userId).select('-password')
  if (!doctor || !user || user.isActive === false) {
    return refund('doctor_or_patient_unavailable', 'Appointment is no longer available. Payment refund was requested.')
  }
  if (getDoctorAppointmentModeError(doctor, booking.appointmentType)) {
    return refund('doctor_appointment_mode_changed', 'Doctor no longer accepts this appointment type. Payment refund was requested.')
  }
  if (doctor.acceptsOnlinePayment === false) {
    return refund('doctor_payment_method_changed', 'Doctor no longer accepts online payment. Payment refund was requested.')
  }

  const clinicLocation = resolveClinicLocationForSchedule(doctor, booking.clinicLocation, booking.appointmentType)
  // A slot this payment already holds may start while the patient is paying. Only a slot it must win again is re-checked for time.
  const scheduleCheck = isSlotAllowedBySchedule(doctor, booking.slotDate, booking.slotTime, booking.appointmentType, clinicLocation, slotStillOurs ? { now: new Date(hold.createdAt) } : {})
  if (!scheduleCheck.allowed) {
    return refund('slot_schedule_changed', 'Slot is no longer available. Payment refund was requested.')
  }

  if (!slotStillOurs) {
    const locked = await lockSlot({ docId, slotDate: booking.slotDate, slotTime: booking.slotTime, appointmentType: booking.appointmentType })
    if (!locked) {
      return refund('slot_taken_after_payment', 'Slot was just booked by someone else. Payment refund was requested.', false)
    }
    slotStillOurs = true
  }

  const created = await createAppointmentFromBooking({
    docId,
    doctor,
    user,
    slotDate: booking.slotDate,
    slotTime: booking.slotTime,
    appointmentType: booking.appointmentType,
    visitFeeType: booking.visitFeeType,
    homeVisitAddress: booking.homeVisitAddress,
    clinicLocation: usesClinicWeeklySchedule(booking.appointmentType) ? clinicLocation : '',
    pricing: booking.pricing
  }, {
    amountOverride: Number(intent.amount_received || intent.amount || 0) / 100,
    fields: {
      paymentStatus: 'Paid',
      paymentMethod: 'Visa',
      paidAt: now,
      stripePaymentIntentId: intent.id,
      stripeChargeId: getStripeChargeId(intent),
      refundStatus: 'Not Refunded'
    }
  })

  if (created.slotConflict) {
    if (created.keyPattern?.stripePaymentIntentId) {
      const winner = await appointmentModel.findOne({ stripePaymentIntentId: intent.id })
      if (winner) return { status: 'booked', appointment: winner, alreadyConfirmed: true }
    }
    return refund('slot_double_booked', 'Slot was just booked by someone else. Payment refund was requested.', false)
  }

  await consumeHold(hold)
  await closeWaitlistAfterBooking({ userId, docId, slotDate: booking.slotDate })

  await logAudit({
    action: 'appointment_create',
    status: 'success',
    targetUserId: userId,
    entityType: 'appointment',
    entityId: created.appointment._id,
    metadata: {
      bookedBy: 'patient',
      paymentMethod: 'Visa',
      paymentIntentId: intent.id,
      patientId: userId,
      patientName: user.name,
      patientLoginId: user.patientId,
      doctorId: docId,
      doctorName: doctor.name,
      slotDate: booking.slotDate,
      slotTime: booking.slotTime,
      appointmentType: booking.appointmentType
    },
    req
  })

  notifyAppointmentBooked({ appointment: created.appointment, bookedBy: 'Patient' })
  return { status: 'booked', appointment: created.appointment }
}

const expireHold = async (hold, now) => {
  const claimed = await slotHoldModel.findOneAndUpdate(
    { _id: hold._id, state: 'held', expiresAt: { $lte: now } },
    { state: 'expired', slotReleased: true },
    { new: true }
  )
  if (!claimed) return false
  await unlockSlot(claimed)
  await expireWaitlistOffer(claimed, { now })
  return true
}

const resolveExpiredPaymentHold = async (hold, now) => {
  if (hold.paymentIntentId && stripe) {
    const intent = await stripe.paymentIntents.retrieve(hold.paymentIntentId, { expand: ['latest_charge'] })
    if (intent.status === 'succeeded') {
      // The patient paid but their browser never confirmed. They keep the slot.
      await finalizePaidBooking({ intent, now })
      return
    }
    if (!['canceled'].includes(intent.status)) {
      try {
        await stripe.paymentIntents.cancel(hold.paymentIntentId, { cancellation_reason: 'abandoned' })
      } catch (error) {
        // Paid in the same instant: the next sweep or the confirm call finalizes it.
        console.error('slot hold: could not cancel payment intent', hold.paymentIntentId, error.message)
        return
      }
    }
  }
  await expireHold(hold, now)
}

/**
 * There is no background worker on the serverless deployment, so expiry runs when someone needs
 * the answer: reading availability, trying to book, or opening their appointments.
 */
export const sweepExpiredHolds = async ({ docId, force = false, now = Date.now() } = {}) => {
  const key = docId || '*'
  if (!force && now - (lastSweepByDoctor.get(key) || 0) < SWEEP_THROTTLE_MS) return 0
  lastSweepByDoctor.set(key, now)

  const expired = await slotHoldModel
    .find({ ...(docId ? { docId } : {}), state: 'held', expiresAt: { $lte: now } })
    .limit(50)

  for (const hold of expired) {
    try {
      if (hold.kind === 'payment') await resolveExpiredPaymentHold(hold, now)
      else await expireHold(hold, now)
    } catch (error) {
      console.error('slot hold sweep failed', String(hold._id), error.message)
    }
  }
  if (docId) await processWaitlistForDoctor(docId, { now }).catch((error) => console.error('waitlist', error.message))
  return expired.length
}

/** Recovers a paid checkout when the patient comes back: their appointment appears even if the confirm call was lost. */
export const reconcileUserHolds = async (userId, { now = Date.now() } = {}) => {
  if (!stripe) return
  const holds = await slotHoldModel
    .find({ userId, kind: 'payment', state: { $in: ['held', 'finalizing'] }, paymentIntentId: { $gt: '' } })
    .limit(5)
  for (const hold of holds) {
    try {
      const intent = await stripe.paymentIntents.retrieve(hold.paymentIntentId, { expand: ['latest_charge'] })
      if (intent.status === 'succeeded') await finalizePaidBooking({ intent, now })
    } catch (error) {
      console.error('reconcile hold failed', String(hold._id), error.message)
    }
  }
}

export const resetSweepThrottle = () => lastSweepByDoctor.clear()
