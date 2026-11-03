import validator from 'validator'
import userModel from '../models/userModel.js'
import { v2 as cloudinary } from 'cloudinary'
import doctorModel from '../models/doctorModel.js'
import appointmentModel from '../models/appointmentModel.js'
import prescriptionModel from '../models/prescriptionModel.js'
import counterModel from '../models/counterModel.js'
import ratingModel from '../models/ratingModel.js'
import { logAudit } from '../services/auditService.js'
import { refreshRefundsForUser, refundAppointmentPayment } from './paymentController.js'
import { getVisitFeeQuote } from '../services/globalVisitFeesService.js'
import { patientCanBookConsultation } from '../services/visitFeeEligibilityService.js'
import { createAppointmentFromBooking, findOwnActiveAppointment, findPatientClash, isValidId, releaseHold, toPatientAppointment, unlockSlot, validateBookingRequest } from '../services/bookingService.js'
import { acquireSlotForUser, consumeHold, reconcileUserHolds } from '../services/slotHoldService.js'
import { closeWaitlistAfterBooking, processWaitlistForDoctor } from '../services/waitlistService.js'
import { notifyAppointmentBooked, notifyAppointmentCancelled } from '../services/notificationService.js'
import { assertValidInsuranceProvider } from '../services/insuranceProvidersService.js'
import { attachInsuranceVerification } from '../services/insuranceVerificationService.js'

