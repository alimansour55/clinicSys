import appointmentModel from '../models/appointmentModel.js'
import slotHoldModel from '../models/slotHoldModel.js'
import stripe, { stripeCurrency } from '../config/stripe.js'
import { logAudit } from '../services/auditService.js'
import {
  MAX_ACTIVE_HOLDS_PER_USER,
  PAYMENT_HOLD_MS,
  findOwnActiveAppointment,
  findPatientClash,
  isValidId,
  releaseHold,
  toPatientAppointment,
  validateBookingRequest
} from '../services/bookingService.js'
import { notifyPaymentRecorded, pushNotification, getAdminRecipientId } from '../services/notificationService.js'
import { acquireSlotForUser, finalizePaidBooking, refundIntent } from '../services/slotHoldService.js'
import { processWaitlistForDoctor } from '../services/waitlistService.js'

const STRIPE_METADATA_VALUE_LIMIT = 450

const ensureStripe = () => {
  if (!stripe) {
    const error = new Error('Stripe is not configured')
    error.statusCode = 500
    throw error
  }
}

const toMinorUnits = (amount) => Math.round(Number(amount || 0) * 100)

const getStripeChargeId = (intent) => {
  if (!intent) return ''
  if (typeof intent.latest_charge === 'string') return intent.latest_charge
  if (intent.latest_charge?.id) return intent.latest_charge.id
  return ''
}

const metadataValue = (value) => String(value ?? '').slice(0, STRIPE_METADATA_VALUE_LIMIT)

const STILL_PAYABLE_INTENT_STATUSES = ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing']

const cancelIntentQuietly = async (paymentIntentId) => {
  if (!paymentIntentId) return
  try {
    await stripe.paymentIntents.cancel(paymentIntentId, { cancellation_reason: 'abandoned' })
  } catch (error) {
    console.error('Could not cancel payment intent', paymentIntentId, error.message)
  }
}

/** Stops an unfinished checkout and frees its slot, unless the payment has already gone through. */
const abandonPaymentHold = async (hold) => {
  if (hold.paymentIntentId) {
    const intent = await stripe.paymentIntents.retrieve(hold.paymentIntentId)
    if (intent.status === 'succeeded') return { paidIntentId: intent.id }
    if (STILL_PAYABLE_INTENT_STATUSES.includes(intent.status)) await cancelIntentQuietly(hold.paymentIntentId)
  }
  await releaseHold(hold)
  return {}
}

const intentResponse = (intent, hold, amount) => ({
  success: true,
  clientSecret: intent.client_secret,
  paymentIntentId: intent.id,
  amount,
  currency: stripeCurrency,
  holdExpiresAt: hold.expiresAt
})

