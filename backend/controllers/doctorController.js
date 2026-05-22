import doctorModel from "../models/doctorModel.js"
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import appointmentModel from "../models/appointmentModel.js"
import prescriptionModel from "../models/prescriptionModel.js"
import userModel from "../models/userModel.js"
import { createJwtPayload } from "../middlewares/rbac.js"
import { logAudit } from "../services/auditService.js"
import { getBookedSlotsField, hasDoctorPublishedSchedule, isDoctorOpenForPatientBooking, sanitizeSchedule, validateDoctorNoScheduleOverlap } from "../services/scheduleService.js"
import { normalizeDoctorHomeVisitAreas, normalizeHomeVisitAddress, validateHomeVisitAddress } from "../services/homeVisitService.js"
import { attachRatingSummariesToDoctors } from "./ratingController.js"
import { buildMfaSetupPayload, generateMfaSecret, verifyTotpCode } from "../services/mfaService.js"
import { getSecuritySettings, isMfaRequiredForProfile } from "../services/securityPolicyService.js"
import { normalizeAppointmentTeleconsultationLinks } from "../services/appointmentModeService.js"
import { notifyAppointmentCancelled, notifyVisitCompletedWithPrescription } from '../services/notificationService.js'
import { findOneByEmail } from '../utils/emailUtils.js'
import { normalizeExperienceForStorage } from '../utils/doctorExperience.js'
import { buildClinicBySpecialityMap, enrichDoctorWithSpecialityClinic } from '../utils/doctorClinicLink.js'

const MFA_TOKEN_EXPIRES_IN = '10m'

const signDoctorToken = (doctor) => jwt.sign(createJwtPayload({ id: doctor._id, role: 'doctor', email: doctor.email }), process.env.JWT_SECRET)

const signDoctorMfaToken = (doctor, purpose = 'doctor-mfa') => jwt.sign({
   id: doctor._id.toString(),
   role: 'doctor',
   purpose,
   email: doctor.email
}, process.env.JWT_SECRET, { expiresIn: MFA_TOKEN_EXPIRES_IN })

