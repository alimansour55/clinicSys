import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import validator from 'validator'
import { v2 as cloudinary } from 'cloudinary'
import appointmentModel from '../models/appointmentModel.js'
import clinicModel, { defaultClinicNames } from '../models/clinicModel.js'
import doctorModel from '../models/doctorModel.js'
import prescriptionModel from '../models/prescriptionModel.js'
import receptionistModel from '../models/receptionistModel.js'
import userModel from '../models/userModel.js'
import { createJwtPayload } from '../middlewares/rbac.js'
import { logAudit } from '../services/auditService.js'
import { getBookedSlotsField, isSlotAllowedBySchedule, resolveClinicLocationForSchedule, usesClinicWeeklySchedule } from '../services/scheduleService.js'
import { buildTeleconsultationLink, getDoctorAppointmentModeError, normalizeAppointmentTeleconsultationLinks, normalizeAppointmentType } from '../services/appointmentModeService.js'
import { normalizeHomeVisitAddress, validateHomeVisitAddress } from '../services/homeVisitService.js'
import { buildInsuranceData, getNextPatientId, isPastDate } from './userController.js'
import {
  applyVerificationDecision,
  buildInsuranceVisitCheck,
  getEffectiveVerificationStatus,
  isInsuranceExpired,
  sanitizeInsuranceForClient
} from '../services/insuranceVerificationService.js'
import { refundAppointmentPayment } from './paymentController.js'
import { attachRatingSummariesToDoctors } from './ratingController.js'
import { applyDoctorPromoCode, computeHomeVisitSurcharge, isHomeVisitAppointmentType } from '../services/appointmentPricingService.js'
import { getHomeVisitPricingSettings } from '../services/homeVisitPricingService.js'
import { getNextReservationNumber } from '../services/reservationService.js'
import { validatePasswordAgainstPolicy } from '../services/securityPolicyService.js'
import { buildMfaSetupPayload, generateMfaSecret, verifyTotpCode } from '../services/mfaService.js'
import { getSecuritySettings, isMfaRequiredForProfile } from '../services/securityPolicyService.js'
import { normalizeEmergencyContact, normalizeReceptionistAddress } from '../services/receptionistProfileFields.js'
import { emailExists, findOneByEmail, normalizeEmail } from '../utils/emailUtils.js'
import { markStaffCreatedAccountVerified } from '../services/accountVerificationService.js'
import {
  notifyAppointmentBooked,
  notifyAppointmentCancelled,
  notifyAppointmentStatusChanged,
  notifyPaymentRecorded,
  notifyReceptionistAccountStatus,
  isPaidPaymentStatus
} from '../services/notificationService.js'

const validAppointmentStatuses = ['Booked', 'Checked In', 'In Progress', 'Finished', 'Cancelled']
const validPaymentStatuses = ['Paid', 'Not Paid']
const validPaymentMethods = ['Cash', 'Visa', 'Insurance', 'Free']
const MFA_TOKEN_EXPIRES_IN = '10m'

const toSlotDateKey = (d) => `${d.getDate()}_${d.getMonth() + 1}_${d.getFullYear()}`

const slotTimeToMinutes = (slotTime) => {
  if (slotTime === undefined || slotTime === null || slotTime === '') return 0
  const s = String(slotTime).trim()
  const m24 = s.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (m24) return Number(m24[1]) * 60 + Number(m24[2])
  const m12 = s.match(/^(\d{1,2}):([0-5]\d)\s*([AP]M)$/i)
  if (!m12) return 0
  let h = Number(m12[1])
  const min = Number(m12[2])
  const ap = m12[3].toUpperCase()
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return h * 60 + min
}

const signReceptionistToken = (receptionist) => jwt.sign(createJwtPayload({ id: receptionist._id, role: 'receptionist', email: receptionist.email }), process.env.JWT_SECRET)
const signReceptionistMfaToken = (receptionist, purpose = 'receptionist-mfa') => jwt.sign({
  id: receptionist._id.toString(),
  role: 'receptionist',
  purpose,
  email: receptionist.email
}, process.env.JWT_SECRET, { expiresIn: MFA_TOKEN_EXPIRES_IN })

const getReceptionistFromMfaToken = async (mfaToken, purpose = 'receptionist-mfa') => {
  const decoded = jwt.verify(mfaToken, process.env.JWT_SECRET)
  if (decoded?.purpose !== purpose || decoded?.role !== 'receptionist' || !decoded?.id) return null
  return receptionistModel.findById(decoded.id)
}

const normalizeDoctorLocations = (locations) => {
  if (!locations) return []
  const list = Array.isArray(locations) ? locations : (() => {
    try {
      const parsed = JSON.parse(locations)
      return Array.isArray(parsed) ? parsed : String(locations).split(',')
    } catch {
      return String(locations).split(',')
    }
  })()
  return [...new Set(list.map((location) => String(location || '').trim()).filter(Boolean))]
}

const seedDefaultClinicsForReceptionist = async () => {
  const existingClinics = await clinicModel.find({ name: { $in: defaultClinicNames } }).select('name').lean()
  const existingNames = new Set(existingClinics.map((clinic) => clinic.name))
  const missingClinics = defaultClinicNames
    .filter((name) => !existingNames.has(name))
    .map((name) => ({ name, description: '', date: Date.now() }))

  if (missingClinics.length > 0) {
    await clinicModel.insertMany(missingClinics, { ordered: false })
  }
}