const createBookingPaymentIntent = async (req, res) => {
  let hold = null
  let startedNewHold = false

  try {
    ensureStripe()

    const userId = req.user.userId
    const now = Date.now()
    const booking = await validateBookingRequest({ userId, body: req.body, paymentMethod: 'Visa' })
    if (booking.error) return res.json({ success: false, message: booking.error })

    const { docId, doctor, user, slotDate, slotTime, appointmentType, visitFeeType, clinicLocation, homeVisitAddress, pricing } = booking

    const alreadyBooked = await findOwnActiveAppointment({ userId, docId, slotDate, slotTime })
    if (alreadyBooked) {
      return res.json({ success: true, alreadyBooked: true, appointment: toPatientAppointment(alreadyBooked) })
    }
    if (await findPatientClash({ userId, slotDate, slotTime })) {
      return res.json({ success: false, message: 'You already have another appointment at this time' })
    }

    const amountInMinorUnits = toMinorUnits(pricing.amount)
    if (!Number.isFinite(amountInMinorUnits) || amountInMinorUnits <= 0) {
      return res.json({ success: false, message: 'Invalid appointment amount' })
    }

    // A patient has one checkout per doctor at a time. Moving to a new slot lets the old one go.
    const otherCheckouts = await slotHoldModel.find({ userId, docId, kind: 'payment', state: 'held' })
    for (const previous of otherCheckouts) {
      const sameSlot = previous.slotDate === slotDate && previous.slotTime === slotTime
      if (sameSlot && previous.expiresAt > now && previous.draft?.amountMinor === amountInMinorUnits && previous.draft?.clinicLocation === clinicLocation && previous.appointmentType === appointmentType) {
        const intent = await stripe.paymentIntents.retrieve(previous.paymentIntentId)
        if (STILL_PAYABLE_INTENT_STATUSES.includes(intent.status)) {
          return res.json(intentResponse(intent, previous, pricing.amount))
        }
        if (intent.status === 'succeeded') {
          const result = await finalizePaidBooking({ intent, req })
          if (result.status === 'booked') {
            return res.json({ success: true, alreadyBooked: true, appointment: toPatientAppointment(result.appointment) })
          }
        }
      }
      const abandoned = await abandonPaymentHold(previous)
      if (abandoned.paidIntentId) {
        return res.json({ success: false, message: 'Your earlier payment for this doctor is still being confirmed. Please check your appointments.' })
      }
    }

    const activeHolds = await slotHoldModel.countDocuments({ userId, kind: 'payment', state: 'held', expiresAt: { $gt: now } })
    if (activeHolds >= MAX_ACTIVE_HOLDS_PER_USER) {
      return res.json({ success: false, message: 'Please finish your other checkouts first' })
    }

    const acquired = await acquireSlotForUser({ userId, docId, slotDate, slotTime, appointmentType })
    if (!acquired.ok) return res.json({ success: false, message: 'Slot not available' })

    const expiresAt = now + PAYMENT_HOLD_MS
    const draft = {
      clinicLocation,
      visitFeeType,
      homeVisitAddress,
      amountMinor: amountInMinorUnits,
      pricing: {
        baseAmount: pricing.baseAmount,
        discountAmount: pricing.discountAmount,
        discountReason: pricing.discountReason,
        homeVisitSurcharge: pricing.homeVisitSurcharge || 0,
        promoCode: pricing.promoCode,
        visitFeeType: pricing.visitFeeType
      }
    }

    if (acquired.hold) {
      // A waitlist offer becomes this checkout, keeping its place in the queue record.
      hold = await slotHoldModel.findByIdAndUpdate(acquired.hold._id, { kind: 'payment', expiresAt, draft, appointmentType }, { new: true })
    } else {
      startedNewHold = true
      hold = await slotHoldModel.create({ docId, userId, slotDate, slotTime, appointmentType, kind: 'payment', expiresAt, draft })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInMinorUnits,
      currency: stripeCurrency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        flow: 'appointment_booking',
        holdId: String(hold._id),
        userId,
        docId,
        slotDate,
        slotTime,
        clinicLocation: metadataValue(clinicLocation),
        appointmentType,
        promoCode: metadataValue(pricing.promoCode),
        visitFeeType: pricing.visitFeeType,
        discountAmount: String(pricing.discountAmount),
        homeVisitSurcharge: String(pricing.homeVisitSurcharge || 0),
        originalAmount: String(pricing.baseAmount),
        patientName: metadataValue(user.name),
        doctorName: metadataValue(doctor.name)
      }
    }, { idempotencyKey: `booking_hold_${hold._id}` })

    hold = await slotHoldModel.findByIdAndUpdate(hold._id, { paymentIntentId: paymentIntent.id }, { new: true })

    res.json(intentResponse(paymentIntent, hold, pricing.amount))
  } catch (error) {
    console.log(error)
    if (hold && startedNewHold) await releaseHold(hold).catch(() => {})
    res.json({ success: false, message: error.message })
  }
}

const confirmBookingPaymentIntent = async (req, res) => {
  try {
    ensureStripe()

    const userId = req.user.userId
    const { paymentIntentId } = req.body
    if (typeof paymentIntentId !== 'string' || !paymentIntentId) {
      return res.json({ success: false, message: 'Payment was not completed' })
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] })
    if (intent?.metadata?.flow !== 'appointment_booking' || intent?.metadata?.userId !== userId) {
      return res.json({ success: false, message: 'Payment does not match this booking' })
    }
    if (intent.status !== 'succeeded') {
      return res.json({ success: false, message: 'Payment was not completed' })
    }

    const result = await finalizePaidBooking({ intent, req })

    if (result.status === 'booked') {
      return res.json({
        success: true,
        message: 'Payment confirmed and appointment booked',
        appointmentId: result.appointment._id,
        appointment: toPatientAppointment(result.appointment)
      })
    }
    if (result.status === 'pending') {
      return res.json({ success: false, pending: true, message: result.message })
    }
    res.json({ success: false, refunded: true, message: result.message })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

