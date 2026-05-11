import appointmentModel from '../models/appointmentModel.js'
import doctorModel from '../models/doctorModel.js'
import userModel from '../models/userModel.js'
import stripe, { stripeCurrency } from '../config/stripe.js'
import { logAudit } from '../services/auditService.js'
import { isSlotAllowedBySchedule } from '../services/scheduleService.js'
import { buildTeleconsultationLink, normalizeAppointmentType } from '../services/appointmentModeService.js'
import { normalizeHomeVisitAddress, validateHomeVisitAddress } from '../services/homeVisitService.js'

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

const createBookingPaymentIntent = async (req, res) => {
  try {
    ensureStripe()

    const userId = req.user.userId
    const { docId, slotDate, slotTime } = req.body
    const clinicLocation = String(req.body.clinicLocation || '').trim()
    const appointmentType = normalizeAppointmentType(req.body.appointmentType)
    const homeVisitAddress = normalizeHomeVisitAddress(req.body.homeVisitAddress || {})

    if (!docId || !slotDate || !slotTime) {
      return res.json({ success: false, message: 'Missing appointment details' })
    }
    if (appointmentType === 'Home Visit') {
      const addressError = validateHomeVisitAddress(homeVisitAddress)
      if (addressError) return res.json({ success: false, message: addressError })
    }

    const docData = await doctorModel.findById(docId).select('-password')
    const userData = await userModel.findById(userId).select('-password')

    if (!docData) {
      return res.json({ success: false, message: 'Doctor not found' })
    }

    if (!userData || userData.isActive === false) {
      return res.json({ success: false, message: 'Patient account is deactivated' })
    }

    const scheduleCheck = isSlotAllowedBySchedule(docData, slotDate, slotTime)
    if (!scheduleCheck.allowed) {
      return res.json({ success: false, message: scheduleCheck.reason })
    }

    const isAlreadyBooked = docData.slots_booked?.[slotDate]?.includes(slotTime)
    if (isAlreadyBooked) {
      return res.json({ success: false, message: 'Slot not available' })
    }

    const amount = Number(docData.fees || 0)
    const amountInMinorUnits = toMinorUnits(amount)
    if (!Number.isFinite(amountInMinorUnits) || amountInMinorUnits <= 0) {
      return res.json({ success: false, message: 'Invalid appointment amount' })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInMinorUnits,
      currency: stripeCurrency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        flow: 'appointment_booking',
        userId,
        docId,
        slotDate,
        slotTime,
        clinicLocation,
        appointmentType,
        homeVisitArea: homeVisitAddress.area,
        homeVisitStreet: homeVisitAddress.street,
        homeVisitBuilding: homeVisitAddress.building,
        homeVisitFloor: homeVisitAddress.floor,
        homeVisitApartment: homeVisitAddress.apartment,
        homeVisitNotes: homeVisitAddress.notes,
        patientName: userData.name || '',
        doctorName: docData.name || ''
      }
    })

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency: stripeCurrency
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const confirmBookingPaymentIntent = async (req, res) => {
  try {
    ensureStripe()

    const userId = req.user.userId
    const { paymentIntentId } = req.body

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] })
    if (!intent || intent.status !== 'succeeded') {
      return res.json({ success: false, message: 'Payment was not completed' })
    }

    const { docId, slotDate, slotTime, clinicLocation = '' } = intent.metadata || {}
    const appointmentType = normalizeAppointmentType(intent.metadata?.appointmentType)
    const homeVisitAddress = normalizeHomeVisitAddress({
      area: intent.metadata?.homeVisitArea,
      street: intent.metadata?.homeVisitStreet,
      building: intent.metadata?.homeVisitBuilding,
      floor: intent.metadata?.homeVisitFloor,
      apartment: intent.metadata?.homeVisitApartment,
      notes: intent.metadata?.homeVisitNotes
    })
    if (intent.metadata?.flow !== 'appointment_booking' || intent.metadata?.userId !== userId || !docId || !slotDate || !slotTime) {
      return res.json({ success: false, message: 'Payment does not match this booking' })
    }

    const docData = await doctorModel.findById(docId).select('-password')
    const userData = await userModel.findById(userId).select('-password')

    if (!docData || !userData || userData.isActive === false) {
      await stripe.refunds.create({
        payment_intent: intent.id,
        metadata: { reason: 'doctor_or_patient_unavailable', userId, docId }
      })
      return res.json({ success: false, message: 'Appointment is no longer available. Payment refund was requested.' })
    }

    const scheduleCheck = isSlotAllowedBySchedule(docData, slotDate, slotTime)
    if (!scheduleCheck.allowed) {
      await stripe.refunds.create({
        payment_intent: intent.id,
        metadata: { reason: 'slot_schedule_changed', userId, docId, slotDate, slotTime }
      })
      return res.json({ success: false, message: 'Slot is no longer available. Payment refund was requested.' })
    }

    const slotUpdate = await doctorModel.updateOne(
      { _id: docId, [`slots_booked.${slotDate}`]: { $ne: slotTime } },
      { $addToSet: { [`slots_booked.${slotDate}`]: slotTime } }
    )

    if (slotUpdate.modifiedCount === 0) {
      await stripe.refunds.create({
        payment_intent: intent.id,
        metadata: { reason: 'slot_taken_after_payment', userId, docId, slotDate, slotTime }
      })
      return res.json({ success: false, message: 'Slot was just booked by someone else. Payment refund was requested.' })
    }

    const appointmentDocData = docData.toObject()
    delete appointmentDocData.slots_booked

    const appointmentId = new appointmentModel()._id
    const teleconsultationLink = ['Voice Call', 'Video Call'].includes(appointmentType) ? buildTeleconsultationLink({ appointmentId, docId, userId, slotDate, slotTime }) : ''

    const appointmentData = {
      _id: appointmentId,
      userId,
      docId,
      userData,
      docData: appointmentDocData,
      amount: Number(docData.fees),
      originalAmount: Number(docData.fees),
      slotTime,
      slotDate,
      clinicLocation: appointmentType === 'Clinic' ? clinicLocation : '',
      appointmentType,
      teleconsultationLink,
      homeVisitAddress: appointmentType === 'Home Visit' ? { ...homeVisitAddress, updatedBy: 'Patient', updatedAt: Date.now() } : {},
      date: Date.now(),
      appointmentStatus: 'Booked',
      paymentStatus: 'Paid',
      paymentMethod: 'Visa',
      paidAt: Date.now(),
      stripePaymentIntentId: intent.id,
      stripeChargeId: getStripeChargeId(intent),
      refundStatus: 'Not Refunded',
      bookedBy: 'Patient'
    }

    const newAppointment = await new appointmentModel(appointmentData).save()

    await logAudit({
      action: 'appointment_create',
      status: 'success',
      targetUserId: userId,
      entityType: 'appointment',
      entityId: newAppointment._id,
      metadata: {
        bookedBy: 'patient',
        paymentMethod: 'Visa',
        paymentIntentId: intent.id,
        patientId: userId,
        patientName: userData.name,
        patientLoginId: userData.patientId,
        doctorId: docId,
        doctorName: docData.name,
        slotDate,
        slotTime,
        appointmentType
      },
      req
    })

    res.json({ success: true, message: 'Payment confirmed and appointment booked', appointment: newAppointment })
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

    const amount = toMinorUnits(appointment.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.json({ success: false, message: 'Invalid appointment amount' })
    }

    if (appointment.stripePaymentIntentId) {
      const existingIntent = await stripe.paymentIntents.retrieve(appointment.stripePaymentIntentId)
      if (existingIntent && !['canceled', 'succeeded'].includes(existingIntent.status)) {
        return res.json({
          success: true,
          clientSecret: existingIntent.client_secret,
          paymentIntentId: existingIntent.id,
          amount: appointment.amount,
          currency: stripeCurrency
        })
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
        patientName: appointment.userData?.name || ''
      }
    })

    await appointmentModel.findByIdAndUpdate(appointmentId, {
      paymentMethod: 'Visa',
      stripePaymentIntentId: paymentIntent.id,
      refundStatus: 'Not Refunded'
    })

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

    const updatedAppointment = await appointmentModel.findByIdAndUpdate(
      appointmentId,
      {
        paymentStatus: 'Paid',
        paymentMethod: 'Visa',
        paidAt: Date.now(),
        stripePaymentIntentId: intent.id,
        stripeChargeId: getStripeChargeId(intent),
        refundStatus: 'Not Refunded'
      },
      { new: true }
    )

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

    res.json({ success: true, message: 'Payment confirmed', appointment: updatedAppointment })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const refundAppointmentPayment = async ({ appointment, appointmentId, requestedBy = 'system', req }) => {
  if (!appointment || appointment.paymentStatus !== 'Paid' || appointment.paymentMethod !== 'Visa' || !appointment.stripePaymentIntentId) {
    return { refunded: false, message: 'No Stripe payment to refund' }
  }

  if (appointment.refundStatus === 'Refunded') {
    return { refunded: false, message: 'Payment already refunded' }
  }

  ensureStripe()

  const refund = await stripe.refunds.create({
    payment_intent: appointment.stripePaymentIntentId,
    metadata: {
      appointmentId: appointmentId.toString(),
      requestedBy
    }
  })

  await appointmentModel.findByIdAndUpdate(appointmentId, {
    paymentStatus: 'Not Paid',
    refundStatus: refund.status === 'succeeded' ? 'Refunded' : 'Refund Pending',
    stripeRefundId: refund.id,
    refundedAt: refund.status === 'succeeded' ? Date.now() : 0,
    refundAmount: Number(appointment.amount || 0),
    refundNote: `Refund requested by ${requestedBy}`
  })

  await logAudit({
    action: 'stripe_refund',
    status: 'success',
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

  return { refunded: true, refund }
}

export { createBookingPaymentIntent, confirmBookingPaymentIntent, createPaymentIntent, confirmPaymentIntent, refundAppointmentPayment }
