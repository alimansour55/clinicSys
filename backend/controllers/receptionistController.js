import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import validator from 'validator'
import appointmentModel from '../models/appointmentModel.js'
import doctorModel from '../models/doctorModel.js'
import receptionistModel from '../models/receptionistModel.js'
import userModel from '../models/userModel.js'
import { createJwtPayload } from '../middlewares/rbac.js'
import { logAudit } from '../services/auditService.js'
import { isSlotAllowedBySchedule } from '../services/scheduleService.js'
import { buildInsuranceData, getNextPatientId } from './userController.js'

const validAppointmentStatuses = ['Booked', 'Checked In', 'In Progress', 'Finished', 'Cancelled']
const validPaymentStatuses = ['Paid', 'Not Paid']
const validPaymentMethods = ['Cash', 'Visa', 'Insurance', 'Free']

const addReceptionist = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body

    if (!name || !email || !password || !phone) {
      return res.json({ success: false, message: 'Missing Details' })
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: 'Please enter a valid email' })
    }

    if (password.length < 8) {
      return res.json({ success: false, message: 'Please enter a strong password' })
    }

    const existingReceptionist = await receptionistModel.findOne({ email })
    if (existingReceptionist) {
      return res.json({ success: false, message: 'Receptionist with this email already exists' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const newReceptionist = await new receptionistModel({
      name,
      email,
      phone,
      password: hashedPassword,
      date: Date.now()
    }).save()

    await logAudit({
      action: 'receptionist_create',
      status: 'success',
      targetUserId: newReceptionist._id,
      entityType: 'receptionist',
      entityId: newReceptionist._id,
      metadata: {
        receptionistName: name,
        receptionistEmail: email,
        createdByRole: req.user?.role || 'admin'
      },
      req
    })

    res.json({ success: true, message: 'Receptionist Added' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const allReceptionists = async (req, res) => {
  try {
    const receptionists = await receptionistModel.find({}).select('-password')
    res.json({ success: true, receptionists })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const changeReceptionistStatus = async (req, res) => {
  try {
    const { receptionistId } = req.body
    const receptionist = await receptionistModel.findById(receptionistId)

    if (!receptionist) {
      return res.json({ success: false, message: 'Receptionist not found' })
    }

    await receptionistModel.findByIdAndUpdate(receptionistId, { isActive: !receptionist.isActive })
    await logAudit({
      action: 'receptionist_status_update',
      status: 'success',
      targetUserId: receptionistId,
      entityType: 'receptionist',
      entityId: receptionistId,
      metadata: {
        receptionistName: receptionist.name,
        oldValue: { isActive: receptionist.isActive },
        newValue: { isActive: !receptionist.isActive }
      },
      req
    })
    res.json({ success: true, message: 'Receptionist status updated' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const loginReceptionist = async (req, res) => {
  try {
    const { email, password } = req.body
    const receptionist = await receptionistModel.findOne({ email })

    if (!receptionist) {
      await logAudit({
        action: 'login_failed',
        status: 'failed',
        reason: 'Invalid receptionist credentials',
        entityType: 'receptionist',
        metadata: { email },
        req
      })
      return res.json({ success: false, message: 'Invalid credentials' })
    }

    if (!receptionist.isActive) {
      await logAudit({
        action: 'login_failed',
        actorUserId: receptionist._id,
        actorRole: 'receptionist',
        status: 'failed',
        reason: 'Receptionist account is disabled',
        entityType: 'receptionist',
        entityId: receptionist._id,
        metadata: { email },
        req
      })
      return res.json({ success: false, message: 'Receptionist account is disabled' })
    }

    const isMatch = await bcrypt.compare(password, receptionist.password)

    if (isMatch) {
      const token = jwt.sign(createJwtPayload({ id: receptionist._id, role: 'receptionist', email: receptionist.email }), process.env.JWT_SECRET)
      await logAudit({
        action: 'login_success',
        actorUserId: receptionist._id,
        actorRole: 'receptionist',
        status: 'success',
        entityType: 'receptionist',
        entityId: receptionist._id,
        metadata: {
          username: receptionist.name,
          loginId: receptionist.email,
          email: receptionist.email
        },
        req
      })
      res.json({ success: true, token })
    } else {
      await logAudit({
        action: 'login_failed',
        actorUserId: receptionist._id,
        actorRole: 'receptionist',
        status: 'failed',
        reason: 'Invalid receptionist credentials',
        entityType: 'receptionist',
        entityId: receptionist._id,
        metadata: { email },
        req
      })
      res.json({ success: false, message: 'Invalid credentials' })
    }
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const receptionistDashboard = async (req, res) => {
  try {
    const today = new Date()
    const todaySlotDate = `${today.getDate()}_${today.getMonth() + 1}_${today.getFullYear()}`
    const appointments = await appointmentModel.find({})
    const todayAppointments = appointments.filter(item => item.slotDate === todaySlotDate)

    const dashData = {
      todayAppointments: todayAppointments.length,
      checkedIn: todayAppointments.filter(item => item.appointmentStatus === 'Checked In').length,
      inProgress: todayAppointments.filter(item => item.appointmentStatus === 'In Progress').length,
      unpaid: appointments.filter(item => item.paymentStatus !== 'Paid' && item.appointmentStatus !== 'Cancelled' && !item.cancelled).length,
      paidToday: todayAppointments.filter(item => item.paymentStatus === 'Paid').reduce((sum, item) => sum + Number(item.amount || 0), 0),
      latestAppointments: appointments.reverse().slice(0, 8)
    }

    res.json({ success: true, dashData })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const receptionistAppointments = async (req, res) => {
  try {
    const appointments = await appointmentModel.find({})
    res.json({ success: true, appointments })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const receptionistDoctors = async (req, res) => {
  try {
    const doctors = await doctorModel.find({}).select('-password')
    res.json({ success: true, doctors })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const receptionistPatients = async (req, res) => {
  try {
    const patients = await userModel.find({}).select('-password')
    res.json({ success: true, patients })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const createPatientForReceptionist = async (req, res) => {
  try {
    const body = req.body || {}
    const { name, email, password, dob, gender } = body
    const phone = String(body.phone || '').trim()

    if (!name || !email || !password || !phone || !dob) {
      return res.json({ success: false, message: 'Name, email, phone, birth date, and password are required' })
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: 'Please enter a valid email' })
    }

    if (password.length < 8) {
      return res.json({ success: false, message: 'Password must be at least 8 characters' })
    }

    const existingPatient = await userModel.findOne({ $or: [{ email }, { phone }] })
    if (existingPatient) {
      return res.json({ success: false, message: 'A patient with this email or phone already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const patientId = await getNextPatientId()
    const insurance = await buildInsuranceData(body, req.file, {}, 'receptionist')

    const patient = await new userModel({
      name,
      email,
      phone,
      dob,
      gender: gender || 'Not Selected',
      password: hashedPassword,
      patientId,
      insurance
    }).save()

    await logAudit({
      action: 'patient_create',
      actorUserId: req.receptionist?.receptionistId,
      actorRole: 'receptionist',
      status: 'success',
      targetUserId: patient._id,
      entityType: 'user',
      entityId: patient._id,
      metadata: { patientName: name, patientLoginId: patientId, insuranceEnabled: insurance.enabled },
      req
    })

    res.json({ success: true, message: 'Patient added', patient })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const updatePatientInsurance = async (req, res) => {
  try {
    const body = req.body || {}
    const { patientId } = body
    if (!patientId) {
      return res.json({ success: false, message: 'Patient is required' })
    }

    const patient = await userModel.findById(patientId).select('insurance')
    if (!patient) {
      return res.json({ success: false, message: 'Patient not found' })
    }

    const insurance = await buildInsuranceData(body, req.file, patient.insurance || {}, 'receptionist')
    await userModel.findByIdAndUpdate(patientId, { insurance })

    await logAudit({
      action: 'insurance_update',
      actorUserId: req.receptionist?.receptionistId,
      actorRole: 'receptionist',
      status: 'success',
      targetUserId: patientId,
      entityType: 'user',
      entityId: patientId,
      metadata: { enabled: insurance.enabled },
      req
    })

    res.json({ success: true, message: 'Insurance updated', insurance })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const bookAppointmentForPatient = async (req, res) => {
  try {
    const { patientId, docId, slotDate, slotTime } = req.body
    const receptionistId = req.receptionist.receptionistId

    if (!patientId || !docId || !slotDate || !slotTime) {
      return res.json({ success: false, message: 'Missing appointment details' })
    }

    const docData = await doctorModel.findById(docId).select('-password')
    const userData = await userModel.findById(patientId).select('-password')

    if (!docData) {
      return res.json({ success: false, message: 'Doctor not found' })
    }

    if (!userData) {
      return res.json({ success: false, message: 'Patient not found' })
    }

    if (userData.isActive === false) {
      return res.json({ success: false, message: 'Patient account is deactivated' })
    }

    const scheduleCheck = isSlotAllowedBySchedule(docData, slotDate, slotTime)
    if (!scheduleCheck.allowed) {
      return res.json({ success: false, message: scheduleCheck.reason })
    }

    const slotUpdate = await doctorModel.updateOne(
      { _id: docId, [`slots_booked.${slotDate}`]: { $ne: slotTime } },
      { $addToSet: { [`slots_booked.${slotDate}`]: slotTime } }
    )

    if (slotUpdate.modifiedCount === 0) {
      return res.json({ success: false, message: 'Slot not available' })
    }

    const appointmentDocData = docData.toObject()
    delete appointmentDocData.slots_booked

    const appointmentData = {
      userId: patientId,
      docId,
      userData,
      docData: appointmentDocData,
      amount: Number(docData.fees),
      originalAmount: Number(docData.fees),
      slotTime,
      slotDate,
      date: Date.now(),
      appointmentStatus: 'Booked',
      paymentStatus: 'Not Paid',
      bookedBy: 'Receptionist',
      receptionistId
    }

    const newAppointment = await new appointmentModel(appointmentData).save()

    await logAudit({
      action: 'appointment_create',
      status: 'success',
      targetUserId: patientId,
      entityType: 'appointment',
      entityId: newAppointment._id,
      metadata: {
        bookedBy: 'receptionist',
        receptionistId,
        patientId,
        patientName: userData.name,
        patientLoginId: userData.patientId,
        doctorId: docId,
        doctorName: docData.name,
        slotDate,
        slotTime
      },
      req
    })

    res.json({ success: true, message: 'Appointment Booked' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId, appointmentStatus } = req.body

    if (!appointmentId || !validAppointmentStatuses.includes(appointmentStatus)) {
      return res.json({ success: false, message: 'Invalid appointment status' })
    }

    const appointment = await appointmentModel.findById(appointmentId)
    if (!appointment) {
      return res.json({ success: false, message: 'Appointment not found' })
    }

    const updateData = {
      appointmentStatus,
      statusUpdatedAt: Date.now(),
      cancelled: appointmentStatus === 'Cancelled',
      isCompleted: appointmentStatus === 'Finished'
    }

    if (appointmentStatus === 'Checked In') {
      updateData.checkedInAt = Date.now()
    }

    await appointmentModel.findByIdAndUpdate(appointmentId, updateData)

    await logAudit({
      action: 'appointment_status_update',
      status: 'success',
      targetUserId: appointment.userId,
      entityType: 'appointment',
      entityId: appointmentId,
      metadata: {
        receptionistId: req.receptionist?.receptionistId,
        patientId: appointment.userId,
        doctorId: appointment.docId,
        oldValue: { appointmentStatus: appointment.appointmentStatus },
        newValue: { appointmentStatus }
      },
      req
    })

    if (appointmentStatus === 'Cancelled') {
      const doctorData = await doctorModel.findById(appointment.docId)
      const slots_booked = doctorData?.slots_booked || {}
      if (slots_booked[appointment.slotDate]) {
        slots_booked[appointment.slotDate] = slots_booked[appointment.slotDate].filter(slot => slot !== appointment.slotTime)
        await doctorModel.findByIdAndUpdate(appointment.docId, { slots_booked })
      }
    }

    res.json({ success: true, message: 'Appointment status updated' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const updatePayment = async (req, res) => {
  try {
    const body = req.body || {}
    const { appointmentId, paymentStatus, paymentMethod, discountReason, paymentNote } = body
    const discountAmount = Math.max(0, Number(body.discountAmount || 0))
    const coveredByInsurance = body.coveredByInsurance === true || body.coveredByInsurance === 'true'

    if (!appointmentId || !validPaymentStatuses.includes(paymentStatus)) {
      await logAudit({
        action: 'payment_update',
        status: 'failed',
        reason: 'Invalid payment status',
        entityType: 'appointment',
        entityId: appointmentId || '',
        metadata: { paymentStatus },
        req
      })
      return res.json({ success: false, message: 'Invalid payment status' })
    }

    const appointment = await appointmentModel.findById(appointmentId)
    if (!appointment) {
      await logAudit({
        action: 'payment_update',
        status: 'failed',
        reason: 'Appointment not found',
        entityType: 'appointment',
        entityId: appointmentId,
        metadata: { paymentStatus, paymentMethod },
        req
      })
      return res.json({ success: false, message: 'Appointment not found' })
    }

    const baseAmount = Number(appointment.originalAmount || appointment.amount || 0)
    const finalAmount = Math.max(0, baseAmount - discountAmount)
    const requestedPaymentMethod = paymentMethod === 'Free' && finalAmount > 0 ? 'Cash' : paymentMethod
    const nextPaymentMethod = finalAmount === 0 ? 'Free' : coveredByInsurance ? 'Insurance' : requestedPaymentMethod

    if (paymentStatus === 'Paid' && !validPaymentMethods.includes(nextPaymentMethod)) {
      await logAudit({
        action: 'payment_update',
        status: 'failed',
        reason: 'Invalid payment method',
        entityType: 'appointment',
        entityId: appointmentId,
        metadata: { paymentStatus, paymentMethod: nextPaymentMethod },
        req
      })
      return res.json({ success: false, message: 'Select Cash, Visa, Insurance, or Free payment method' })
    }

    const effectiveMethod = paymentStatus === 'Paid'
      ? nextPaymentMethod
      : ''

    await appointmentModel.findByIdAndUpdate(appointmentId, {
      amount: finalAmount,
      originalAmount: baseAmount,
      discountAmount,
      discountReason: String(discountReason || '').trim(),
      coveredByInsurance,
      paymentStatus,
      paymentMethod: effectiveMethod,
      paymentNote: String(paymentNote || '').trim(),
      paidAt: paymentStatus === 'Paid' ? Date.now() : 0
    })

    await logAudit({
      action: 'payment_update',
      status: 'success',
      targetUserId: appointment.userId,
      entityType: 'appointment',
      entityId: appointmentId,
      metadata: {
        oldValue: {
          paymentStatus: appointment.paymentStatus,
          paymentMethod: appointment.paymentMethod,
          amount: appointment.amount
        },
        newValue: {
          paymentStatus,
          paymentMethod: effectiveMethod,
          amount: finalAmount,
          discountAmount,
          coveredByInsurance
        }
      },
      req
    })

    res.json({ success: true, message: 'Payment updated' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const checkInPatient = async (req, res) => {
  req.body.appointmentStatus = 'Checked In'
  return updateAppointmentStatus(req, res)
}

export {
  addReceptionist,
  allReceptionists,
  changeReceptionistStatus,
  loginReceptionist,
  receptionistDashboard,
  receptionistAppointments,
  receptionistDoctors,
  receptionistPatients,
  createPatientForReceptionist,
  updatePatientInsurance,
  bookAppointmentForPatient,
  updateAppointmentStatus,
  updatePayment,
  checkInPatient
}