/** Patient changed their mind at checkout: frees the slot now rather than in ten minutes. */
const releaseBookingHold = async (req, res) => {
  try {
    ensureStripe()
    const userId = req.user.userId
    const { paymentIntentId } = req.body
    if (typeof paymentIntentId !== 'string' || !paymentIntentId) {
      return res.json({ success: false, message: 'Missing payment' })
    }
    const hold = await slotHoldModel.findOne({ paymentIntentId, userId, state: 'held' })
    if (!hold) return res.json({ success: true, released: false })

    const abandoned = await abandonPaymentHold(hold)
    if (abandoned.paidIntentId) return res.json({ success: true, released: false, paid: true })

    await processWaitlistForDoctor(hold.docId)
    res.json({ success: true, released: true })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const createPaymentIntent = async (req, res) => {
  try {
    ensureStripe()

    const userId = req.user.userId
    const { appointmentId } = req.body
    if (!isValidId(appointmentId)) return res.json({ success: false, message: 'Appointment not found' })

    const appointment = await appointmentModel.findById(appointmentId)
    if (!appointment || appointment.userId !== userId) {
      return res.json({ success: false, message: 'Appointment not found' })
    }

    if (appointment.cancelled || appointment.appointmentStatus === 'Cancelled') {
      return res.json({ success: false, message: 'Cancelled appointments cannot be paid' })
    }

    if (appointment.paymentStatus === 'Paid') {
      return res.json({ success: false, message: 'Appointment is already paid' })
    }

    if (!toPatientAppointment(appointment).canPayOnline) {
      return res.json({ success: false, message: 'This appointment cannot be paid online' })
    }

    if (appointment.docData?.acceptsOnlinePayment === false) {
      return res.json({ success: false, message: 'This doctor does not accept online payment' })
    }

    const amount = toMinorUnits(appointment.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.json({ success: false, message: 'Invalid appointment amount' })
    }

    if (appointment.stripePaymentIntentId) {
      const existingIntent = await stripe.paymentIntents.retrieve(appointment.stripePaymentIntentId)
      if (existingIntent && !['canceled', 'succeeded'].includes(existingIntent.status)) {
        if (existingIntent.amount === amount) {
          return res.json({
            success: true,
            clientSecret: existingIntent.client_secret,
            paymentIntentId: existingIntent.id,
            amount: appointment.amount,
            currency: stripeCurrency
          })
        }
        // Reception changed the amount since this intent was made.
        await cancelIntentQuietly(existingIntent.id)
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: stripeCurrency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        appointmentId: appointment._id.toString(),
        userId,
        doctorId: appointment.docId,
        patientName: metadataValue(appointment.userData?.name)
      }
    })

    // The method only becomes Visa when the money arrives. Until then it stays whatever the patient chose.
    await appointmentModel.findByIdAndUpdate(appointmentId, { stripePaymentIntentId: paymentIntent.id })

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: appointment.amount,
      currency: stripeCurrency
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const confirmPaymentIntent = async (req, res) => {
  try {
    ensureStripe()

    const userId = req.user.userId
    const { appointmentId, paymentIntentId } = req.body
    if (!isValidId(appointmentId) || typeof paymentIntentId !== 'string' || !paymentIntentId) {
      return res.json({ success: false, message: 'Appointment not found' })
    }

    const appointment = await appointmentModel.findById(appointmentId)
    if (!appointment || appointment.userId !== userId) {
      return res.json({ success: false, message: 'Appointment not found' })
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] })
    if (!intent || intent.status !== 'succeeded') {
      return res.json({ success: false, message: 'Payment was not completed' })
    }

    if (intent.metadata?.appointmentId !== appointmentId || intent.metadata?.userId !== userId) {
      return res.json({ success: false, message: 'Payment does not match this appointment' })
    }

    if (appointment.paymentStatus === 'Paid' && appointment.stripePaymentIntentId === intent.id) {
      return res.json({ success: true, message: 'Payment confirmed', appointment: toPatientAppointment(appointment) })
    }

    // Paid after the visit was cancelled, or after reception recorded another payment: the money goes back.
    const claimed = await appointmentModel.findOneAndUpdate(
      {
        _id: appointmentId,
        userId,
        cancelled: false,
        paymentStatus: { $ne: 'Paid' },
        refundStatus: 'Not Refunded',
        amount: Number(intent.amount_received || intent.amount || 0) / 100
      },
      {
        paymentStatus: 'Paid',
        paymentMethod: 'Visa',
        paidAt: Date.now(),
        stripePaymentIntentId: intent.id,
        stripeChargeId: getStripeChargeId(intent)
      },
      { new: true }
    )

    if (!claimed) {
      await refundIntent(intent, 'appointment_not_payable', { appointmentId, userId })
      await logAudit({
        action: 'stripe_refund',
        status: 'success',
        reason: 'Payment arrived for an appointment that could not take it',
        targetUserId: userId,
        entityType: 'appointment',
        entityId: appointmentId,
        metadata: { paymentIntentId: intent.id },
        req
      })
      return res.json({ success: false, refunded: true, message: 'This appointment can no longer be paid. Payment refund was requested.' })
    }

    await logAudit({
      action: 'stripe_payment_confirm',
      status: 'success',
      targetUserId: appointment.userId,
      entityType: 'appointment',
      entityId: appointmentId,
      metadata: {
        paymentIntentId: intent.id,
        amount: appointment.amount,
        currency: intent.currency
      },
      req
    })

    await notifyPaymentRecorded({ appointment: claimed, source: 'online' })

    res.json({ success: true, message: 'Payment confirmed', appointment: toPatientAppointment(claimed) })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const refundAppointmentPayment = async ({ appointment, appointmentId, requestedBy = 'system', req }) => {
  if (!appointment || appointment.paymentStatus !== 'Paid' || appointment.paymentMethod !== 'Visa' || !appointment.stripePaymentIntentId) {
    return { refunded: false, message: 'No Stripe payment to refund' }
  }

  if (['Refunded', 'Refund Pending'].includes(appointment.refundStatus)) {
    return { refunded: false, message: 'Payment already refunded' }
  }

  ensureStripe()

  // The key covers double clicks and retries. A new attempt number lets a genuine failure try again.
  const attempt = Number(appointment.refundAttempts || 0)
  let refund
  try {
    refund = await stripe.refunds.create({
      payment_intent: appointment.stripePaymentIntentId,
      metadata: {
        appointmentId: appointmentId.toString(),
        requestedBy
      }
    }, { idempotencyKey: `refund_appointment_${appointmentId}_${attempt}` })
  } catch (error) {
    if (error?.code !== 'charge_already_refunded') {
      await appointmentModel.findByIdAndUpdate(appointmentId, {
        refundStatus: 'Refund Failed',
        refundAttempts: attempt + 1,
        refundNote: `Refund failed: ${error.message}`
      })
      throw error
    }
    refund = { id: appointment.stripeRefundId || '', status: 'succeeded', amount: toMinorUnits(appointment.amount) }
  }

  const refundFailed = refund.status === 'failed' || refund.status === 'canceled'
  const refundSucceeded = refund.status === 'succeeded'
  await appointmentModel.findByIdAndUpdate(appointmentId, {
    // Still marked paid when the refund failed, because the clinic is still holding the money.
    paymentStatus: refundFailed ? 'Paid' : 'Not Paid',
    refundStatus: refundFailed ? 'Refund Failed' : refundSucceeded ? 'Refunded' : 'Refund Pending',
    stripeRefundId: refund.id,
    refundedAt: refundSucceeded ? Date.now() : 0,
    refundAmount: Number.isFinite(refund.amount) ? refund.amount / 100 : Number(appointment.amount || 0),
    refundAttempts: refundFailed ? attempt + 1 : attempt,
    refundNote: `Refund requested by ${requestedBy}`
  })

  await logAudit({
    action: 'stripe_refund',
    status: refundFailed ? 'failed' : 'success',
    targetUserId: appointment.userId,
    entityType: 'appointment',
    entityId: appointmentId,
    metadata: {
      requestedBy,
      refundId: refund.id,
      refundStatus: refund.status,
      paymentIntentId: appointment.stripePaymentIntentId,
      amount: appointment.amount
    },
    req
  })

  return { refunded: !refundFailed, refund }
}

const MAX_AUTOMATIC_REFUND_ATTEMPTS = 3

/** Brings refund states up to date when the patient looks, since a pending bank refund settles later and there is no webhook. */
const refreshRefundsForUser = async (userId) => {
  if (!stripe) return
  const rows = await appointmentModel
    .find({ userId, refundStatus: { $in: ['Refund Pending', 'Refund Failed'] } })
    .limit(5)

  for (const appointment of rows) {
    try {
      if (appointment.refundStatus === 'Refund Failed') {
        if (appointment.cancelled && Number(appointment.refundAttempts || 0) < MAX_AUTOMATIC_REFUND_ATTEMPTS) {
          await refundAppointmentPayment({ appointment, appointmentId: appointment._id, requestedBy: 'automatic retry' })
        }
        continue
      }
      if (!appointment.stripeRefundId) continue
      const refund = await stripe.refunds.retrieve(appointment.stripeRefundId)
      if (refund.status === 'succeeded') {
        await appointmentModel.updateOne(
          { _id: appointment._id, refundStatus: 'Refund Pending' },
          { refundStatus: 'Refunded', refundedAt: Date.now() }
        )
      } else if (refund.status === 'failed' || refund.status === 'canceled') {
        await appointmentModel.updateOne(
          { _id: appointment._id, refundStatus: 'Refund Pending' },
          { refundStatus: 'Refund Failed', paymentStatus: 'Paid', $inc: { refundAttempts: 1 } }
        )
        void pushNotification({
          recipientRole: 'admin',
          recipientId: getAdminRecipientId(),
          title: 'Refund failed',
          message: `Refund failed for reservation ${appointment.reservationNumber || appointment._id}. Please follow up in Stripe.`,
          type: 'refund_failed',
          meta: { appointmentId: String(appointment._id) }
        })
      }
    } catch (error) {
      console.error('Refund refresh failed', String(appointment._id), error.message)
    }
  }
}

export {
  confirmBookingPaymentIntent,
  confirmPaymentIntent,
  createBookingPaymentIntent,
  createPaymentIntent,
  refreshRefundsForUser,
  refundAppointmentPayment,
  releaseBookingHold
}