const addReceptionist = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      jobTitle,
      department,
      employeeId,
      bio,
      adminNotes
    } = req.body

    if (!name || !email || !password || !phone) {
      return res.json({ success: false, message: 'Missing Details' })
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: 'Please enter a valid email' })
    }

    const passwordPolicy = await validatePasswordAgainstPolicy(password)
    if (!passwordPolicy.valid) {
      return res.json({ success: false, message: passwordPolicy.message })
    }

    const normalizedEmail = normalizeEmail(email)
    const existingReceptionist = await findOneByEmail(receptionistModel, normalizedEmail)
    if (existingReceptionist) {
      return res.json({ success: false, message: 'Receptionist with this email already exists' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    let imageUrl = ''
    if (req.file) {
      const imageUpload = await cloudinary.uploader.upload(req.file.path, { resource_type: 'image' })
      imageUrl = imageUpload.secure_url
    }

    const address = normalizeReceptionistAddress(req.body.address)
    const emergencyContact = normalizeEmergencyContact(req.body.emergencyContact)

    const newReceptionist = await new receptionistModel({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      password: hashedPassword,
      image: imageUrl,
      address,
      jobTitle: String(jobTitle || 'Receptionist').trim() || 'Receptionist',
      department: String(department || '').trim(),
      employeeId: String(employeeId || '').trim(),
      bio: String(bio || '').trim(),
      emergencyContact,
      adminNotes: String(adminNotes || '').trim(),
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
    const nextActive = !receptionist.isActive
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
    notifyReceptionistAccountStatus({ receptionistId, isActive: nextActive })
    res.json({ success: true, message: 'Receptionist status updated' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const loginReceptionist = async (req, res) => {
  try {
    const { email, password } = req.body
    const receptionist = await findOneByEmail(receptionistModel, email)

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
      const security = await getSecuritySettings()
      const mfaRequired = isMfaRequiredForProfile(security, 'receptionist', receptionist)
      const hasConfiguredMfa = Boolean(receptionist.mfa?.enabled && receptionist.mfa?.secret)

      if (mfaRequired && !hasConfiguredMfa) {
        const secret = generateMfaSecret()
        await receptionistModel.findByIdAndUpdate(receptionist._id, { 'mfa.secret': secret, 'mfa.enabled': false })
        return res.json({
          success: false,
          mfaSetupRequired: true,
          mfaToken: signReceptionistMfaToken(receptionist, 'receptionist-mfa-setup'),
          setup: buildMfaSetupPayload({ secret, accountName: receptionist.email }),
          message: 'MFA setup is required before login'
        })
      }

      if (mfaRequired && hasConfiguredMfa) {
        return res.json({
          success: false,
          mfaRequired: true,
          mfaToken: signReceptionistMfaToken(receptionist),
          message: 'Enter your MFA code'
        })
      }

      const token = signReceptionistToken(receptionist)
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

const verifyReceptionistMfaLogin = async (req, res) => {
  try {
    const { mfaToken, code } = req.body
    const receptionist = await getReceptionistFromMfaToken(mfaToken)
    if (!receptionist || !receptionist.mfa?.secret || !receptionist.mfa?.enabled) {
      return res.json({ success: false, message: 'Invalid MFA session' })
    }

    if (!verifyTotpCode(receptionist.mfa.secret, code)) {
      return res.json({ success: false, message: 'Invalid MFA code' })
    }

    const token = signReceptionistToken(receptionist)
    res.json({ success: true, token })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: 'MFA session expired. Please sign in again.' })
  }
}

const completeReceptionistMfaLoginSetup = async (req, res) => {
  try {
    const { mfaToken, code } = req.body
    const receptionist = await getReceptionistFromMfaToken(mfaToken, 'receptionist-mfa-setup')
    if (!receptionist || !receptionist.mfa?.secret) {
      return res.json({ success: false, message: 'Invalid MFA setup session' })
    }

    if (!verifyTotpCode(receptionist.mfa.secret, code)) {
      return res.json({ success: false, message: 'Invalid MFA code' })
    }

    await receptionistModel.findByIdAndUpdate(receptionist._id, {
      'mfa.enabled': true,
      'mfa.configuredAt': Date.now()
    })

    const token = signReceptionistToken(receptionist)
    res.json({ success: true, token, message: 'MFA configured successfully' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: 'MFA setup session expired. Please sign in again.' })
  }
}

const receptionistDashboard = async (req, res) => {
  try {
    const today = new Date()
    const todaySlotDate = toSlotDateKey(today)
    const rawList = await appointmentModel.find({}).lean()
    const appointments = normalizeAppointmentTeleconsultationLinks(rawList)

    const isActiveAppointment = (item) => !item.cancelled && item.appointmentStatus !== 'Cancelled'
    const todayAppointments = appointments.filter((item) => item.slotDate === todaySlotDate)

    const paidTodayList = todayAppointments.filter((item) => item.paymentStatus === 'Paid')
    const paidToday = paidTodayList.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const paidTodayCount = paidTodayList.length

    const unpaidToday = todayAppointments.filter(
      (item) => isActiveAppointment(item) && item.paymentStatus !== 'Paid'
    ).length

    const totalDueToday = todayAppointments
      .filter((item) => isActiveAppointment(item) && item.paymentStatus !== 'Paid')
      .reduce((s, item) => s + Number(item.amount || 0), 0)

    const unpaidAll = appointments.filter(
      (item) => isActiveAppointment(item) && item.paymentStatus !== 'Paid'
    ).length

    const finishedToday = todayAppointments.filter(
      (item) => item.appointmentStatus === 'Finished' || item.isCompleted
    ).length

    const cancelledToday = todayAppointments.filter(
      (item) => item.cancelled || item.appointmentStatus === 'Cancelled'
    ).length

    const doctorsTodayCount = new Set(
      todayAppointments.filter(isActiveAppointment).map((item) => String(item.docId))
    ).size

    const weekTrend = []
    for (let offset = 6; offset >= 0; offset -= 1) {
      const d = new Date(today)
      d.setDate(today.getDate() - offset)
      const key = toSlotDateKey(d)
      const count = appointments.filter((a) => a.slotDate === key && isActiveAppointment(a)).length
      weekTrend.push({ slotDate: key, count })
    }

    const todayQueue = [...todayAppointments]
      .filter(isActiveAppointment)
      .sort((a, b) => slotTimeToMinutes(a.slotTime) - slotTimeToMinutes(b.slotTime))
      .map((item) => ({
        _id: item._id,
        userData: {
          name: item.userData?.name,
          phone: item.userData?.phone,
          patientId: item.userData?.patientId
        },
        docData: { name: item.docData?.name, speciality: item.docData?.speciality },
        slotTime: item.slotTime,
        slotDate: item.slotDate,
        appointmentStatus: item.appointmentStatus,
        paymentStatus: item.paymentStatus,
        cancelled: item.cancelled,
        isCompleted: item.isCompleted,
        amount: Number(item.amount || 0),
        clinicLocation: item.clinicLocation || '',
        appointmentType: item.appointmentType || 'Clinic',
        reservationNumber: item.reservationNumber || '',
        bookedBy: item.bookedBy || 'Patient'
      }))

    const sortedByBooked = [...appointments].sort((a, b) => (b.date || 0) - (a.date || 0))
    const latestAppointments = sortedByBooked.slice(0, 8)

    const needsAttention = todayQueue.filter(
      (row) => row.paymentStatus !== 'Paid' && ['Booked', 'Checked In', 'In Progress'].includes(row.appointmentStatus)
    ).length

    const dashData = {
      todayAppointments: todayAppointments.length,
      checkedIn: todayAppointments.filter((item) => item.appointmentStatus === 'Checked In').length,
      inProgress: todayAppointments.filter((item) => item.appointmentStatus === 'In Progress').length,
      unpaid: unpaidAll,
      unpaidToday,
      paidToday,
      paidTodayCount,
      totalDueToday,
      finishedToday,
      cancelledToday,
      doctorsTodayCount,
      weekTrend,
      todayQueue,
      latestAppointments,
      needsAttention
    }

    res.json({ success: true, dashData })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const receptionistAppointments = async (req, res) => {
  try {
    const appointments = await appointmentModel.find({}).sort({ date: -1 }).lean()
    const userIds = [...new Set(appointments.map((item) => String(item.userId || '')).filter(Boolean))]
    const users = userIds.length
      ? await userModel.find({ _id: { $in: userIds } }).select('insurance').lean()
      : []
    const insuranceByUser = Object.fromEntries(users.map((user) => [user._id.toString(), sanitizeInsuranceForClient(user.insurance)]))

    const enriched = appointments.map((appointment) => ({
      ...appointment,
      patientInsurance: insuranceByUser[String(appointment.userId || '')] || null
    }))

    res.json({ success: true, appointments: enriched })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const receptionistDoctors = async (req, res) => {
  try {
    const doctors = await doctorModel.find({}).select('-password').populate('clinics')
    const doctorsWithRatings = await attachRatingSummariesToDoctors(doctors)
    res.json({ success: true, doctors: doctorsWithRatings })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const receptionistClinics = async (req, res) => {
  try {
    await seedDefaultClinicsForReceptionist()

    const clinics = await clinicModel.find({}).sort({ name: 1 }).lean()
    const doctors = await doctorModel.find({}).select('-password').populate('clinics')
    const doctorsWithRatings = await attachRatingSummariesToDoctors(doctors)

    const clinicsWithDoctors = clinics.map((clinic) => ({
      ...clinic,
      doctors: doctorsWithRatings.filter((doctor) => {
        const assignedClinicIds = (doctor.clinics || []).map((assignedClinic) => assignedClinic?._id?.toString()).filter(Boolean)
        const hasClinicAssignments = assignedClinicIds.length > 0
        const assignedToClinic = assignedClinicIds.includes(clinic._id.toString())
        const matchesLegacySpeciality = !hasClinicAssignments && doctor.speciality === clinic.name

        return assignedToClinic || matchesLegacySpeciality
      })
    }))

    res.json({ success: true, clinics: clinicsWithDoctors, defaultClinics: defaultClinicNames })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const receptionistPatients = async (req, res) => {
  try {
    const patients = await userModel.find({}).select('-password -resetOtp -resetOtpExpireAt').sort({ createdAt: -1 }).lean()
    const patientIds = patients.map((patient) => patient._id.toString())

    const appointmentCounts = await appointmentModel.aggregate([
      { $match: { userId: { $in: patientIds } } },
      {
        $group: {
          _id: '$userId',
          appointments: { $sum: 1 },
          paidAppointments: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, 1, 0] } },
          lastAppointmentDate: { $max: '$date' }
        }
      }
    ])

    const statsByPatient = appointmentCounts.reduce((acc, item) => {
      acc[item._id] = item
      return acc
    }, {})

    const patientsWithStats = patients.map((patient) => ({
      ...patient,
      isActive: patient.isActive !== false,
      appointmentStats: {
        appointments: statsByPatient[patient._id.toString()]?.appointments || 0,
        paidAppointments: statsByPatient[patient._id.toString()]?.paidAppointments || 0,
        lastAppointmentDate: statsByPatient[patient._id.toString()]?.lastAppointmentDate || 0
      }
    }))

    res.json({ success: true, patients: patientsWithStats })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const receptionistPatientDetails = async (req, res) => {
  try {
    const { patientId } = req.params

    if (!patientId) {
      return res.json({ success: false, message: 'Patient ID is required' })
    }

    const patient = await userModel.findById(patientId).select('-password -resetOtp -resetOtpExpireAt').lean()
    if (!patient) {
      return res.json({ success: false, message: 'Patient not found' })
    }

    const appointments = await appointmentModel.find({ userId: patientId }).sort({ date: -1 }).lean()
    const prescriptions = await prescriptionModel.find({ userId: patientId }).sort({ createdAt: -1 }).lean()

    const totals = appointments.reduce((acc, appointment) => {
      acc.appointments += 1
      if (appointment.paymentStatus === 'Paid') acc.paidAppointments += 1
      if (appointment.paymentStatus !== 'Paid') acc.unpaidAppointments += 1
      if (appointment.cancelled || appointment.appointmentStatus === 'Cancelled') acc.cancelledAppointments += 1
      if (appointment.isCompleted || appointment.appointmentStatus === 'Finished') acc.completedAppointments += 1
      return acc
    }, {
      appointments: 0,
      paidAppointments: 0,
      unpaidAppointments: 0,
      cancelledAppointments: 0,
      completedAppointments: 0
    })

    res.json({
      success: true,
      patient: { ...patient, isActive: patient.isActive !== false },
      appointments,
      prescriptions,
      totals
    })
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

    if (!isPastDate(dob)) {
      return res.json({ success: false, message: 'Birth date must be in the past' })
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: 'Please enter a valid email' })
    }

    const passwordPolicy = await validatePasswordAgainstPolicy(password)
    if (!passwordPolicy.valid) {
      return res.json({ success: false, message: passwordPolicy.message })
    }

    const normalizedEmail = normalizeEmail(email)
    const existingPatientByEmail = await findOneByEmail(userModel, normalizedEmail)
    const existingPatientByPhone = await userModel.findOne({ phone })
    if (existingPatientByEmail || existingPatientByPhone) {
      return res.json({ success: false, message: 'A patient with this email or phone already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const patientId = await getNextPatientId()
    const insurance = await buildInsuranceData(body, req.file, {}, 'receptionist', {
      verifiedBy: req.receptionist?.receptionistId || 'receptionist'
    })

    const patient = await new userModel({
      name,
      email: normalizedEmail,
      phone,
      dob,
      gender: ['Male', 'Female'].includes(gender) ? gender : 'Not Selected',
      password: hashedPassword,
      patientId,
      insurance,
      ...markStaffCreatedAccountVerified()
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

    const insurance = await buildInsuranceData(body, req.file, patient.insurance || {}, 'receptionist', {
      verifiedBy: req.receptionist?.receptionistId || 'receptionist'
    })
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

    res.json({ success: true, message: 'Insurance updated', insurance: sanitizeInsuranceForClient(insurance) })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const verifyPatientInsurance = async (req, res) => {
  try {
    const body = req.body || {}
    const { patientId, declineReason, appointmentId } = body
    const status = String(body.status || body.visitStatus || '').trim().toLowerCase()
    const note = String(body.note || body.insuranceVisitNote || '').trim()
    const receptionistId = req.receptionist?.receptionistId || 'receptionist'

    if (!patientId) {
      return res.json({ success: false, message: 'Patient is required' })
    }

    const patient = await userModel.findById(patientId).select('insurance name patientId')
    if (!patient) {
      return res.json({ success: false, message: 'Patient not found' })
    }

    const insurance = applyVerificationDecision(patient.insurance || {}, {
      status,
      verifiedBy: receptionistId,
      declineReason
    })

    await userModel.findByIdAndUpdate(patientId, { insurance })

    let appointment = null
    if (appointmentId) {
      const visitCheck = buildInsuranceVisitCheck({ status, checkedBy: receptionistId, note: note || declineReason })
      appointment = await appointmentModel.findByIdAndUpdate(
        appointmentId,
        { insuranceVisitCheck: visitCheck },
        { new: true }
      )
    }

    await logAudit({
      action: 'insurance_verify',
      actorUserId: receptionistId,
      actorRole: 'receptionist',
      status: 'success',
      targetUserId: patientId,
      entityType: 'user',
      entityId: patientId,
      metadata: {
        verificationStatus: insurance.verificationStatus,
        appointmentId: appointmentId || '',
        patientName: patient.name,
        patientLoginId: patient.patientId
      },
      req
    })

    res.json({
      success: true,
      message: insurance.verificationStatus === 'approved' ? 'Insurance approved' : 'Insurance declined',
      insurance: sanitizeInsuranceForClient(insurance),
      appointment
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const bookAppointmentForPatient = async (req, res) => {
  try {
    const { patientId, docId, slotDate, slotTime } = req.body
    const clinicLocation = String(req.body.clinicLocation || '').trim()
    const appointmentType = normalizeAppointmentType(req.body.appointmentType)
    const homeVisitAddress = normalizeHomeVisitAddress(req.body.homeVisitAddress || {})
    const receptionistId = req.receptionist.receptionistId

    if (!patientId || !docId || !slotDate || !slotTime) {
      return res.json({ success: false, message: 'Missing appointment details' })
    }
    const docData = await doctorModel.findById(docId).select('-password')
    const userData = await userModel.findById(patientId).select('-password')

    if (!docData) {
      return res.json({ success: false, message: 'Doctor not found' })
    }

    if (appointmentType === 'Home Visit') {
      const addressError = validateHomeVisitAddress(homeVisitAddress, docData)
      if (addressError) return res.json({ success: false, message: addressError })
    }

    const appointmentModeError = getDoctorAppointmentModeError(docData, appointmentType)
    if (appointmentModeError) {
      return res.json({ success: false, message: appointmentModeError })
    }
    const doctorLocations = (docData.locations || []).map((location) => String(location || '').trim()).filter(Boolean)
    const resolvedClinicLocation = resolveClinicLocationForSchedule(docData, clinicLocation, appointmentType)
    if (usesClinicWeeklySchedule(appointmentType) && doctorLocations.length > 1 && !resolvedClinicLocation) {
      return res.json({ success: false, message: 'Please choose a clinic location' })
    }
    if (usesClinicWeeklySchedule(appointmentType) && resolvedClinicLocation && doctorLocations.length > 0 && !doctorLocations.includes(resolvedClinicLocation)) {
      return res.json({ success: false, message: 'Please choose a valid clinic location' })
    }

    if (!userData) {
      return res.json({ success: false, message: 'Patient not found' })
    }

    if (userData.isActive === false) {
      return res.json({ success: false, message: 'Patient account is deactivated' })
    }

    const patientInsurance = userData.insurance || {}
    const insurancePct = Math.min(100, Math.max(0, Number(req.body.insuranceCoveragePercent ?? 0) || 0))
    const needsInsuranceVisitCheck = Boolean(patientInsurance.enabled) || insurancePct > 0
    let insuranceVisitCheck = { status: '', checkedAt: 0, checkedBy: '', note: '' }

    if (needsInsuranceVisitCheck) {
      const visitStatus = String(req.body.insuranceVisitStatus || '').trim().toLowerCase()
      if (!['approved', 'declined'].includes(visitStatus)) {
        return res.json({
          success: false,
          message: 'Please confirm insurance status for this visit (approve or decline) before booking.'
        })
      }
      if (visitStatus === 'approved' && isInsuranceExpired(patientInsurance.expiryDate)) {
        return res.json({
          success: false,
          message: 'Insurance card is expired. Update the expiry date or decline coverage for this visit.'
        })
      }
      if (visitStatus === 'declined' && !String(req.body.insuranceVisitNote || req.body.declineReason || '').trim()) {
        return res.json({ success: false, message: 'Please provide a reason when declining insurance for this visit.' })
      }

      insuranceVisitCheck = buildInsuranceVisitCheck({
        status: visitStatus,
        checkedBy: receptionistId,
        note: req.body.insuranceVisitNote || req.body.declineReason || ''
      })

      if (visitStatus === 'approved') {
        const profileStatus = getEffectiveVerificationStatus(patientInsurance)
        if (profileStatus === 'pending') {
          const approvedInsurance = applyVerificationDecision(patientInsurance, {
            status: 'approved',
            verifiedBy: receptionistId
          })
          await userModel.findByIdAndUpdate(patientId, { insurance: approvedInsurance })
          userData.insurance = approvedInsurance
        } else if (profileStatus !== 'declined') {
          await userModel.findByIdAndUpdate(patientId, {
            insurance: {
              ...patientInsurance,
              lastCheckedAt: insuranceVisitCheck.checkedAt,
              lastCheckedBy: receptionistId
            }
          })
        }
      }
    }

    const scheduleCheck = isSlotAllowedBySchedule(docData, slotDate, slotTime, appointmentType, clinicLocation)
    if (!scheduleCheck.allowed) {
      return res.json({ success: false, message: scheduleCheck.reason })
    }

    // Check for any existing appointment for this doctor at the same time across all locations
    // This prevents double-booking across multiple clinic locations
    const conflictingAppointment = await appointmentModel.findOne({
      docId,
      slotDate,
      slotTime,
      appointmentType,
      appointmentStatus: { $ne: 'Cancelled' }
    })

    if (conflictingAppointment) {
      return res.json({ 
        success: false, 
        message: `Doctor is already booked for this time slot at ${conflictingAppointment.clinicLocation || 'another location'}` 
      })
    }

    const bookedSlotsField = getBookedSlotsField(appointmentType)
    const slotUpdate = await doctorModel.updateOne(
      { _id: docId, [`${bookedSlotsField}.${slotDate}`]: { $ne: slotTime } },
      { $addToSet: { [`${bookedSlotsField}.${slotDate}`]: slotTime } }
    )

    if (slotUpdate.modifiedCount === 0) {
      return res.json({ success: false, message: 'Slot not available' })
    }

    const appointmentDocData = docData.toObject()
    delete appointmentDocData.slots_booked
    delete appointmentDocData.home_visit_slots_booked

    const baseAmount = Number(docData.fees || 0)
    const pricing = applyDoctorPromoCode(docData)
    const baseMinor = Math.round(Math.max(0, baseAmount) * 100)
    const promoMinor = Math.round((pricing.discountAmount || 0) * 100)
    const insuranceMinor = insurancePct > 0 ? Math.round((baseMinor * insurancePct) / 100) : 0
    const totalDiscountMinor = Math.min(baseMinor, promoMinor + insuranceMinor)
    const discountAmount = totalDiscountMinor / 100
    let discountReason = pricing.discountReason || ''
    if (insuranceMinor > 0) {
      discountReason = discountReason
        ? `${discountReason}; Insurance coverage (${insurancePct}%)`
        : `Insurance coverage (${insurancePct}%)`
    }
    const coveredByInsurance = insurancePct > 0
    const homeVisitPricing = await getHomeVisitPricingSettings()
    const consultAmount = Math.max(0, (baseMinor - totalDiscountMinor) / 100)
    const homeVisitSurcharge = isHomeVisitAppointmentType(appointmentType) ? computeHomeVisitSurcharge(docData, homeVisitPricing) : 0
    const amount = consultAmount + homeVisitSurcharge

    const appointmentId = new appointmentModel()._id
    const teleconsultationLink = ['Voice Call', 'Video Call'].includes(appointmentType) ? buildTeleconsultationLink({ appointmentId, docId, userId: patientId, slotDate, slotTime }) : ''

    const appointmentData = {
      _id: appointmentId,
      reservationNumber: await getNextReservationNumber(),
      userId: patientId,
      docId,
      userData,
      docData: appointmentDocData,
      amount,
      originalAmount: baseAmount,
      discountAmount,
      discountReason,
      promoCode: pricing.promoCode || '',
      coveredByInsurance,
      slotTime,
      slotDate,
      clinicLocation: usesClinicWeeklySchedule(appointmentType) ? resolvedClinicLocation : '',
      appointmentType,
      teleconsultationLink,
      homeVisitAddress: appointmentType === 'Home Visit' ? { ...homeVisitAddress, updatedBy: 'Receptionist', updatedAt: Date.now() } : {},
      date: Date.now(),
      appointmentStatus: 'Booked',
      paymentStatus: 'Not Paid',
      bookedBy: 'Receptionist',
      receptionistId,
      insuranceVisitCheck
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
        slotTime,
        appointmentType
      },
      req
    })

    notifyAppointmentBooked({ appointment: newAppointment, bookedBy: 'Receptionist' })

    res.json({ success: true, message: 'Appointment Booked' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const updateDoctorLocationsByReceptionist = async (req, res) => {
  try {
    const { docId } = req.body
    if (!docId) {
      return res.json({ success: false, message: 'Doctor is required' })
    }

    const locations = normalizeDoctorLocations(req.body.locations)
    await doctorModel.findByIdAndUpdate(docId, { locations })

    await logAudit({
      action: 'doctor_locations_update',
      actorUserId: req.receptionist?.receptionistId,
      actorRole: 'receptionist',
      status: 'success',
      targetUserId: docId,
      entityType: 'doctor',
      entityId: docId,
      metadata: { locations },
      req
    })

    res.json({ success: true, message: 'Doctor locations updated', locations })
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

    let refundMessage = ''
    if (appointmentStatus === 'Cancelled' && appointment.paymentStatus === 'Paid' && appointment.paymentMethod === 'Visa') {
      const refundResult = await refundAppointmentPayment({ appointment, appointmentId, requestedBy: 'receptionist', req })
      refundMessage = refundResult.refunded ? ' Refund requested.' : ''
    }

    const previousStatus = appointment.appointmentStatus

    await appointmentModel.findByIdAndUpdate(appointmentId, updateData)

    const mergedAppointment = { ...appointment.toObject(), ...updateData }

    if (appointmentStatus === 'Cancelled') {
      notifyAppointmentCancelled({ appointment: mergedAppointment, cancelledBy: 'receptionist' })
    } else if (previousStatus !== appointmentStatus) {
      notifyAppointmentStatusChanged({
        appointment: mergedAppointment,
        previousStatus,
        nextStatus: appointmentStatus
      })
    }

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
      const bookedSlotsField = getBookedSlotsField(appointment.appointmentType)
      const slots_booked = doctorData?.[bookedSlotsField] || {}
      if (slots_booked[appointment.slotDate]) {
        slots_booked[appointment.slotDate] = slots_booked[appointment.slotDate].filter(slot => slot !== appointment.slotTime)
        await doctorModel.findByIdAndUpdate(appointment.docId, { [bookedSlotsField]: slots_booked })
      }
    }

    res.json({ success: true, message: `Appointment status updated${refundMessage}` })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const updateAppointmentHomeVisitAddress = async (req, res) => {
  try {
    const { appointmentId } = req.body
    const homeVisitAddress = normalizeHomeVisitAddress(req.body.homeVisitAddress || {})

    if (!appointmentId) {
      return res.json({ success: false, message: 'Appointment is required' })
    }

    const appointment = await appointmentModel.findById(appointmentId)
    if (!appointment) {
      return res.json({ success: false, message: 'Appointment not found' })
    }
    if (appointment.appointmentType !== 'Home Visit') {
      return res.json({ success: false, message: 'Only home visit appointments have a visit address' })
    }

    const addressError = validateHomeVisitAddress(homeVisitAddress, appointment.docData)
    if (addressError) {
      return res.json({ success: false, message: addressError })
    }

    const updatedAddress = { ...homeVisitAddress, updatedBy: 'Receptionist', updatedAt: Date.now() }
    await appointmentModel.findByIdAndUpdate(appointmentId, { homeVisitAddress: updatedAddress })

    await logAudit({
      action: 'home_visit_address_update',
      actorUserId: req.receptionist?.receptionistId,
      actorRole: 'receptionist',
      status: 'success',
      targetUserId: appointment.userId,
      entityType: 'appointment',
      entityId: appointmentId,
      metadata: { area: updatedAddress.area },
      req
    })

    res.json({ success: true, message: 'Home visit address updated', homeVisitAddress: updatedAddress })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const updatePayment = async (req, res) => {
  try {
    const body = req.body || {}
    const { appointmentId, paymentMethod, discountReason, paymentNote } = body
    const rawPaymentStatus = String(body.paymentStatus ?? '').trim()
    const paymentStatus =
      rawPaymentStatus.toLowerCase() === 'paid'
        ? 'Paid'
        : rawPaymentStatus.toLowerCase() === 'not paid'
          ? 'Not Paid'
          : rawPaymentStatus
    let discountAmount = Math.max(0, Number(body.discountAmount || 0))
    let nextDiscountReason = String(discountReason || '').trim()
    let nextPromoCode = ''
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
    if (paymentStatus === 'Paid' && discountAmount === 0 && !appointment.promoCode) {
      const currentDoctor = await doctorModel.findById(appointment.docId).select('fees promoCode')
      const promoPricing = applyDoctorPromoCode(currentDoctor || appointment.docData)
      if (!promoPricing.error && promoPricing.discountAmount > 0) {
        discountAmount = promoPricing.discountAmount
        nextDiscountReason = promoPricing.discountReason
        nextPromoCode = promoPricing.promoCode
      }
    }

    const homeVisitPricingForPayment = await getHomeVisitPricingSettings()
    const finalAmount = (() => {
      const bm = Math.round(Math.max(0, baseAmount) * 100)
      const dm = Math.round(Math.max(0, discountAmount) * 100)
      const consult = Math.max(0, (bm - Math.min(bm, dm)) / 100)
      const homeVisitSurcharge = isHomeVisitAppointmentType(appointment.appointmentType)
        ? computeHomeVisitSurcharge(appointment.docData, homeVisitPricingForPayment)
        : 0
      return consult + homeVisitSurcharge
    })()
    const requestedPaymentMethod = paymentMethod === 'Free' && finalAmount > 0 ? 'Cash' : paymentMethod
    const insuranceMethodChosen = coveredByInsurance && (paymentMethod === 'Insurance' || requestedPaymentMethod === 'Insurance')
    let nextPaymentMethod
    if (finalAmount === 0) {
      nextPaymentMethod = insuranceMethodChosen ? 'Insurance' : 'Free'
    } else {
      nextPaymentMethod = coveredByInsurance ? 'Insurance' : requestedPaymentMethod
    }

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

    const updatedAppointment = await appointmentModel.findByIdAndUpdate(appointmentId, {
      amount: finalAmount,
      originalAmount: baseAmount,
      discountAmount,
      discountReason: nextDiscountReason,
      promoCode: nextPromoCode || appointment.promoCode || '',
      coveredByInsurance,
      paymentStatus,
      paymentMethod: effectiveMethod,
      paymentNote: String(paymentNote || '').trim(),
      paidAt: paymentStatus === 'Paid' ? Date.now() : 0
    }, { new: true })

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

    const previousWasPaid = isPaidPaymentStatus(appointment.paymentStatus)
    const nowPaid = paymentStatus === 'Paid'

    if (nowPaid && !previousWasPaid) {
      const plain =
        updatedAppointment && typeof updatedAppointment.toObject === 'function'
          ? updatedAppointment.toObject()
          : updatedAppointment
      await notifyPaymentRecorded({ appointment: plain, source: 'receptionist' })
    }

    res.json({ success: true, message: 'Payment updated', appointment: updatedAppointment })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const checkInPatient = async (req, res) => {
  req.body.appointmentStatus = 'Checked In'
  return updateAppointmentStatus(req, res)
}

const receptionistProfile = async (req, res) => {
  try {
    const { receptionistId } = req.receptionist
    const doc = await receptionistModel.findById(receptionistId).select('-password -mfa.secret').lean()
    if (!doc) {
      return res.json({ success: false, message: 'Receptionist not found' })
    }
    const { adminNotes: _adminNotes, ...receptionist } = doc
    res.json({ success: true, receptionist })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const updateReceptionistProfileData = async (req, res) => {
  try {
    const { receptionistId } = req.receptionist
    const b = req.body
    const updateData = {}

    if (b.name !== undefined) {
      const nextName = String(b.name || '').trim()
      if (!nextName) {
        return res.json({ success: false, message: 'Name is required' })
      }
      updateData.name = nextName
    }
    if (b.phone !== undefined) updateData.phone = String(b.phone || '').trim()
    if (b.jobTitle !== undefined) {
      const jt = String(b.jobTitle || '').trim()
      updateData.jobTitle = jt || 'Receptionist'
    }
    if (b.department !== undefined) updateData.department = String(b.department || '').trim()
    if (b.bio !== undefined) updateData.bio = String(b.bio || '').trim()
    if (b.address !== undefined) updateData.address = normalizeReceptionistAddress(b.address)
    if (b.emergencyContact !== undefined) updateData.emergencyContact = normalizeEmergencyContact(b.emergencyContact)

    if (req.file) {
      const imageUpload = await cloudinary.uploader.upload(req.file.path, { resource_type: 'image' })
      updateData.image = imageUpload.secure_url
    }

    if (Object.keys(updateData).length === 0) {
      return res.json({ success: false, message: 'Nothing to update' })
    }

    await receptionistModel.findByIdAndUpdate(receptionistId, updateData)
    res.json({ success: true, message: 'Profile updated' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const getReceptionistMfaStatus = async (req, res) => {
  try {
    const { receptionistId } = req.receptionist
    const receptionist = await receptionistModel.findById(receptionistId).select('email mfa').lean()
    const security = await getSecuritySettings()
    res.json({
      success: true,
      mfa: {
        enabled: Boolean(receptionist?.mfa?.enabled),
        required: isMfaRequiredForProfile(security, 'receptionist', receptionist),
        requiredByAdmin: Boolean(receptionist?.mfa?.requiredByAdmin),
        canSelfManage: security.mfaAllowUserOptIn !== false
      }
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const startReceptionistMfaSetup = async (req, res) => {
  try {
    const { receptionistId } = req.receptionist
    const receptionist = await receptionistModel.findById(receptionistId).select('email mfa')
    const security = await getSecuritySettings()
    if (!isMfaRequiredForProfile(security, 'receptionist', receptionist) && security.mfaAllowUserOptIn === false) {
      return res.json({ success: false, message: 'Self-service MFA is disabled by admin' })
    }

    const secret = generateMfaSecret()
    await receptionistModel.findByIdAndUpdate(receptionistId, { 'mfa.secret': secret, 'mfa.enabled': false })
    res.json({ success: true, setup: buildMfaSetupPayload({ secret, accountName: receptionist.email }) })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const enableReceptionistMfa = async (req, res) => {
  try {
    const { receptionistId } = req.receptionist
    const { code } = req.body
    const receptionist = await receptionistModel.findById(receptionistId).select('mfa')
    if (!receptionist?.mfa?.secret) return res.json({ success: false, message: 'Start MFA setup first' })
    if (!verifyTotpCode(receptionist.mfa.secret, code)) return res.json({ success: false, message: 'Invalid MFA code' })

    await receptionistModel.findByIdAndUpdate(receptionistId, { 'mfa.enabled': true, 'mfa.configuredAt': Date.now() })
    await logAudit({
      action: 'mfa_enable',
      status: 'success',
      actorUserId: receptionistId,
      actorRole: 'receptionist',
      entityType: 'receptionist',
      entityId: receptionistId,
      req
    })
    res.json({ success: true, message: 'MFA enabled' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const disableReceptionistMfa = async (req, res) => {
  try {
    const { receptionistId } = req.receptionist
    const { code } = req.body
    const receptionist = await receptionistModel.findById(receptionistId).select('mfa')
    const security = await getSecuritySettings()
    if (isMfaRequiredForProfile(security, 'receptionist', receptionist)) {
      return res.json({ success: false, message: 'MFA is required by policy and cannot be disabled' })
    }
    if (receptionist?.mfa?.secret && !verifyTotpCode(receptionist.mfa.secret, code)) {
      return res.json({ success: false, message: 'Invalid MFA code' })
    }

    await receptionistModel.findByIdAndUpdate(receptionistId, { 'mfa.enabled': false, 'mfa.secret': '', 'mfa.resetAt': Date.now() })
    await logAudit({
      action: 'mfa_disable',
      status: 'success',
      actorUserId: receptionistId,
      actorRole: 'receptionist',
      entityType: 'receptionist',
      entityId: receptionistId,
      req
    })
    res.json({ success: true, message: 'MFA disabled' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export {
  addReceptionist,
  allReceptionists,
  changeReceptionistStatus,
  loginReceptionist,
  verifyReceptionistMfaLogin,
  completeReceptionistMfaLoginSetup,
  receptionistDashboard,
  receptionistAppointments,
  receptionistDoctors,
  receptionistClinics,
  receptionistPatients,
  receptionistPatientDetails,
  createPatientForReceptionist,
  updatePatientInsurance,
  verifyPatientInsurance,
  bookAppointmentForPatient,
  updateAppointmentStatus,
  updateAppointmentHomeVisitAddress,
  updatePayment,
  checkInPatient,
  updateDoctorLocationsByReceptionist,
  receptionistProfile,
  updateReceptionistProfileData,
  getReceptionistMfaStatus,
  startReceptionistMfaSetup,
  enableReceptionistMfa,
  disableReceptionistMfa
}