const getDoctorFromMfaToken = async (mfaToken, purpose = 'doctor-mfa') => {
   const decoded = jwt.verify(mfaToken, process.env.JWT_SECRET)
   if (decoded?.purpose !== purpose || decoded?.role !== 'doctor' || !decoded?.id) return null
   return doctorModel.findById(decoded.id)
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

const normalizeLocationSchedules = (locationSchedules, locations = [], fallbackSchedule = {}) => {
   if (!locationSchedules) return {}
   const source = typeof locationSchedules === 'string'
      ? (() => {
         try { return JSON.parse(locationSchedules) } catch { return {} }
      })()
      : locationSchedules
   const allowedLocations = new Set(locations.map((location) => String(location || '').trim()).filter(Boolean))
   return Object.entries(source || {}).reduce((acc, [location, schedule]) => {
      const key = String(location || '').trim()
      if (!key || (allowedLocations.size > 0 && !allowedLocations.has(key))) return acc
      acc[key] = sanitizeSchedule({ ...fallbackSchedule, ...(schedule || {}) })
      return acc
   }, {})
}

const normalizeDoctorGender = (gender) => ['Male', 'Female'].includes(gender) ? gender : ''
const normalizeDoctorTitle = (title) => ['Professor', 'Lecturer', 'Consultant', 'Specialist'].includes(title) ? title : ''
const parseBoolean = (value, fallback = false) => {
   if (value === undefined || value === null || value === '') return fallback
   return value === true || value === 'true' || value === 'on' || value === '1'
}
const normalizePromoCode = (promoCode = {}) => {
   const source = typeof promoCode === 'string'
      ? (() => {
         try { return JSON.parse(promoCode) } catch { return { code: promoCode } }
      })()
      : promoCode
   const discountType = source?.discountType === 'fixed' ? 'fixed' : 'percentage'
   const rawDiscountValue = Math.max(0, Number(source?.discountValue || 0))
   const discountValue = discountType === 'percentage' ? Math.min(100, rawDiscountValue) : rawDiscountValue
   const fallbackCode = discountType === 'percentage' ? `${discountValue}PCTOFF` : `${discountValue}OFF`
   const active = parseBoolean(source?.active, false) && discountValue > 0
   const code = String(source?.code || (active ? fallbackCode : '')).trim().toUpperCase()

   return {
      code,
      discountType,
      discountValue,
      active
   }
}

const attachCompletedBookingsCountToDoctors = async (doctors = []) => {
  const doctorIds = doctors.map((d) => String(d._id || d.id)).filter(Boolean)
  if (doctorIds.length === 0) return doctors

  const rows = await appointmentModel.aggregate([
    {
      $match: {
        docId: { $in: doctorIds },
        isCompleted: true,
        cancelled: { $ne: true }
      }
    },
    { $group: { _id: '$docId', completedBookingsCount: { $sum: 1 } } }
  ])

  const countMap = rows.reduce((acc, row) => {
    acc[String(row._id)] = row.completedBookingsCount
    return acc
  }, {})

  return doctors.map((doctor) => ({
    ...doctor,
    completedBookingsCount: countMap[String(doctor._id || doctor.id)] || 0
  }))
}

const isDoctorAvailable = (doctor) => doctor?.available !== false

const changeAvailability = async (req, res) => {
  try {
    const { docId, available } = req.body
    if (!docId) {
      return res.json({ success: false, message: 'Doctor ID is required' })
    }

    const docData = await doctorModel.findById(docId)
    if (!docData) {
      return res.json({ success: false, message: 'Doctor not found' })
    }

    const nextAvailable = available === undefined || available === null || available === ''
      ? !isDoctorAvailable(docData)
      : parseBoolean(available, true)

    await doctorModel.findByIdAndUpdate(docId, { available: nextAvailable })
    res.json({ success: true, message: 'Availability Changed', available: nextAvailable })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}


const doctorList = async (req,res) => {
   try {
     const doctors = await doctorModel.find({}).select(['-password', '-email']).populate('clinics')
     const doctorsWithRatings = await attachRatingSummariesToDoctors(doctors)
     const doctorsWithStats = await attachCompletedBookingsCountToDoctors(doctorsWithRatings)
     const clinicBySpecKey = await buildClinicBySpecialityMap()
     const doctorsForPatients = doctorsWithStats.map((doctor) => {
       const doc = enrichDoctorWithSpecialityClinic(doctor, clinicBySpecKey)
       return {
         ...doc,
         patientBookable: isDoctorOpenForPatientBooking(doc)
       }
     })
     res.json({success:true, doctors: doctorsForPatients})
   } catch (error) {
      console.log(error)
      res.json({success:false, message:error.message})
   }
}


// API for doctor login
const loginDoctor = async (req,res) => {
   try {
     const { email, password } = req.body
     const doctor = await findOneByEmail(doctorModel, email)

     if(!doctor){
        await logAudit({
         action: 'login_failed',
         status: 'failed',
         reason: 'Invalid doctor credentials',
         entityType: 'doctor',
         metadata: { email },
         req
        })
        return res.json({success: false, message: 'Invalid credentails'})
      }
   
      const isMatch = await bcrypt.compare(password, doctor.password)
      
      if(isMatch){
         const security = await getSecuritySettings()
         const mfaRequired = isMfaRequiredForProfile(security, 'doctor', doctor)
         const hasConfiguredMfa = Boolean(doctor.mfa?.enabled && doctor.mfa?.secret)

         if (mfaRequired && !hasConfiguredMfa) {
            const secret = generateMfaSecret()
            await doctorModel.findByIdAndUpdate(doctor._id, { 'mfa.secret': secret, 'mfa.enabled': false })
            await logAudit({
               action: 'mfa_setup_required',
               actorUserId: doctor._id,
               actorRole: 'doctor',
               status: 'success',
               entityType: 'doctor',
               entityId: doctor._id,
               metadata: { loginId: doctor.email },
               req
            })
            return res.json({
               success: false,
               mfaSetupRequired: true,
               mfaToken: signDoctorMfaToken(doctor, 'doctor-mfa-setup'),
               setup: buildMfaSetupPayload({ secret, accountName: doctor.email }),
               message: 'MFA setup is required before login'
            })
         }

         if (mfaRequired && hasConfiguredMfa) {
            return res.json({
               success: false,
               mfaRequired: true,
               mfaToken: signDoctorMfaToken(doctor),
               message: 'Enter your MFA code'
            })
         }

         const token = signDoctorToken(doctor)
         await logAudit({
            action: 'login_success',
            actorUserId: doctor._id,
            actorRole: 'doctor',
            status: 'success',
            entityType: 'doctor',
            entityId: doctor._id,
            metadata: {
               username: doctor.name,
               loginId: doctor.email,
               email: doctor.email
            },
            req
         })
         res.json({success: true, token})
      } else {
         await logAudit({
            action: 'login_failed',
            actorUserId: doctor._id,
            actorRole: 'doctor',
            status: 'failed',
            reason: 'Invalid doctor credentials',
            entityType: 'doctor',
            entityId: doctor._id,
            metadata: { email },
            req
         })
         res.json({success: false, message: 'Invalid credentials'})
      }
   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
} 

const verifyDoctorMfaLogin = async (req, res) => {
   try {
      const { mfaToken, code } = req.body
      const doctor = await getDoctorFromMfaToken(mfaToken)
      if (!doctor || !doctor.mfa?.secret || !doctor.mfa?.enabled) {
         return res.json({ success: false, message: 'Invalid MFA session' })
      }

      if (!verifyTotpCode(doctor.mfa.secret, code)) {
         await logAudit({
            action: 'mfa_login_failed',
            actorUserId: doctor._id,
            actorRole: 'doctor',
            status: 'failed',
            reason: 'Invalid MFA code',
            entityType: 'doctor',
            entityId: doctor._id,
            req
         })
         return res.json({ success: false, message: 'Invalid MFA code' })
      }

      const token = signDoctorToken(doctor)
      await logAudit({
         action: 'login_success',
         actorUserId: doctor._id,
         actorRole: 'doctor',
         status: 'success',
         entityType: 'doctor',
         entityId: doctor._id,
         metadata: { username: doctor.name, loginId: doctor.email, mfa: true },
         req
      })

      res.json({ success: true, token })
   } catch (error) {
      console.log(error)
      res.json({ success: false, message: 'MFA session expired. Please sign in again.' })
   }
}

const completeDoctorMfaLoginSetup = async (req, res) => {
   try {
      const { mfaToken, code } = req.body
      const doctor = await getDoctorFromMfaToken(mfaToken, 'doctor-mfa-setup')
      if (!doctor || !doctor.mfa?.secret) {
         return res.json({ success: false, message: 'Invalid MFA setup session' })
      }

      if (!verifyTotpCode(doctor.mfa.secret, code)) {
         return res.json({ success: false, message: 'Invalid MFA code' })
      }

      await doctorModel.findByIdAndUpdate(doctor._id, {
         'mfa.enabled': true,
         'mfa.configuredAt': Date.now()
      })

      const token = signDoctorToken(doctor)
      await logAudit({
         action: 'mfa_enable',
         actorUserId: doctor._id,
         actorRole: 'doctor',
         status: 'success',
         entityType: 'doctor',
         entityId: doctor._id,
         metadata: { source: 'required_login_setup' },
         req
      })

      res.json({ success: true, token, message: 'MFA configured successfully' })
   } catch (error) {
      console.log(error)
      res.json({ success: false, message: 'MFA setup session expired. Please sign in again.' })
   }
}

const getDoctorMfaStatus = async (req, res) => {
   try {
      const docId = req.doctor.docId
      const doctor = await doctorModel.findById(docId).select('email mfa')
      const security = await getSecuritySettings()
      res.json({
         success: true,
         mfa: {
            enabled: Boolean(doctor?.mfa?.enabled),
            required: isMfaRequiredForProfile(security, 'doctor', doctor),
            requiredByAdmin: Boolean(doctor?.mfa?.requiredByAdmin),
            canSelfManage: security.mfaAllowUserOptIn !== false
         }
      })
   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

const startDoctorMfaSetup = async (req, res) => {
   try {
      const docId = req.doctor.docId
      const doctor = await doctorModel.findById(docId).select('email mfa')
      const security = await getSecuritySettings()
      if (!isMfaRequiredForProfile(security, 'doctor', doctor) && security.mfaAllowUserOptIn === false) {
         return res.json({ success: false, message: 'Self-service MFA is disabled by admin' })
      }

      const secret = generateMfaSecret()
      await doctorModel.findByIdAndUpdate(docId, { 'mfa.secret': secret, 'mfa.enabled': false })
      res.json({ success: true, setup: buildMfaSetupPayload({ secret, accountName: doctor.email }) })
   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

const enableDoctorMfa = async (req, res) => {
   try {
      const docId = req.doctor.docId
      const { code } = req.body
      const doctor = await doctorModel.findById(docId).select('mfa')
      if (!doctor?.mfa?.secret) return res.json({ success: false, message: 'Start MFA setup first' })
      if (!verifyTotpCode(doctor.mfa.secret, code)) return res.json({ success: false, message: 'Invalid MFA code' })

      await doctorModel.findByIdAndUpdate(docId, { 'mfa.enabled': true, 'mfa.configuredAt': Date.now() })
      await logAudit({
         action: 'mfa_enable',
         status: 'success',
         actorUserId: docId,
         actorRole: 'doctor',
         entityType: 'doctor',
         entityId: docId,
         req
      })
      res.json({ success: true, message: 'MFA enabled' })
   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

const disableDoctorMfa = async (req, res) => {
   try {
      const docId = req.doctor.docId
      const { code } = req.body
      const doctor = await doctorModel.findById(docId).select('mfa')
      const security = await getSecuritySettings()
      if (isMfaRequiredForProfile(security, 'doctor', doctor)) {
         return res.json({ success: false, message: 'MFA is required by policy and cannot be disabled' })
      }
      if (doctor?.mfa?.secret && !verifyTotpCode(doctor.mfa.secret, code)) {
         return res.json({ success: false, message: 'Invalid MFA code' })
      }

      await doctorModel.findByIdAndUpdate(docId, { 'mfa.enabled': false, 'mfa.secret': '', 'mfa.resetAt': Date.now() })
      await logAudit({
         action: 'mfa_disable',
         status: 'success',
         actorUserId: docId,
         actorRole: 'doctor',
         entityType: 'doctor',
         entityId: docId,
         req
      })
      res.json({ success: true, message: 'MFA disabled' })
   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}



// APi to get doctor appointments for doctor panel
const appointmentsDoctor = async (req,res) => {
   try {
      const docId = req.doctor.docId;
      const appointments = normalizeAppointmentTeleconsultationLinks(await appointmentModel.find({ docId }))

      res.json({success: true, appointments})

   } catch (error) {
      console.log(error)
      res.json({success:false, message:error.message})
   }
}



// API to mark appointment completed and save prescription for doctor panel
const appointmentComplete = async (req,res) => {
   try {
      
      const { appointmentId, diagnosis, symptoms, medicines, medicationItems, instructions, nextVisit, labTests, documentation } = req.body
      const docId = req.doctor.docId
      const normalizedMedicationItems = Array.isArray(medicationItems)
         ? medicationItems
            .map((item) => ({
               name: String(item?.name || '').trim(),
               dosage: String(item?.dosage || '').trim(),
               frequency: String(item?.frequency || '').trim(),
               duration: String(item?.duration || '').trim(),
               instructions: String(item?.instructions || '').trim()
            }))
            .filter((item) => item.name || item.dosage || item.frequency || item.duration || item.instructions)
         : []
      const medicinesText = medicines || normalizedMedicationItems
         .map((item) => `${item.name} - ${item.dosage} - ${item.frequency} - ${item.duration}${item.instructions ? ` - ${item.instructions}` : ''}`)
         .join('\n')
      
      // Validation - Required fields check (labTests aur notes optional hain)
      if (!appointmentId || !diagnosis || !symptoms || normalizedMedicationItems.length === 0 || !instructions || !nextVisit || !documentation) {
         await logAudit({
            action: 'prescription_create',
            status: 'failed',
            reason: 'Missing required prescription fields',
            entityType: 'appointment',
            entityId: appointmentId || '',
            metadata: { changedFields: ['diagnosis', 'symptoms', 'medicines', 'instructions', 'nextVisit', 'labTests', 'documentation'] },
            req
         })
         return res.json({
            success: false, 
            message: 'Please fill all required fields'
         })
      }

      const incompleteMedication = normalizedMedicationItems.some((item) => !item.name || !item.dosage || !item.frequency || !item.duration)
      if (incompleteMedication) {
         return res.json({ success: false, message: 'Please complete all medication item fields' })
      }

      const appointmentData = await appointmentModel.findById(appointmentId)

      // Check if appointment exists
      if (!appointmentData) {
         await logAudit({
            action: 'prescription_create',
            status: 'failed',
            reason: 'Appointment not found',
            entityType: 'appointment',
            entityId: appointmentId,
            metadata: { changedFields: ['diagnosis', 'symptoms', 'medicines', 'instructions', 'nextVisit', 'labTests', 'documentation'] },
            req
         })
         return res.json({success: false, message: 'Appointment not found'})
      }

      // Check if appointment belongs to this doctor
      if (appointmentData.docId !== docId) {
         await logAudit({
            action: 'prescription_create',
            status: 'failed',
            reason: 'Doctor attempted to complete another doctor appointment',
            targetUserId: appointmentData.userId,
            entityType: 'appointment',
            entityId: appointmentId,
            metadata: { patientId: appointmentData.userId, doctorId: docId, appointmentDoctorId: appointmentData.docId },
            req
         })
         return res.json({success: false, message: 'Unauthorized access'})
      }

      // Check if already completed with prescription
      const existingPrescription = await prescriptionModel.findOne({ appointmentId })
      if (existingPrescription) {
         await logAudit({
            action: 'prescription_create',
            status: 'failed',
            reason: 'Prescription already exists for appointment',
            targetUserId: appointmentData.userId,
            entityType: 'prescription',
            entityId: existingPrescription._id,
            metadata: { appointmentId, patientId: appointmentData.userId, doctorId: docId },
            req
         })
         return res.json({success: false, message: 'Prescription already exists for this appointment'})
      }

      // Prescription save karo with complete data
      const prescription = new prescriptionModel({
         appointmentId,
         reservationNumber: appointmentData.reservationNumber || '',
         userId: appointmentData.userId,
         docId,
         userData: appointmentData.userData,    // Patient details
         docData: appointmentData.docData,      // Doctor details
         slotDate: appointmentData.slotDate,    // Appointment date
         slotTime: appointmentData.slotTime,    // Appointment time
         amount: appointmentData.amount,        // Fees
         diagnosis,
         symptoms,
         medicines: medicinesText,
         medicationItems: normalizedMedicationItems,
         instructions,
         nextVisit,
         labTests,              
         documentation,                    
         isEdited: false,
         editHistory: []
      })

      await prescription.save()

      // Appointment complete karo
      await appointmentModel.findByIdAndUpdate(appointmentId, {isCompleted: true, appointmentStatus: 'Finished', statusUpdatedAt: Date.now()})

      await logAudit({
         action: 'prescription_create',
         status: 'success',
         targetUserId: appointmentData.userId,
         entityType: 'prescription',
         entityId: prescription._id,
         metadata: {
            appointmentId,
            patientId: appointmentData.userId,
            doctorId: docId,
            changedFields: ['diagnosis', 'symptoms', 'medicines', 'instructions', 'nextVisit', 'labTests', 'documentation']
         },
         req
      })

      const finishedAppointment = { ...appointmentData.toObject(), isCompleted: true, appointmentStatus: 'Finished', statusUpdatedAt: Date.now() }
      notifyVisitCompletedWithPrescription({ appointment: finishedAppointment })
      
      return res.json({
         success: true, 
         message: 'Appointment completed',
         prescriptionId: prescription._id
      })

   } catch (error) {
      console.log(error)
      res.json({success: false, message: error.message})
   }
}


// API to cancel appointment completed for doctor panel
const appointmentCancel = async (req,res) => {
   try {
      const { appointmentId } = req.body
      const docId = req.doctor.docId
      
      const appointmentData = await appointmentModel.findById(appointmentId)

      if(appointmentData && appointmentData.docId === docId) {
         
        await appointmentModel.findByIdAndUpdate(appointmentId, {cancelled: true, appointmentStatus: 'Cancelled', statusUpdatedAt: Date.now()})
        const bookedSlotsField = getBookedSlotsField(appointmentData.appointmentType)
        await doctorModel.findByIdAndUpdate(docId, { $pull: { [`${bookedSlotsField}.${appointmentData.slotDate}`]: appointmentData.slotTime } })
        await logAudit({
         action: 'appointment_cancel',
         status: 'success',
         targetUserId: appointmentData.userId,
         entityType: 'appointment',
         entityId: appointmentId,
         metadata: {
            cancelledBy: 'doctor',
            patientId: appointmentData.userId,
            doctorId: docId,
            slotDate: appointmentData.slotDate,
            slotTime: appointmentData.slotTime
         },
         req
        })
        notifyAppointmentCancelled({ appointment: appointmentData, cancelledBy: 'doctor' })
        return res.json({success: true, message:'Appointment Cancelled'})

      } else {
         return res.json({success: false, message:'cancellation failed'})
      }

   } catch (error) {
      console.log(error)
      res.json({success: false, message: error.message})
   }
}





// API to get doctor patient history for doctor panel
const patienthistory = async (req,res) => {
   try {
      const docId = req.doctor.docId;
      const history = await prescriptionModel.find({ docId }).lean()
      const userIds = [...new Set(history.map((item) => item.userId).filter(Boolean))]
      const users = await userModel.find({ _id: { $in: userIds } }).select('medicalHistory insurance').lean()
      const historyByUser = users.reduce((acc, user) => {
         acc[user._id.toString()] = {
            medicalHistory: user.medicalHistory || {},
            insurance: user.insurance || {}
         }
         return acc
      }, {})
      history.forEach((item) => {
         item.patientMedicalHistory = historyByUser[item.userId]?.medicalHistory || {}
         item.patientInsurance = historyByUser[item.userId]?.insurance || item.userData?.insurance || {}
      })
      res.json({success: true, history})  

   } catch (error) {
      console.log(error)
      res.json({success:false, message:error.message})
   }
}




const editPrescription = async (req, res) => {
   try {
      const docId = req.doctor.docId;
      const { prescriptionId, updatedFields } = req.body;

      if (!prescriptionId || !updatedFields) {
         await logAudit({
            action: 'prescription_update',
            status: 'failed',
            reason: 'Missing prescription update data',
            entityType: 'prescription',
            entityId: prescriptionId || '',
            req
         })
         return res.json({ success: false, message: 'Missing data' });
      }

      const prescription = await prescriptionModel.findOne({ 
         _id: prescriptionId,
         docId: docId
      });

      if (!prescription) {
         await logAudit({
            action: 'prescription_update',
            status: 'failed',
            reason: 'Prescription not found or not assigned to doctor',
            entityType: 'prescription',
            entityId: prescriptionId,
            metadata: { doctorId: docId },
            req
         })
         return res.json({ success: false, message: 'Prescription not found' });
      }

      // Check if already edited
      if (prescription.isEdited) {
         await logAudit({
            action: 'prescription_update',
            status: 'failed',
            reason: 'Prescription already edited once',
            targetUserId: prescription.userId,
            entityType: 'prescription',
            entityId: prescriptionId,
            metadata: { patientId: prescription.userId, doctorId: docId },
            req
         })
         return res.json({ success: false, message: 'Already edited once' });
      }

      // 24-hour check
      const hoursPassed = (Date.now() - new Date(prescription.createdAt)) / (1000 * 60 * 60);
      if (hoursPassed > 24) {
         await logAudit({
            action: 'prescription_update',
            status: 'failed',
            reason: 'Prescription edit window expired',
            targetUserId: prescription.userId,
            entityType: 'prescription',
            entityId: prescriptionId,
            metadata: { patientId: prescription.userId, doctorId: docId },
            req
         })
         return res.json({ success: false, message: 'Cannot edit after 24 hours' });
      }

      const allowed = ['diagnosis', 'symptoms', 'medicines', 'medicationItems', 'instructions', 'nextVisit', 'labTests', 'documentation'];
      const changes = {};
      const updateData = {};

      allowed.forEach(field => {
         const newValue = updatedFields[field];
         const oldValue = prescription[field] || '';
         
         const oldComparable = field === 'medicationItems' ? JSON.stringify(oldValue || []) : oldValue
         const newComparable = field === 'medicationItems' ? JSON.stringify(newValue || []) : newValue

         if (newValue !== undefined && oldComparable !== newComparable) {
            changes[field] = { old: oldValue, new: newValue };
            updateData[field] = newValue;
         }
      });

      if (updateData.medicationItems) {
         const normalizedMedicationItems = Array.isArray(updateData.medicationItems)
            ? updateData.medicationItems
               .map((item) => ({
                  name: String(item?.name || '').trim(),
                  dosage: String(item?.dosage || '').trim(),
                  frequency: String(item?.frequency || '').trim(),
                  duration: String(item?.duration || '').trim(),
                  instructions: String(item?.instructions || '').trim()
               }))
               .filter((item) => item.name || item.dosage || item.frequency || item.duration || item.instructions)
            : []

         if (normalizedMedicationItems.length === 0 || normalizedMedicationItems.some((item) => !item.name || !item.dosage || !item.frequency || !item.duration)) {
            return res.json({ success: false, message: 'Please complete all medication item fields' })
         }

         updateData.medicationItems = normalizedMedicationItems
         updateData.medicines = normalizedMedicationItems
            .map((item) => `${item.name} - ${item.dosage} - ${item.frequency} - ${item.duration}${item.instructions ? ` - ${item.instructions}` : ''}`)
            .join('\n')
      }

      if (Object.keys(changes).length === 0) {
         await logAudit({
            action: 'prescription_update',
            status: 'failed',
            reason: 'No changes detected',
            targetUserId: prescription.userId,
            entityType: 'prescription',
            entityId: prescriptionId,
            metadata: { patientId: prescription.userId, doctorId: docId },
            req
         })
         return res.json({ success: false, message: 'No changes detected' });
      }

      await prescriptionModel.findByIdAndUpdate(prescriptionId, {
         ...updateData,
         isEdited: true,
         $push: { 
            editHistory: { 
               changedFields: changes, 
               editedAt: Date.now(), 
               editedBy: docId
            } 
         }
      });

      await logAudit({
         action: 'prescription_update',
         status: 'success',
         targetUserId: prescription.userId,
         entityType: 'prescription',
         entityId: prescriptionId,
         metadata: {
            patientId: prescription.userId,
            doctorId: docId,
            changedFields: Object.keys(changes)
         },
         req
      })

      res.json({ success: true, message: 'Updated successfully' });
   } catch (error) {
      console.log(error);
      res.json({ success: false, message: error.message });
   }
};




// API to get dashboard data for doctor panel
const doctordashboard = async (req,res) => {
    try {
      const { docId } = req.doctor

      const appointments = await appointmentModel.find({ docId }).lean()

      const today = new Date()
      const todaySlotDate = `${today.getDate()}_${today.getMonth() + 1}_${today.getFullYear()}`

      let earnings = 0
      let pendingCount = 0
      let completedCount = 0
      let cancelledCount = 0
      let todayActiveCount = 0

      const patientIds = new Set()

      for (const item of appointments) {
        patientIds.add(item.userId)
        if (item.isCompleted || item.payment) {
          earnings += Number(item.amount) || 0
        }
        if (item.cancelled) {
          cancelledCount += 1
        } else if (item.isCompleted) {
          completedCount += 1
        } else {
          pendingCount += 1
        }
        if (!item.cancelled && item.slotDate === todaySlotDate) {
          todayActiveCount += 1
        }
      }

      const latestAppointments = [...appointments]
        .sort((a, b) => (Number(b.date) || 0) - (Number(a.date) || 0))
        .slice(0, 8)

      const dashData = {
         earnings,
         appointments: appointments.length,
         patients: patientIds.size,
         pendingCount,
         completedCount,
         cancelledCount,
         todayActiveCount,
         latestAppointments
      }
      res.json({success: true, dashData})

    } catch (error) {
      console.log(error)
      res.json({success: false, message: error.message})
    }
}



// API to get doctor profile for Doctor Panel
const doctorProfile = async (req,res) => {
   try {      
    const { docId } = req.doctor
    const profileData = await doctorModel.findById(docId).select('-password').lean()
    const [profileDataWithRatings] = await attachRatingSummariesToDoctors(profileData ? [profileData] : [])

    res.json({ success: true, profileData: profileDataWithRatings })

   } catch (error) {
      console.log(error)
      res.json({success: false, message: error.message})
   }
}



// API to update doctor profile data from Doctor panel
const updateDoctorprofile = async (req,res) => {
  try {
   const { docId } = req.doctor; 
   const {
      address,
      available,
      schedule,
      locationSchedules,
      homeVisitSchedule,
      homeVisitAreas,
      locations,
      gender,
      title,
      acceptsVoiceCall,
      acceptsVideoCall,
      experience,
      about
   } = req.body;
   const updateData = {}

   const baseline = await doctorModel.findById(docId).select('locations schedule locationSchedules homeVisitSchedule homeVisitAreas').lean()
   if (!baseline) {
      return res.json({ success: false, message: 'Doctor not found' })
   }

   if (address !== undefined) updateData.address = address
   if (available !== undefined) updateData.available = parseBoolean(available, true)
   if (locations !== undefined) updateData.locations = normalizeDoctorLocations(locations)
   if (gender !== undefined) updateData.gender = normalizeDoctorGender(gender)
   if (title !== undefined) updateData.title = normalizeDoctorTitle(title)
   if (acceptsVoiceCall !== undefined) updateData.acceptsVoiceCall = parseBoolean(acceptsVoiceCall, true)
   if (acceptsVideoCall !== undefined) updateData.acceptsVideoCall = parseBoolean(acceptsVideoCall, true)

   if (experience !== undefined) {
      const normalized = normalizeExperienceForStorage(experience)
      if (!normalized) {
         return res.json({ success: false, message: 'Enter a valid number of years of experience (0–100)' })
      }
      updateData.experience = normalized
   }

   if (about !== undefined) {
      const trimmedAbout = String(about || '').trim()
      if (!trimmedAbout) {
         return res.json({ success: false, message: 'About section cannot be empty' })
      }
      updateData.about = trimmedAbout
   }

   if (schedule) {
      updateData.schedule = sanitizeSchedule(schedule)
   }

   if (locationSchedules !== undefined) {
      const nextLocations = updateData.locations || baseline.locations || []
      const normalizedBranchSchedules = normalizeLocationSchedules(
        locationSchedules,
        nextLocations,
        updateData.schedule || baseline.schedule || {}
      )
      updateData.locationSchedules = Object.fromEntries(
        Object.entries(normalizedBranchSchedules).filter(
          ([, branchSchedule]) => Array.isArray(branchSchedule?.workingDays) && branchSchedule.workingDays.length > 0
        )
      )
   }

   if (homeVisitSchedule) {
      updateData.homeVisitSchedule = sanitizeSchedule(homeVisitSchedule, { defaultWorkingDays: [], defaultSlotDuration: 60 })
   }

   if (homeVisitAreas !== undefined) {
      updateData.homeVisitAreas = normalizeDoctorHomeVisitAreas(homeVisitAreas)
   }

   const touchesHomeVisit =
      homeVisitSchedule !== undefined ||
      homeVisitAreas !== undefined

   if (touchesHomeVisit) {
      const nextHomeSchedule = updateData.homeVisitSchedule !== undefined
         ? updateData.homeVisitSchedule
         : baseline.homeVisitSchedule
      const nextHomeAreas = updateData.homeVisitAreas !== undefined
         ? updateData.homeVisitAreas
         : normalizeDoctorHomeVisitAreas(baseline.homeVisitAreas)
      if (
         Array.isArray(nextHomeSchedule?.workingDays) &&
         nextHomeSchedule.workingDays.length > 0 &&
         nextHomeAreas.length === 0
      ) {
         return res.json({
            success: false,
            message: 'Select at least one home visit area when home visit availability is enabled'
         })
      }
   }

   const touchesSchedule =
      schedule !== undefined ||
      locationSchedules !== undefined ||
      homeVisitSchedule !== undefined ||
      locations !== undefined

   if (touchesSchedule) {
      const nextSchedule = updateData.schedule !== undefined ? updateData.schedule : baseline.schedule
      const nextLocs = updateData.locations !== undefined ? updateData.locations : (baseline.locations || [])
      const nextLocationSchedules = locationSchedules !== undefined
         ? updateData.locationSchedules
         : Object.fromEntries(Object.entries(baseline.locationSchedules || {}).filter(([key]) => nextLocs.includes(key)))
      const nextHome = updateData.homeVisitSchedule !== undefined ? updateData.homeVisitSchedule : baseline.homeVisitSchedule

      const overlap = validateDoctorNoScheduleOverlap({
         ...baseline,
         schedule: nextSchedule,
         locations: nextLocs,
         locationSchedules: nextLocationSchedules,
         homeVisitSchedule: nextHome
      })
      if (overlap) {
         return res.json({ success: false, message: overlap })
      }
   }

   const mergedForPublish = {
      ...baseline,
      ...updateData,
      schedule: updateData.schedule ?? baseline.schedule,
      locationSchedules: updateData.locationSchedules ?? baseline.locationSchedules,
      homeVisitSchedule: updateData.homeVisitSchedule ?? baseline.homeVisitSchedule
   }
   if (hasDoctorPublishedSchedule(mergedForPublish)) {
      updateData.available = true
   }

   await doctorModel.findByIdAndUpdate(docId, updateData)

   res.json({ success: true, message: 'Profile Updated'})

  } catch (error) {
   console.log(error)
   res.json({success: false, message: error.message})
  }

}

const updatePatientMedicalHistory = async (req, res) => {
   try {
      const docId = req.doctor.docId
      const { patientId, medicalHistory } = req.body

      if (!patientId || !medicalHistory) {
         return res.json({ success: false, message: 'Patient and medical history are required' })
      }

      const hasRelationship = await appointmentModel.exists({ docId, userId: patientId })
      if (!hasRelationship) {
         return res.json({ success: false, message: 'Patient is not assigned to this doctor' })
      }

      const allowed = ['conditions', 'allergies', 'surgeries', 'familyHistory', 'socialHistory', 'notes']
      const nextHistory = allowed.reduce((acc, field) => {
         acc[field] = String(medicalHistory[field] || '').trim()
         return acc
      }, {})

      nextHistory.updatedAt = Date.now()
      nextHistory.updatedBy = docId

      await userModel.findByIdAndUpdate(patientId, { medicalHistory: nextHistory })

      await logAudit({
         action: 'medical_history_update',
         status: 'success',
         targetUserId: patientId,
         entityType: 'user',
         entityId: patientId,
         metadata: { doctorId: docId, changedFields: allowed },
         req
      })

      res.json({ success: true, message: 'Patient medical history updated', medicalHistory: nextHistory })
   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

const updateAppointmentHomeVisitAddress = async (req, res) => {
   try {
      const docId = req.doctor?.docId || req.user?.docId || req.user?.userId
      const { appointmentId } = req.body
      const homeVisitAddress = normalizeHomeVisitAddress(req.body.homeVisitAddress || {})

      if (!appointmentId) {
         return res.json({ success: false, message: 'Appointment is required' })
      }

      const appointment = await appointmentModel.findById(appointmentId)
      if (!appointment || appointment.docId !== docId) {
         return res.json({ success: false, message: 'Appointment not found' })
      }
      if (appointment.appointmentType !== 'Home Visit') {
         return res.json({ success: false, message: 'Only home visit appointments have a visit address' })
      }

      const addressError = validateHomeVisitAddress(homeVisitAddress, appointment.docData)
      if (addressError) {
         return res.json({ success: false, message: addressError })
      }

      const updatedAddress = { ...homeVisitAddress, updatedBy: 'Doctor', updatedAt: Date.now() }
      await appointmentModel.findByIdAndUpdate(appointmentId, { homeVisitAddress: updatedAddress })

      await logAudit({
         action: 'home_visit_address_update',
         status: 'success',
         targetUserId: appointment.userId,
         entityType: 'appointment',
         entityId: appointmentId,
         metadata: { doctorId: docId, area: updatedAddress.area },
         req
      })

      res.json({ success: true, message: 'Home visit address updated', homeVisitAddress: updatedAddress })
   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}


export { changeAvailability, doctorList, loginDoctor, verifyDoctorMfaLogin, completeDoctorMfaLoginSetup, getDoctorMfaStatus, startDoctorMfaSetup, enableDoctorMfa, disableDoctorMfa, appointmentsDoctor, appointmentComplete, appointmentCancel, doctordashboard, doctorProfile, updateDoctorprofile, patienthistory, editPrescription, updatePatientMedicalHistory, updateAppointmentHomeVisitAddress}