// Function to get next ID
const getNextPatientId = async () => {
    const counter = await counterModel.findByIdAndUpdate('patientId',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    
    return `PAT${counter.seq.toString().padStart(2, '0')}`;
};

const parseBoolean = (value) => value === true || value === 'true' || value === 'on' || value === '1'

const isPastDate = (value) => {
  if (!value || typeof value !== 'string') return false
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return false

  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  return date < todayUtc
}

const buildInsuranceData = async (body = {}, file, existingInsurance = {}, updatedBy = 'patient', options = {}) => {
  const enabled = parseBoolean(body.insuranceEnabled)

  if (!enabled) {
    return {
      enabled: false,
      provider: '',
      fullName: '',
      birthDate: '',
      idNumber: '',
      expiryDate: '',
      medicalCardPhoto: existingInsurance.medicalCardPhoto || '',
      updatedAt: Date.now(),
      updatedBy
    }
  }

  let provider = ''
  if (enabled) {
    let raw = String(body.insuranceProvider || body.insuranceProviderName || '').trim()
    if (!raw && existingInsurance?.provider) raw = String(existingInsurance.provider).trim()
    provider = await assertValidInsuranceProvider(raw)
  }

  const insurance = {
    enabled: true,
    provider,
    fullName: String(body.insuranceFullName || body.fullName || '').trim(),
    birthDate: String(body.insuranceBirthDate || body.birthDate || '').trim(),
    idNumber: String(body.insuranceIdNumber || body.idNumber || '').trim(),
    expiryDate: String(body.insuranceExpiryDate || body.expiryDate || '').trim(),
    medicalCardPhoto: existingInsurance.medicalCardPhoto || '',
    updatedAt: Date.now(),
    updatedBy
  }

  if (!insurance.fullName || !insurance.birthDate || !insurance.idNumber || !insurance.expiryDate) {
    throw new Error('Please complete all insurance fields')
  }

  if (!isPastDate(insurance.birthDate)) {
    throw new Error('Insurance birth date must be in the past')
  }

  if (!file && !insurance.medicalCardPhoto) {
    throw new Error('Please attach a photo of the medical card')
  }

  if (file) {
    const upload = await cloudinary.uploader.upload(file.path, { resource_type: 'auto' })
    insurance.medicalCardPhoto = upload.secure_url
  }

  return attachInsuranceVerification(insurance, {
    updatedBy,
    existingInsurance,
    verifiedBy: options.verifiedBy || (updatedBy === 'receptionist' ? String(body.verifiedBy || body.receptionistId || '').trim() : '')
  })
}



const getVisitFeeEligibility = async (req, res) => {
  try {
    const userId = req.user.userId
    const { docId } = req.params

    const docData = await doctorModel.findById(docId).select('fees name')
    if (!docData) {
      return res.json({ success: false, message: 'Doctor not found' })
    }

    const quote = await getVisitFeeQuote(docData, 'examination')
    const eligibility = await patientCanBookConsultation(userId, docId)

    res.json({
      success: true,
      canBookConsultation: eligibility.allowed,
      lastExaminationAt: eligibility.lastExaminationAt,
      consultationUntil: eligibility.consultationUntil,
      examinationFee: quote.examinationAmount,
      consultationFee: quote.consultationAmount,
      globalFeesEnabled: Boolean(quote.globalVisitFees?.enabled)
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

//  API to book appointment
const bookAppointment = async (req,res) => {

  let lockedSlot = null

  try {

    const userId = req.user.userId;
    const paymentMethod = String(req.body.paymentMethod || 'Cash').trim()

    if (paymentMethod === 'Visa') {
      // Reserving a slot as "Visa" without paying would hold it forever. Online payment has its own flow.
      return res.json({ success: false, message: 'Please complete online payment to book with Visa' })
    }
    if (!['Cash', 'Insurance'].includes(paymentMethod)) {
      return res.json({ success: false, message: 'Please choose Cash or Visa payment method' })
    }

    const booking = await validateBookingRequest({ userId, body: req.body, paymentMethod })
    if (booking.error) {
      return res.json({ success: false, message: booking.error })
    }
    const { docId, doctor, user, slotDate, slotTime, appointmentType } = booking

    const alreadyBooked = await findOwnActiveAppointment({ userId, docId, slotDate, slotTime })
    if (alreadyBooked) {
      // A double click or a retry after a lost response lands here. The patient has what they asked for.
      return res.json({
        success: true,
        alreadyBooked: true,
        message: 'Appointment Booked',
        appointmentId: alreadyBooked._id,
        appointment: toPatientAppointment(alreadyBooked)
      })
    }
    if (await findPatientClash({ userId, slotDate, slotTime })) {
      return res.json({ success: false, message: 'You already have another appointment at this time' })
    }

    const acquired = await acquireSlotForUser({ userId, docId, slotDate, slotTime, appointmentType })
    if (!acquired.ok) {
      return res.json({ success: false, message: 'Slot not available' })
    }
    lockedSlot = { docId, slotDate, slotTime, appointmentType, hold: acquired.hold }

    const created = await createAppointmentFromBooking(booking, {
      fields: { paymentStatus: 'Not Paid', paymentMethod }
    })
    if (created.slotConflict) {
      // The doctor document and the appointments disagreed. The unique index caught it, and the slot belongs to the other booking.
      lockedSlot = null
      return res.json({ success: false, message: 'Slot not available' })
    }
    lockedSlot = null

    const newAppointment = created.appointment
    await consumeHold(acquired.hold)
    await closeWaitlistAfterBooking({ userId, docId, slotDate })

    await logAudit({
      action: 'appointment_create',
      status: 'success',
      targetUserId: userId,
      entityType: 'appointment',
      entityId: newAppointment._id,
      metadata: {
        bookedBy: 'patient',
        patientId: userId,
        patientName: user.name,
        patientLoginId: user.patientId,
        doctorId: docId,
        doctorName: doctor.name,
        slotDate,
        slotTime,
        appointmentType
      },
      req
    })

    notifyAppointmentBooked({ appointment: newAppointment, bookedBy: 'Patient' })

    res.json({
      success: true,
      message: 'Appointment Booked',
      appointmentId: newAppointment._id,
      appointment: toPatientAppointment(newAppointment)
    })
  } catch (error) {
    console.log(error)
    if (lockedSlot) {
      if (lockedSlot.hold) await releaseHold(lockedSlot.hold).catch(() => {})
      else await unlockSlot(lockedSlot).catch(() => {})
    }
    res.json({success: false, message: error.message})
  }

}





// API to get user appointments for forntend my-appointments page
const listAppointment = async (req,res) => {
  try {

   const userId = req.user.userId;
   // A paid checkout whose confirm call was lost, or a refund that has settled, shows up here.
   await reconcileUserHolds(userId).catch((error) => console.error('reconcile', error.message))
   await refreshRefundsForUser(userId).catch((error) => console.error('refunds', error.message))

   const appointments = await appointmentModel.find({userId}).lean()
   const ratings = await ratingModel.find({
     userId,
     appointmentId: { $in: appointments.map((item) => item._id.toString()) }
   }).lean()
   const ratingsByAppointment = ratings.reduce((acc, rating) => {
     acc[rating.appointmentId] = rating
     return acc
   }, {})
   const now = Date.now()
   const appointmentsWithRatings = appointments.map((appointment) =>
     toPatientAppointment(appointment, { now, rating: ratingsByAppointment[appointment._id.toString()] || null })
   )

   res.json({ success: true, appointments: appointmentsWithRatings })

  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }
}





//API to cancel appointment
const cancelAppointment = async (req,res) => {
  try {

   const userId = req.user.userId;
   const { appointmentId } = req.body;

   if (!isValidId(appointmentId)) {
     return res.json({ success: false, message: 'Appointment not found' })
   }

   const appointmentData = await appointmentModel.findById(appointmentId)

   if (!appointmentData) {
     return res.json({ success: false, message: 'Appointment not found' })
   }

   // verify appointment user
   if(appointmentData.userId !== userId){
     await logAudit({
      action: 'cancel_appointment',
      status: 'failed',
      reason: 'Patient attempted to cancel another patient appointment',
      targetUserId: appointmentData.userId,
      entityType: 'appointment',
      entityId: appointmentId,
      metadata: { appointmentOwnerId: appointmentData.userId },
      req
     })
     return res.json({success: false, message: 'Unauthorized action'})
   }

   if (appointmentData.cancelled) {
     // Cancelling again must not release the slot a second time: someone else may have booked it since.
     return res.json({ success: true, alreadyCancelled: true, message: 'Appointment Cancelled' })
   }

   if (!toPatientAppointment(appointmentData).canCancel) {
     return res.json({ success: false, message: 'This appointment can no longer be cancelled' })
   }

   // Status first, money second: if the refund fails the visit is still cancelled and the refund retries.
   const claimed = await appointmentModel.findOneAndUpdate(
     { _id: appointmentId, userId, cancelled: false, isCompleted: false, appointmentStatus: 'Booked' },
     { cancelled: true, appointmentStatus: 'Cancelled', statusUpdatedAt: Date.now() },
     { new: true }
   )
   if (!claimed) {
     const latest = await appointmentModel.findById(appointmentId).select('cancelled').lean()
     if (latest?.cancelled) return res.json({ success: true, alreadyCancelled: true, message: 'Appointment Cancelled' })
     return res.json({ success: false, message: 'This appointment can no longer be cancelled' })
   }

   // releasing doctor slot
   const { docId, slotDate, slotTime, appointmentType } = claimed
   await unlockSlot({ docId, slotDate, slotTime, appointmentType })

   let refundMessage = ''
   if (claimed.paymentStatus === 'Paid' && claimed.paymentMethod === 'Visa') {
     try {
       const refundResult = await refundAppointmentPayment({ appointment: claimed, appointmentId, requestedBy: 'patient', req })
       refundMessage = refundResult.refunded ? ' Refund requested.' : ''
     } catch (error) {
       console.error('Refund failed after cancel', appointmentId, error.message)
       refundMessage = ' Your refund could not be completed yet. We will retry it.'
     }
   }

   await logAudit({
     action: 'appointment_cancel',
     status: 'success',
     targetUserId: userId,
     entityType: 'appointment',
     entityId: appointmentId,
     metadata: {
       cancelledBy: 'patient',
       patientId: userId,
       doctorId: docId,
       slotDate,
       slotTime
     },
     req
   })

   notifyAppointmentCancelled({ appointment: claimed, cancelledBy: 'patient' })

   await processWaitlistForDoctor(docId).catch((error) => console.error('waitlist', error.message))

   res.json({success: true, message:`Appointment Cancelled${refundMessage}`})


  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }
}




// API to get user's prescription/completed appointment details
const getUserPrescription = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const userId = req.user.userId; 

    if (!isValidId(appointmentId)) {
      return res.json({ success: false, message: 'Appointment ID required' });
    }

    // Find prescription by appointmentId field (not _id)
    const prescription = await prescriptionModel.findOne({ 
      appointmentId: appointmentId,  
      userId: userId 
    })

    if (!prescription) {
      return res.json({ success: false, message: 'Prescription not found' });
    }

    res.json({ success: true, prescription });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};




export { getVisitFeeEligibility, bookAppointment, listAppointment, cancelAppointment, getUserPrescription, buildInsuranceData, getNextPatientId, isPastDate }
