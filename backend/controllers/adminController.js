import validator from 'validator'
import bcrypt from 'bcryptjs'
import { v2 as cloudinary } from 'cloudinary'
import doctorModel from '../models/doctorModel.js'
import jwt from 'jsonwebtoken'
import appointmentModel from '../models/appointmentModel.js'
import userModel from '../models/userModel.js'
import prescriptionModel from '../models/prescriptionModel.js'
import receptionistModel from '../models/receptionistModel.js'
import clinicModel from '../models/clinicModel.js'
import siteSettingModel from '../models/siteSettingModel.js'
import { addReceptionist, allReceptionists, changeReceptionistStatus } from './receptionistController.js'
import { createJwtPayload } from '../middlewares/rbac.js'
import { logAudit } from '../services/auditService.js'
import { refundAppointmentPayment } from './paymentController.js'
import { attachRatingSummariesToDoctors } from './ratingController.js'
import { getBookedSlotsField, sanitizeSchedule, validateDoctorNoScheduleOverlap } from '../services/scheduleService.js'
import { describeCompensationAttribution, normalizeFinancialCompensation } from '../services/financialCompensationService.js'
import { getNextPatientId, isPastDate } from './userController.js'
import { getSecuritySettings, isMfaRequiredForProfile, validatePasswordAgainstPolicy } from '../services/securityPolicyService.js'
import { buildMfaSetupPayload, generateMfaSecret, verifyTotpCode } from '../services/mfaService.js'
import { normalizeAppointmentTeleconsultationLinks } from '../services/appointmentModeService.js'
import { normalizeEmergencyContact, normalizeReceptionistAddress } from '../services/receptionistProfileFields.js'
import {
  notifyAppointmentCancelled,
  notifyPatientAccountStatus,
  notifyProfileUpdatedByAdmin
} from '../services/notificationService.js'
import { adminEmailsMatch, emailExists, findOneByEmail, normalizeEmail } from '../utils/emailUtils.js'
import { normalizeExperienceForStorage } from '../utils/doctorExperience.js'
import { markStaffCreatedAccountVerified } from '../services/accountVerificationService.js'
import { resolveClinicIdsForDoctor } from '../utils/doctorClinicLink.js'
import {
  buildAdminProfileResponse,
  parseAdminProfileUpdate,
  patchAdminProfile
} from '../services/adminProfileService.js'

const SETTING_KEY = 'site-settings'
const ADMIN_MFA_TOKEN_EXPIRES_IN = '10m'
const signAdminToken = (email) => jwt.sign(createJwtPayload({ id: email, role: 'admin', email }), process.env.JWT_SECRET)
const signAdminMfaToken = (purpose = 'admin-mfa') => jwt.sign({ id: process.env.ADMIN_EMAIL, role: 'admin', purpose, email: process.env.ADMIN_EMAIL }, process.env.JWT_SECRET, { expiresIn: ADMIN_MFA_TOKEN_EXPIRES_IN })

const normalizeClinicIds = (clinicIds) => {
  if (!clinicIds) return []
  if (Array.isArray(clinicIds)) return clinicIds.filter(Boolean)

  try {
    const parsed = JSON.parse(clinicIds)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
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

const parseSlotDate = (slotDate) => {
  if (!slotDate || typeof slotDate !== 'string') return null
  const [day, month, year] = slotDate.split('_').map(Number)
  if (!day || !month || !year) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatMonthKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const getWeekStartKey = (date) => {
  const weekStart = new Date(date)
  const day = weekStart.getDay()
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
  weekStart.setDate(diff)
  return formatDateKey(weekStart)
}

const incrementTrend = (map, key) => {
  if (!key) return
  map.set(key, (map.get(key) || 0) + 1)
}

const mapToSeries = (map, limit = 12) => Array.from(map.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .slice(-limit)
  .map(([label, count]) => ({ label, count }))


// API for adding doctor
const addDoctor = async (req,res) => {
   try {
    
    const { name, email, password, phone, speciality, degree, experience, about, fees, address } = req.body
    const clinicIds = normalizeClinicIds(req.body.clinicIds)
    const locations = normalizeDoctorLocations(req.body.locations)
    // New doctors start unpublished: patients see "Coming soon" until the doctor sets availability.
    const baseSchedule = sanitizeSchedule({}, { defaultWorkingDays: [] })
    const locationSchedules = {}
    const homeVisitScheduleForValidate = sanitizeSchedule({}, { defaultWorkingDays: [], defaultSlotDuration: 60 })

    const overlap = validateDoctorNoScheduleOverlap({
      schedule: baseSchedule,
      locations,
      locationSchedules,
      homeVisitSchedule: homeVisitScheduleForValidate
    })
    if (overlap) {
      return res.json({ success: false, message: overlap })
    }

    const imageFile = req.file

    // checking for all data to add doctor
    if( !name || !email || !password || !phone || !speciality || !degree || !experience || !about || !address ){
        return res.json({success: false, message: "Missing Details"})
    }

    const normalizedExperience = normalizeExperienceForStorage(experience)
    if (!normalizedExperience) {
        return res.json({ success: false, message: 'Enter a valid number of years of experience (0–100)' })
    }

    // validating email format
    if(!validator.isEmail(email)) {
      return res.json({success: false, message:'please enter a valid email'})
    }

    // validating strong password
    const passwordPolicy = await validatePasswordAgainstPolicy(password)
    if(!passwordPolicy.valid){
       return res.json({success:false, message: passwordPolicy.message})
    }

    const normalizedEmail = normalizeEmail(email)
    const existingDoctor = await findOneByEmail(doctorModel, normalizedEmail)
    if(existingDoctor) {
    return res.json({success: false, message: 'Doctor with this email already exists'}) 
    }

    // hashing doctor password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // upload image to cloudinary
    const imageUpload = await cloudinary.uploader.upload(imageFile.path, {resource_type: 'image'})
    const imageUrl = imageUpload.secure_url
    const resolvedClinicIds = await resolveClinicIdsForDoctor(speciality, clinicIds)

    const doctorData = {
        name,
        email: normalizedEmail,
        image:imageUrl,
        password: hashedPassword,
        phone,
        speciality,
        degree,
        gender: normalizeDoctorGender(req.body.gender),
        title: normalizeDoctorTitle(req.body.title),
        experience: normalizedExperience,
        about,
        fees: fees !== undefined && fees !== null ? String(fees).trim() : '',
        address:JSON.parse(address),
        locations,
        locationSchedules,
        acceptsCash: parseBoolean(req.body.acceptsCash, true),
        acceptsOnlinePayment: parseBoolean(req.body.acceptsOnlinePayment, true),
        acceptsVoiceCall: parseBoolean(req.body.acceptsVoiceCall, true),
        acceptsVideoCall: parseBoolean(req.body.acceptsVideoCall, true),
        available: false,
        promoCode: normalizePromoCode(req.body.promoCode),
        clinics: resolvedClinicIds,
        schedule: baseSchedule,
        locationSchedules,
        homeVisitSchedule: homeVisitScheduleForValidate,
        financialCompensation: normalizeFinancialCompensation(req.body.financialCompensation || {}),
        date:Date.now()
    }

    const newDoctor = new doctorModel(doctorData)
    await newDoctor.save()

    await logAudit({
      action: 'doctor_create',
      status: 'success',
      targetUserId: newDoctor._id,
      entityType: 'doctor',
      entityId: newDoctor._id,
      metadata: {
        doctorName: name,
        doctorEmail: email,
        speciality,
        clinicIds,
        createdByRole: req.user?.role || 'admin'
      },
      req
    })

    res.json({success:true, message: "Doctor Added"})


   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}



// API for admin to update doctor profile
const updateDoctorByAdmin = async (req, res) => {
  try {
    const { docId } = req.body
    const {
      name,
      email,
      phone,
      password, // Password optional hai
      speciality,
      degree,
      experience,
      about,
      fees,
      address,
      locations,
      locationSchedules,
      gender,
      title,
      acceptsCash,
      acceptsOnlinePayment,
      acceptsVoiceCall,
      acceptsVideoCall,
      promoCode,
      financialCompensation,
    } = req.body

    const imageFile = req.file

    if (!docId) {
      return res.json({ success: false, message: 'Doctor ID is required' })
    }

    // Check doctor exists
    const doctor = await doctorModel.findById(docId)
    if (!doctor) {
      return res.json({ success: false, message: 'Doctor not found' })
    }

    // Validate email if provided
    if (email && !validator.isEmail(email)) {
      return res.json({ success: false, message: 'Invalid email format' })
    }

    const normalizedEmail = email ? normalizeEmail(email) : ''
    if (normalizedEmail && normalizedEmail !== normalizeEmail(doctor.email)) {
      if (await emailExists(doctorModel, normalizedEmail, docId)) {
        return res.json({ success: false, message: 'Another doctor with this email already exists' })
      }
    }

    // Password validation ONLY if password is provided and not empty
    if (password && password.trim().length > 0) {
      const passwordPolicy = await validatePasswordAgainstPolicy(password)
      if (!passwordPolicy.valid) return res.json({ success: false, message: passwordPolicy.message })
    }

    let imageUrl = doctor.image

    // Upload new image if provided
    if (imageFile) {
      const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
        resource_type: 'image'
      })
      imageUrl = imageUpload.secure_url
    }

    //  Hash new password ONLY if provided
    let hashedPassword = doctor.password // Keep old password by default
    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10)
      hashedPassword = await bcrypt.hash(password, salt)
    }

    //  Parse address if it's a string
    let addressObj = doctor.address
    if (address) {
      addressObj = typeof address === 'string' ? JSON.parse(address) : address
    }
    const nextLocations = locations ? normalizeDoctorLocations(locations) : doctor.locations
    const nextLocationSchedules = locationSchedules !== undefined
      ? normalizeLocationSchedules(locationSchedules, nextLocations, doctor.schedule || {})
      : Object.entries(doctor.locationSchedules || {}).reduce((acc, [location, schedule]) => {
        if (nextLocations.includes(location)) acc[location] = schedule
        return acc
      }, {})

    let nextExperience = doctor.experience
    if (experience !== undefined && experience !== null && String(experience).trim() !== '') {
      const normalized = normalizeExperienceForStorage(experience)
      if (!normalized) {
        return res.json({ success: false, message: 'Enter a valid number of years of experience (0–100)' })
      }
      nextExperience = normalized
    }

    // Update data
    const updatedData = {
      name: name || doctor.name,
      email: normalizedEmail || doctor.email,
      password: hashedPassword,
      phone: phone || doctor.phone,
      speciality: speciality || doctor.speciality,
      degree: degree || doctor.degree,
      gender: gender !== undefined ? normalizeDoctorGender(gender) : doctor.gender,
      title: title !== undefined ? normalizeDoctorTitle(title) : doctor.title,
      experience: nextExperience,
      about: about || doctor.about,
      fees: fees !== undefined && fees !== null ? String(fees).trim() : doctor.fees,
      address: addressObj,  // Object me save hoga
      locations: nextLocations,
      locationSchedules: nextLocationSchedules,
      acceptsCash: acceptsCash !== undefined ? parseBoolean(acceptsCash, doctor.acceptsCash !== false) : doctor.acceptsCash,
      acceptsOnlinePayment: acceptsOnlinePayment !== undefined ? parseBoolean(acceptsOnlinePayment, doctor.acceptsOnlinePayment !== false) : doctor.acceptsOnlinePayment,
      acceptsVoiceCall: acceptsVoiceCall !== undefined ? parseBoolean(acceptsVoiceCall, doctor.acceptsVoiceCall !== false) : doctor.acceptsVoiceCall,
      acceptsVideoCall: acceptsVideoCall !== undefined ? parseBoolean(acceptsVideoCall, doctor.acceptsVideoCall !== false) : doctor.acceptsVideoCall,
      promoCode: promoCode !== undefined ? normalizePromoCode(promoCode) : doctor.promoCode,
      image: imageUrl
    }

    if (financialCompensation !== undefined && financialCompensation !== null && String(financialCompensation).trim() !== '') {
      try {
        const raw = typeof financialCompensation === 'string' ? JSON.parse(financialCompensation) : financialCompensation
        updatedData.financialCompensation = normalizeFinancialCompensation(raw)
      } catch {
        return res.json({ success: false, message: 'Invalid financial compensation payload' })
      }
    }

    const touchesSchedule = locations !== undefined || locationSchedules !== undefined
    if (touchesSchedule) {
      const overlap = validateDoctorNoScheduleOverlap({
        schedule: doctor.schedule,
        locations: nextLocations,
        locationSchedules: nextLocationSchedules,
        homeVisitSchedule: doctor.homeVisitSchedule
      })
      if (overlap) {
        return res.json({ success: false, message: overlap })
      }
    }

    const nextSpeciality = updatedData.speciality
    const explicitClinicIds = req.body.clinicIds !== undefined
      ? normalizeClinicIds(req.body.clinicIds)
      : (doctor.clinics || []).map((clinic) => String(clinic?._id || clinic)).filter(Boolean)
    updatedData.clinics = await resolveClinicIdsForDoctor(nextSpeciality, explicitClinicIds)

    await doctorModel.findByIdAndUpdate(docId, updatedData)

    await logAudit({
      action: 'doctor_update',
      status: 'success',
      targetUserId: docId,
      entityType: 'doctor',
      entityId: docId,
      metadata: {
        doctorName: updatedData.name,
        changedFields: Object.keys(updatedData).filter(field => field !== 'password')
      },
      req
    })

    notifyProfileUpdatedByAdmin({
      recipientRole: 'doctor',
      recipientId: docId,
      detail: 'An administrator updated your clinic profile or settings.'
    })

    res.json({ success: true, message: 'Doctor profile updated successfully' })

  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}




// API For admin login
const loginAdmin = async (req, res) => {
   try {
    
    const { email, password } = req.body

    if(adminEmailsMatch(email, process.env.ADMIN_EMAIL) && password === process.env.ADMIN_PASSWORD){
    const security = await getSecuritySettings()
    const adminMfaRequired = isMfaRequiredForProfile(security, 'admin', { mfa: security.adminMfa })
    const hasConfiguredMfa = Boolean(security.adminMfa?.enabled && security.adminMfa?.secret)

    if (adminMfaRequired && !hasConfiguredMfa) {
      const secret = generateMfaSecret()
      await siteSettingModel.findOneAndUpdate(
        { key: SETTING_KEY },
        { $set: { 'security.adminMfa.secret': secret, 'security.adminMfa.enabled': false } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      return res.json({
        success: false,
        mfaSetupRequired: true,
        mfaToken: signAdminMfaToken('admin-mfa-setup'),
        setup: buildMfaSetupPayload({ secret, accountName: email }),
        message: 'MFA setup is required before admin login'
      })
    }

    if (adminMfaRequired && hasConfiguredMfa) {
      return res.json({
        success: false,
        mfaRequired: true,
        mfaToken: signAdminMfaToken(),
        message: 'Enter your MFA code'
      })
    }
      
    const token = signAdminToken(email)
    await logAudit({
      action: 'login_success',
      actorUserId: email,
      actorRole: 'admin',
      status: 'success',
      entityType: 'admin',
      entityId: email,
      metadata: {
        username: 'Admin',
        loginId: email,
        email
      },
      req
    })
    res.json({success: true, token})  

    } else {
        await logAudit({
          action: 'login_failed',
          actorRole: 'admin',
          status: 'failed',
          reason: 'Invalid admin credentials',
          entityType: 'admin',
          metadata: { email },
          req
        })
        res.json({success:false, message: 'Invalid credentials'})
    }

   } catch (error) {
    console.log(error)
    res.json({success: false, message:error.message})
   }
}

const verifyAdminMfaLogin = async (req, res) => {
  try {
    const { mfaToken, code } = req.body
    const decoded = jwt.verify(mfaToken, process.env.JWT_SECRET)
    if (decoded?.purpose !== 'admin-mfa' || decoded?.role !== 'admin') {
      return res.json({ success: false, message: 'Invalid MFA session' })
    }

    const security = await getSecuritySettings()
    if (!security.adminMfa?.enabled || !security.adminMfa?.secret || !verifyTotpCode(security.adminMfa.secret, code)) {
      return res.json({ success: false, message: 'Invalid MFA code' })
    }

    res.json({ success: true, token: signAdminToken(process.env.ADMIN_EMAIL) })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: 'MFA session expired. Please sign in again.' })
  }
}

const completeAdminMfaLoginSetup = async (req, res) => {
  try {
    const { mfaToken, code } = req.body
    const decoded = jwt.verify(mfaToken, process.env.JWT_SECRET)
    if (decoded?.purpose !== 'admin-mfa-setup' || decoded?.role !== 'admin') {
      return res.json({ success: false, message: 'Invalid MFA setup session' })
    }

    const security = await getSecuritySettings()
    if (!security.adminMfa?.secret || !verifyTotpCode(security.adminMfa.secret, code)) {
      return res.json({ success: false, message: 'Invalid MFA code' })
    }

    await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { 'security.adminMfa.enabled': true, 'security.adminMfa.configuredAt': Date.now() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    res.json({ success: true, token: signAdminToken(process.env.ADMIN_EMAIL), message: 'Admin MFA configured successfully' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: 'MFA setup session expired. Please sign in again.' })
  }
}

const getAdminAccountEmail = (req) => normalizeEmail(req.user?.email || process.env.ADMIN_EMAIL)

const getAdminProfile = async (req, res) => {
  try {
    const email = getAdminAccountEmail(req)
    const profile = await buildAdminProfileResponse(email)
    res.json({ success: true, profile })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const updateAdminProfile = async (req, res) => {
  try {
    const email = getAdminAccountEmail(req)
    const parsed = parseAdminProfileUpdate(req.body)
    if (parsed.error) {
      return res.json({ success: false, message: parsed.error })
    }

    const patch = { ...parsed.update }
    const imageFile = req.file

    if (imageFile) {
      const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: 'image' })
      patch.image = imageUpload.secure_url
    }

    if (Object.keys(patch).length === 0) {
      return res.json({ success: false, message: 'No changes were provided' })
    }

    await patchAdminProfile(patch)

    await logAudit({
      action: 'admin_profile_update',
      status: 'success',
      actorUserId: email,
      actorRole: 'admin',
      entityType: 'admin',
      entityId: email,
      metadata: { changedFields: Object.keys(patch) },
      req
    })

    const profile = await buildAdminProfileResponse(email)
    res.json({ success: true, message: 'Profile updated successfully', profile })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const getAdminMfaStatus = async (req, res) => {
  try {
    const security = await getSecuritySettings()
    res.json({
      success: true,
      mfa: {
        enabled: Boolean(security.adminMfa?.enabled && security.adminMfa?.secret),
        required: isMfaRequiredForProfile(security, 'admin', { mfa: security.adminMfa }),
        canSelfManage: true
      }
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const startAdminMfaSetup = async (req, res) => {
  try {
    const secret = generateMfaSecret()
    await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { 'security.adminMfa.secret': secret, 'security.adminMfa.enabled': false } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
    res.json({
      success: true,
      setup: buildMfaSetupPayload({ secret, accountName: getAdminAccountEmail(req) })
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const enableAdminMfa = async (req, res) => {
  try {
    const { code } = req.body
    const security = await getSecuritySettings()
    if (!security.adminMfa?.secret) {
      return res.json({ success: false, message: 'Start MFA setup first' })
    }
    if (!verifyTotpCode(security.adminMfa.secret, code)) {
      return res.json({ success: false, message: 'Invalid MFA code' })
    }

    await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { 'security.adminMfa.enabled': true, 'security.adminMfa.configuredAt': Date.now() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    await logAudit({
      action: 'mfa_enable',
      status: 'success',
      actorUserId: getAdminAccountEmail(req),
      actorRole: 'admin',
      entityType: 'admin',
      entityId: getAdminAccountEmail(req),
      req
    })

    res.json({ success: true, message: 'MFA enabled for your admin account' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const disableAdminMfa = async (req, res) => {
  try {
    const { code } = req.body
    const security = await getSecuritySettings()
    if (isMfaRequiredForProfile(security, 'admin', { mfa: security.adminMfa })) {
      return res.json({ success: false, message: 'MFA is required by policy and cannot be disabled' })
    }
    if (security.adminMfa?.secret && !verifyTotpCode(security.adminMfa.secret, code)) {
      return res.json({ success: false, message: 'Invalid MFA code' })
    }

    await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      {
        $set: {
          'security.adminMfa.enabled': false,
          'security.adminMfa.secret': '',
          'security.adminMfa.resetAt': Date.now()
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    await logAudit({
      action: 'mfa_disable',
      status: 'success',
      actorUserId: getAdminAccountEmail(req),
      actorRole: 'admin',
      entityType: 'admin',
      entityId: getAdminAccountEmail(req),
      req
    })

    res.json({ success: true, message: 'MFA disabled for your admin account' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}



// API to get all doctor list for admin panel
const allDoctors = async (req,res) => {
   try {
    const doctors = await doctorModel.find({}).select('-password').populate('clinics')
    const doctorsWithRatings = await attachRatingSummariesToDoctors(doctors)
    res.json({success: true, doctors: doctorsWithRatings})

   } catch (error) {
      console.log(error)
      res.json({success:false, message:error.message})
   }
}

// API to get all patients for admin panel
const allPatients = async (req, res) => {
  try {
    const patients = await userModel.find({}).select('-password -resetOtp -resetOtpExpireAt').sort({ createdAt: -1 }).lean()
    const patientIds = patients.map((patient) => patient._id.toString())

    const appointmentCounts = await appointmentModel.aggregate([
      { $match: { userId: { $in: patientIds } } },
      {
        $group: {
          _id: '$userId',
          appointments: { $sum: 1 },
          paidAppointments: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, 1, 0] }
          },
          revenue: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$amount', 0] }
          },
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
        revenue: statsByPatient[patient._id.toString()]?.revenue || 0,
        lastAppointmentDate: statsByPatient[patient._id.toString()]?.lastAppointmentDate || 0
      }
    }))

    res.json({ success: true, patients: patientsWithStats })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const modelsByUserType = {
  patient: userModel,
  doctor: doctorModel,
  receptionist: receptionistModel
}

const getUserModelByType = (profileType) => modelsByUserType[profileType]

const buildUserAccount = (profileType, item) => ({
  _id: item._id,
  profileId: item._id,
  profileType,
  role: profileType,
  name: item.name || '',
  email: item.email || '',
  phone: item.phone || '',
  image: item.image || '',
  patientId: item.patientId || '',
  speciality: item.speciality || '',
  gender: item.gender || '',
  dob: item.dob || '',
  address: item.address || { line1: '', line2: '' },
  isActive: profileType === 'doctor' ? item.available !== false : item.isActive !== false,
  insurance:
    profileType === 'patient' && item.insurance
      ? {
          enabled: Boolean(item.insurance.enabled),
          provider: String(item.insurance.provider || '').trim(),
          verificationStatus: String(item.insurance.verificationStatus || 'none'),
          declineReason: String(item.insurance.declineReason || '').trim()
        }
      : null,
  mfa: {
    enabled: Boolean(item.mfa?.enabled),
    requiredByAdmin: Boolean(item.mfa?.requiredByAdmin),
    configuredAt: item.mfa?.configuredAt || 0,
    resetAt: item.mfa?.resetAt || 0
  },
  createdAt: item.createdAt || item.date || item._id?.getTimestamp?.() || null
})

const allUsers = async (req, res) => {
  try {
    const [patients, doctors, receptionists] = await Promise.all([
      userModel.find({}).select('-password -resetOtp -resetOtpExpireAt').lean(),
      doctorModel.find({}).select('-password').lean(),
      receptionistModel.find({}).select('-password').lean()
    ])

    const users = [
      ...patients.map((patient) => buildUserAccount('patient', patient)),
      ...doctors.map((doctor) => buildUserAccount('doctor', doctor)),
      ...receptionists.map((receptionist) => buildUserAccount('receptionist', receptionist))
    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

    res.json({ success: true, users })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const updateUserByAdmin = async (req, res) => {
  try {
    const { profileType, profileId } = req.body
    const selectedModel = getUserModelByType(profileType)

    if (!selectedModel || !profileId) {
      return res.json({ success: false, message: 'Valid user type and user ID are required' })
    }

    const profile = await selectedModel.findById(profileId)
    if (!profile) {
      return res.json({ success: false, message: 'User not found' })
    }

    const updateData = {}
    const stringFields = ['name', 'email', 'phone']

    stringFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = String(req.body[field] || '').trim()
    })

    if (updateData.email) {
      updateData.email = normalizeEmail(updateData.email)
      if (!validator.isEmail(updateData.email)) {
        return res.json({ success: false, message: 'Please enter a valid email' })
      }

      if (await emailExists(selectedModel, updateData.email, profileId)) {
        return res.json({ success: false, message: 'Another user with this email already exists' })
      }
    }

    if (profileType === 'patient') {
      if (req.body.gender !== undefined) {
        updateData.gender = ['Male', 'Female'].includes(req.body.gender) ? req.body.gender : 'Not Selected'
      }
      if (req.body.dob !== undefined) updateData.dob = String(req.body.dob || 'Not Selected').trim() || 'Not Selected'
      if (req.body.address !== undefined) {
        updateData.address = typeof req.body.address === 'string' ? JSON.parse(req.body.address) : req.body.address
      }
    }

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === '' && ['name', 'email', 'phone'].includes(key)) delete updateData[key]
    })

    if (Object.keys(updateData).length === 0) {
      return res.json({ success: false, message: 'No changes were provided' })
    }

    await selectedModel.findByIdAndUpdate(profileId, updateData)

    await logAudit({
      action: 'user_update',
      status: 'success',
      targetUserId: profileId,
      entityType: profileType,
      entityId: profileId,
      metadata: {
        profileType,
        changedFields: Object.keys(updateData)
      },
      req
    })

    const roleMap = { patient: 'patient', doctor: 'doctor', receptionist: 'receptionist' }
    const rr = roleMap[profileType]
    if (rr) {
      notifyProfileUpdatedByAdmin({
        recipientRole: rr,
        recipientId: profileId,
        detail: 'An administrator updated your account information.'
      })
    }

    res.json({ success: true, message: 'User information updated successfully' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const resetUserPassword = async (req, res) => {
  try {
    const { profileType, profileId, password } = req.body
    const selectedModel = getUserModelByType(profileType)

    if (!selectedModel || !profileId) {
      return res.json({ success: false, message: 'Valid user type and user ID are required' })
    }

    const passwordPolicy = await validatePasswordAgainstPolicy(password)
    if (!passwordPolicy.valid) {
      return res.json({ success: false, message: passwordPolicy.message })
    }

    const profile = await selectedModel.findById(profileId)
    if (!profile) {
      return res.json({ success: false, message: 'User not found' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    await selectedModel.findByIdAndUpdate(profileId, { password: hashedPassword })

    await logAudit({
      action: 'user_password_reset',
      status: 'success',
      targetUserId: profileId,
      entityType: profileType,
      entityId: profileId,
      metadata: {
        profileType,
        userEmail: profile.email
      },
      req
    })

    res.json({ success: true, message: 'Password reset successfully' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const updateUserMfaRequirement = async (req, res) => {
  try {
    const { profileType, profileId, requiredByAdmin } = req.body
    const selectedModel = getUserModelByType(profileType)

    if (!selectedModel || !profileId) {
      return res.json({ success: false, message: 'Valid user type and user ID are required' })
    }

    const profile = await selectedModel.findById(profileId)
    if (!profile) {
      return res.json({ success: false, message: 'User not found' })
    }

    const nextRequired = requiredByAdmin === true || requiredByAdmin === 'true' || requiredByAdmin === '1'
    await selectedModel.findByIdAndUpdate(profileId, { 'mfa.requiredByAdmin': nextRequired })

    await logAudit({
      action: 'user_mfa_requirement_update',
      status: 'success',
      targetUserId: profileId,
      entityType: profileType,
      entityId: profileId,
      metadata: {
        profileType,
        userEmail: profile.email,
        requiredByAdmin: nextRequired
      },
      req
    })

    res.json({ success: true, message: `MFA ${nextRequired ? 'required' : 'not required'} for this user` })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const resetUserMfa = async (req, res) => {
  try {
    const { profileType, profileId } = req.body
    const selectedModel = getUserModelByType(profileType)

    if (!selectedModel || !profileId) {
      return res.json({ success: false, message: 'Valid user type and user ID are required' })
    }

    const profile = await selectedModel.findById(profileId)
    if (!profile) {
      return res.json({ success: false, message: 'User not found' })
    }

    await selectedModel.findByIdAndUpdate(profileId, {
      'mfa.enabled': false,
      'mfa.secret': '',
      'mfa.configuredAt': 0,
      'mfa.resetAt': Date.now()
    })

    await logAudit({
      action: 'user_mfa_reset',
      status: 'success',
      targetUserId: profileId,
      entityType: profileType,
      entityId: profileId,
      metadata: {
        profileType,
        userEmail: profile.email
      },
      req
    })

    res.json({ success: true, message: 'MFA reset for this user' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const deleteUserAccount = async (req, res) => {
  try {
    const { profileType, profileId } = req.body
    const selectedModel = getUserModelByType(profileType)

    if (!selectedModel || !profileId) {
      return res.json({ success: false, message: 'Valid user type and user ID are required' })
    }

    const deletedProfile = await selectedModel.findByIdAndDelete(profileId)
    if (!deletedProfile) {
      return res.json({ success: false, message: 'User not found' })
    }

    await logAudit({
      action: 'user_delete',
      status: 'success',
      targetUserId: deletedProfile._id,
      entityType: profileType,
      entityId: deletedProfile._id,
      metadata: {
        profileType,
        userEmail: deletedProfile.email,
        userName: deletedProfile.name
      },
      req
    })

    res.json({ success: true, message: 'User deleted permanently' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const createUserByAdmin = async (req, res) => {
  try {
    const body = req.body || {}
    const profileType = body.profileType || 'patient'
    const { name, email, password } = body
    const phone = String(body.phone || '').trim()

    if (!['patient', 'receptionist'].includes(profileType)) {
      return res.json({ success: false, message: 'Use Add Doctor to create doctor accounts' })
    }

    if (!name || !email || !password || !phone) {
      return res.json({ success: false, message: 'Name, email, phone, and password are required' })
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: 'Please enter a valid email' })
    }

    const passwordPolicy = await validatePasswordAgainstPolicy(password)
    if (!passwordPolicy.valid) {
      return res.json({ success: false, message: passwordPolicy.message })
    }

    const selectedModel = getUserModelByType(profileType)
    const normalizedEmail = normalizeEmail(email)
    const existingByEmail = await findOneByEmail(selectedModel, normalizedEmail)
    const existingByPhone = await selectedModel.findOne({ phone })
    if (existingByEmail || existingByPhone) {
      return res.json({ success: false, message: `A ${profileType} with this email or phone already exists` })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const profileData = {
      name: String(name).trim(),
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      ...markStaffCreatedAccountVerified()
    }

    if (profileType === 'patient') {
      const dob = String(body.dob || '').trim()
      if (!dob) {
        return res.json({ success: false, message: 'Birth date is required for patients' })
      }
      if (!isPastDate(dob)) {
        return res.json({ success: false, message: 'Birth date must be in the past' })
      }

      profileData.dob = dob
      profileData.gender = ['Male', 'Female'].includes(body.gender) ? body.gender : 'Not Selected'
      profileData.address = body.address || { line1: '', line2: '' }
      profileData.patientId = await getNextPatientId()
    }

    if (profileType === 'receptionist') {
      profileData.date = Date.now()
    }

    const createdProfile = await new selectedModel(profileData).save()

    await logAudit({
      action: 'user_create',
      status: 'success',
      targetUserId: createdProfile._id,
      entityType: profileType,
      entityId: createdProfile._id,
      metadata: {
        profileType,
        userEmail: createdProfile.email,
        userName: createdProfile.name
      },
      req
    })

    const profileLabel = profileType.charAt(0).toUpperCase() + profileType.slice(1)
    res.json({ success: true, message: `${profileLabel} created successfully`, user: buildUserAccount(profileType, createdProfile.toObject()) })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// API to get one patient with appointments and medical history
const patientDetails = async (req, res) => {
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
      if (appointment.paymentStatus === 'Paid') {
        acc.paidAppointments += 1
        acc.revenue += Number(appointment.amount || 0)
      } else {
        acc.unpaidAppointments += 1
      }
      if (appointment.cancelled || appointment.appointmentStatus === 'Cancelled') acc.cancelledAppointments += 1
      if (appointment.isCompleted || appointment.appointmentStatus === 'Finished') acc.completedAppointments += 1
      return acc
    }, {
      appointments: 0,
      paidAppointments: 0,
      unpaidAppointments: 0,
      cancelledAppointments: 0,
      completedAppointments: 0,
      revenue: 0
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

// API to activate/deactivate patient profile
const changePatientStatus = async (req, res) => {
  try {
    const { patientId } = req.body
    if (!patientId) {
      return res.json({ success: false, message: 'Patient ID is required' })
    }

    const patient = await userModel.findById(patientId)
    if (!patient) {
      return res.json({ success: false, message: 'Patient not found' })
    }

    const nextStatus = patient.isActive === false
    await userModel.findByIdAndUpdate(patientId, {
      isActive: nextStatus,
      deactivatedAt: nextStatus ? 0 : Date.now()
    })

    await logAudit({
      action: 'patient_status_update',
      status: 'success',
      targetUserId: patientId,
      entityType: 'patient',
      entityId: patientId,
      metadata: {
        patientName: patient.name,
        oldValue: { isActive: patient.isActive !== false },
        newValue: { isActive: nextStatus }
      },
      req
    })

    notifyPatientAccountStatus({ patientId, isActive: nextStatus })

    res.json({ success: true, message: `Patient ${nextStatus ? 'activated' : 'deactivated'} successfully` })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// API to permanently delete patient profile
const deletePatientProfile = async (req, res) => {
  try {
    const { patientId } = req.body
    if (!patientId) {
      return res.json({ success: false, message: 'Patient ID is required' })
    }

    const deletedPatient = await userModel.findByIdAndDelete(patientId)
    if (!deletedPatient) {
      return res.json({ success: false, message: 'Patient not found' })
    }

    await logAudit({
      action: 'patient_delete',
      status: 'success',
      targetUserId: deletedPatient._id,
      entityType: 'patient',
      entityId: deletedPatient._id,
      metadata: {
        patientName: deletedPatient.name,
        patientLoginId: deletedPatient.patientId
      },
      req
    })

    res.json({ success: true, message: 'Patient profile deleted successfully' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}


// API to get all appointments list
const appointmentsAdmin = async (req,res) => {
   try {
     const appointments = normalizeAppointmentTeleconsultationLinks(await appointmentModel.find({}))
     res.json({success: true, appointments})

   } catch (error) {
      console.log(error)
      res.json({success: false, message:error.message})
   }
}


// API for appointment cancellation
const appointmentCancel = async (req,res) => {
  try {

   const { appointmentId } = req.body; // ✔ Only appointmentId comes from body

   const appointmentData = await appointmentModel.findById(appointmentId)

   let refundMessage = ''
   if (appointmentData.paymentStatus === 'Paid' && appointmentData.paymentMethod === 'Visa') {
    const refundResult = await refundAppointmentPayment({ appointment: appointmentData, appointmentId, requestedBy: 'admin', req })
    refundMessage = refundResult.refunded ? ' Refund requested.' : ''
   }

   await appointmentModel.findByIdAndUpdate(appointmentId, {cancelled: true, appointmentStatus: 'Cancelled', statusUpdatedAt: Date.now()})

   // releasing doctor slot
   const { docId, slotDate, slotTime } = appointmentData
   
   const doctorData = await doctorModel.findById(docId)

   const bookedSlotsField = getBookedSlotsField(appointmentData.appointmentType)
   let slots_booked = doctorData[bookedSlotsField] || {}

   slots_booked[slotDate] = (slots_booked[slotDate] || []).filter(e => e !== slotTime)

   await doctorModel.findByIdAndUpdate(docId, { [bookedSlotsField]: slots_booked })

   await logAudit({
    action: 'appointment_cancel',
    status: 'success',
    targetUserId: appointmentData.userId,
    entityType: 'appointment',
    entityId: appointmentId,
    metadata: {
      cancelledBy: 'admin',
      patientId: appointmentData.userId,
      doctorId: docId,
      slotDate,
      slotTime
    },
    req
   })

   notifyAppointmentCancelled({ appointment: appointmentData, cancelledBy: 'admin' })

   res.json({success: true, message:`Appointment Cancelled${refundMessage}`})


  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }
}


// API to get all appointment history
const allAppointmentHistory = async (req, res) => {
  try {
    const appointments = await prescriptionModel.find({ });
    res.json({ success: true, appointments });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


// Delete appointment history record
const deleteAppointmentHistory = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    // Check if appointmentId is provided
    if (!appointmentId) {
      return res.json({ success: false, message: 'Appointment ID is required' });
    }

    // Find and delete the prescription/appointment record
    const deletedRecord = await prescriptionModel.findByIdAndDelete(appointmentId);

    if (!deletedRecord) {
      await logAudit({
        action: 'medical_history_delete',
        status: 'failed',
        reason: 'Record not found',
        entityType: 'prescription',
        entityId: appointmentId,
        req
      })
      return res.json({ success: false, message: 'Record not found' });
    }
    await logAudit({
      action: 'medical_history_delete',
      status: 'success',
      targetUserId: deletedRecord.userId,
      entityType: 'prescription',
      entityId: deletedRecord._id,
      metadata: {
        appointmentId: deletedRecord.appointmentId,
        patientId: deletedRecord.userId,
        doctorId: deletedRecord.docId
      },
      req
    })
    res.json({ success: true, message: 'Appointment record deleted successfully' });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const deleteProfile = async (req, res) => {
  try {
    const { profileType, profileId } = req.body

    if (!profileType || !profileId) {
      await logAudit({
        action: 'profile_delete',
        status: 'failed',
        reason: 'Missing profile type or profile ID',
        entityType: profileType || 'profile',
        entityId: profileId || '',
        req
      })
      return res.json({ success: false, message: 'Profile type and profile ID are required' })
    }

    const modelsByProfileType = {
      patient: userModel,
      doctor: doctorModel,
      receptionist: receptionistModel
    }

    const selectedModel = modelsByProfileType[profileType]
    if (!selectedModel) {
      await logAudit({
        action: 'profile_delete',
        status: 'failed',
        reason: 'Invalid profile type',
        entityType: profileType,
        entityId: profileId,
        req
      })
      return res.json({ success: false, message: 'Invalid profile type' })
    }

    const deletedProfile = await selectedModel.findByIdAndDelete(profileId)

    if (!deletedProfile) {
      await logAudit({
        action: 'profile_delete',
        status: 'failed',
        reason: 'Profile not found',
        entityType: profileType,
        entityId: profileId,
        req
      })
      return res.json({ success: false, message: 'Profile not found' })
    }

    await logAudit({
      action: 'profile_delete',
      status: 'success',
      targetUserId: deletedProfile._id,
      entityType: profileType,
      entityId: deletedProfile._id,
      metadata: { profileType },
      req
    })

    res.json({ success: true, message: 'Profile deleted successfully' })
  } catch (error) {
    console.log(error)
    await logAudit({
      action: 'profile_delete',
      status: 'failed',
      reason: error.message,
      entityType: req.body?.profileType || 'profile',
      entityId: req.body?.profileId || '',
      req
    })
    res.json({ success: false, message: error.message })
  }
}




// API to get dashboard data for admin panel
const adminDashboard = async (req,res) => {
   try {
     const doctors = await doctorModel.find({}).populate('clinics').lean()
     const users = await userModel.find({}).select('_id isActive').lean()
     const appointments = await appointmentModel.find({}).sort({ date: -1 }).lean()
     const clinics = await clinicModel.find({}).sort({ name: 1 }).lean()

     const doctorById = doctors.reduce((acc, doctor) => {
      acc[doctor._id.toString()] = doctor
      return acc
     }, {})

     const dailyTrend = new Map()
     const weeklyTrend = new Map()
     const monthlyTrend = new Map()
     const clinicStatsByName = new Map()

     clinics.forEach((clinic) => {
      clinicStatsByName.set(clinic.name, {
        clinicId: clinic._id,
        name: clinic.name,
        doctors: doctors.filter((doctor) =>
          (doctor.clinics || []).some((assignedClinic) => assignedClinic?._id?.toString() === clinic._id.toString())
        ).length,
        appointments: 0,
        revenue: 0,
        paidAppointments: 0,
        unpaidAppointments: 0,
        patients: new Set()
      })
     })

     let revenue = 0
     let paidAppointments = 0
     let unpaidAppointments = 0
     let cancelledAppointments = 0
     let completedAppointments = 0

     appointments.forEach((appointment) => {
      const amount = Number(appointment.amount || 0)
      const isPaid = appointment.paymentStatus === 'Paid'
      const isCancelled = appointment.cancelled || appointment.appointmentStatus === 'Cancelled'

      if (isPaid) {
        revenue += amount
        paidAppointments += 1
      } else if (!isCancelled) {
        unpaidAppointments += 1
      }

      if (isCancelled) cancelledAppointments += 1
      if (appointment.isCompleted || appointment.appointmentStatus === 'Finished') completedAppointments += 1

      const slotDate = parseSlotDate(appointment.slotDate)
      if (slotDate) {
        incrementTrend(dailyTrend, formatDateKey(slotDate))
        incrementTrend(weeklyTrend, getWeekStartKey(slotDate))
        incrementTrend(monthlyTrend, formatMonthKey(slotDate))
      }

      const doctor = doctorById[appointment.docId]
      const assignedClinics = doctor?.clinics?.length ? doctor.clinics : []
      const clinicNames = assignedClinics.length > 0
        ? assignedClinics.map((clinic) => clinic.name).filter(Boolean)
        : [appointment.docData?.speciality || 'Unassigned']

      clinicNames.forEach((clinicName) => {
        if (!clinicStatsByName.has(clinicName)) {
          clinicStatsByName.set(clinicName, {
            clinicId: '',
            name: clinicName,
            doctors: clinicName === 'Unassigned' ? 0 : doctors.filter((item) => item.speciality === clinicName).length,
            appointments: 0,
            revenue: 0,
            paidAppointments: 0,
            unpaidAppointments: 0,
            patients: new Set()
          })
        }

        const clinicStats = clinicStatsByName.get(clinicName)
        clinicStats.appointments += 1
        clinicStats.patients.add(appointment.userId)

        if (isPaid) {
          clinicStats.paidAppointments += 1
          clinicStats.revenue += amount
        } else if (!isCancelled) {
          clinicStats.unpaidAppointments += 1
        }
      })
     })

     const clinicStats = Array.from(clinicStatsByName.values())
      .map((clinic) => ({ ...clinic, patients: clinic.patients.size }))
      .filter((clinic) => clinic.doctors > 0 || clinic.appointments > 0)
      .sort((a, b) => b.appointments - a.appointments)

     const dashData = {
      doctors: doctors.length,
      appointments: appointments.length,
      patients: users.length,
      activePatients: users.filter((user) => user.isActive !== false).length,
      inactivePatients: users.filter((user) => user.isActive === false).length,
      revenue,
      paidAppointments,
      unpaidAppointments,
      cancelledAppointments,
      completedAppointments,
      appointmentTrends: {
        day: mapToSeries(dailyTrend, 14),
        week: mapToSeries(weeklyTrend, 12),
        month: mapToSeries(monthlyTrend, 12)
      },
      clinicStats,
      latestAppointments: appointments.slice(0,5)
     }

     res.json({success: true, dashData})
   } catch (error) {
     console.log(error)
     res.json({success: false, message: error.message}) 
   }

}

const receptionistProfileByAdmin = async (req, res) => {
  try {
    const { receptionistId } = req.params
    const receptionist = await receptionistModel.findById(receptionistId).select('-password -mfa.secret').lean()
    if (!receptionist) {
      return res.json({ success: false, message: 'Receptionist not found' })
    }
    res.json({ success: true, receptionist })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const updateReceptionistByAdmin = async (req, res) => {
  try {
    const { receptionistId } = req.body
    if (!receptionistId) {
      return res.json({ success: false, message: 'Receptionist id is required' })
    }

    const existing = await receptionistModel.findById(receptionistId)
    if (!existing) {
      return res.json({ success: false, message: 'Receptionist not found' })
    }

    const updateData = {}

    if (req.body.name !== undefined) {
      const nextName = String(req.body.name || '').trim()
      if (!nextName) {
        return res.json({ success: false, message: 'Name is required' })
      }
      updateData.name = nextName
    }

    if (req.body.email !== undefined) {
      const nextEmail = normalizeEmail(req.body.email)
      if (!validator.isEmail(nextEmail)) {
        return res.json({ success: false, message: 'Please enter a valid email' })
      }
      if (nextEmail !== normalizeEmail(existing.email)) {
        const clash = await emailExists(receptionistModel, nextEmail, receptionistId)
        if (clash) {
          return res.json({ success: false, message: 'Another receptionist already uses this email' })
        }
      }
      updateData.email = nextEmail
    }

    if (req.body.phone !== undefined) {
      updateData.phone = String(req.body.phone || '').trim()
    }
    if (req.body.jobTitle !== undefined) {
      const jt = String(req.body.jobTitle || '').trim()
      updateData.jobTitle = jt || 'Receptionist'
    }
    if (req.body.department !== undefined) {
      updateData.department = String(req.body.department || '').trim()
    }
    if (req.body.employeeId !== undefined) {
      updateData.employeeId = String(req.body.employeeId || '').trim()
    }
    if (req.body.bio !== undefined) {
      updateData.bio = String(req.body.bio || '').trim()
    }
    if (req.body.adminNotes !== undefined) {
      updateData.adminNotes = String(req.body.adminNotes || '').trim()
    }
    if (req.body.address !== undefined) {
      updateData.address = normalizeReceptionistAddress(req.body.address)
    }
    if (req.body.emergencyContact !== undefined) {
      updateData.emergencyContact = normalizeEmergencyContact(req.body.emergencyContact)
    }
    if (req.body.isActive !== undefined) {
      updateData.isActive = parseBoolean(req.body.isActive, true)
    }
    if (req.body.mfaRequiredByAdmin !== undefined) {
      updateData['mfa.requiredByAdmin'] = parseBoolean(req.body.mfaRequiredByAdmin, false)
    }

    if (req.body.password) {
      const passwordPolicy = await validatePasswordAgainstPolicy(req.body.password)
      if (!passwordPolicy.valid) {
        return res.json({ success: false, message: passwordPolicy.message })
      }
      const salt = await bcrypt.genSalt(10)
      updateData.password = await bcrypt.hash(req.body.password, salt)
    }

    if (req.file) {
      const imageUpload = await cloudinary.uploader.upload(req.file.path, { resource_type: 'image' })
      updateData.image = imageUpload.secure_url
    }

    if (Object.keys(updateData).length === 0) {
      return res.json({ success: false, message: 'Nothing to update' })
    }

    await receptionistModel.findByIdAndUpdate(receptionistId, { $set: updateData })

    await logAudit({
      action: 'receptionist_update',
      status: 'success',
      targetUserId: receptionistId,
      entityType: 'receptionist',
      entityId: receptionistId,
      metadata: { fields: Object.keys(updateData).filter((key) => key !== 'password') },
      req
    })

    notifyProfileUpdatedByAdmin({
      recipientRole: 'receptionist',
      recipientId: receptionistId,
      detail: 'An administrator updated your reception profile.'
    })

    res.json({ success: true, message: 'Receptionist updated' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const adminFinancialAnalytics = async (req, res) => {
  try {
    const filterDocId = String(req.query.doctorId || '').trim()
    const [doctorRows, appointments] = await Promise.all([
      doctorModel.find().select('name email speciality financialCompensation').lean(),
      appointmentModel.find(filterDocId ? { docId: filterDocId } : {}).lean()
    ])

    const doctorMap = {}
    for (const d of doctorRows) {
      doctorMap[d._id.toString()] = {
        docId: d._id.toString(),
        doctorName: d.name,
        email: d.email,
        speciality: d.speciality,
        financialCompensation: normalizeFinancialCompensation(d.financialCompensation),
        paidRevenue: 0,
        outstandingAmount: 0,
        totalAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        paidVisitCount: 0
      }
    }

    for (const apt of appointments) {
      const id = String(apt.docId || '')
      if (!doctorMap[id]) {
        doctorMap[id] = {
          docId: id,
          doctorName: apt.docData?.name || 'Unknown doctor',
          email: '',
          speciality: apt.docData?.speciality || '',
          financialCompensation: normalizeFinancialCompensation({}),
          paidRevenue: 0,
          outstandingAmount: 0,
          totalAppointments: 0,
          completedAppointments: 0,
          cancelledAppointments: 0,
          paidVisitCount: 0
        }
      }
      const row = doctorMap[id]
      row.totalAppointments += 1
      const cancelled = apt.cancelled === true || apt.appointmentStatus === 'Cancelled'
      const finished = apt.isCompleted === true || apt.appointmentStatus === 'Finished'
      if (finished) row.completedAppointments += 1
      if (cancelled) row.cancelledAppointments += 1
      const amount = Number(apt.amount || 0)
      const paid = apt.paymentStatus === 'Paid' || apt.isCompleted
      if (paid) {
        row.paidRevenue += amount
        row.paidVisitCount += 1
      } else if (!cancelled) row.outstandingAmount += amount
    }

    const baseList = Object.values(doctorMap)
    const scoped = filterDocId ? baseList.filter((r) => r.docId === filterDocId) : baseList

    const breakdown = scoped
      .map((row) => {
        const attr = describeCompensationAttribution(row.paidRevenue, row.financialCompensation, {
          paidVisitCount: row.paidVisitCount
        })
        return {
          ...row,
          compensationLabel: attr.label,
          doctorAttributed: attr.doctorAttributed,
          clinicAttributed: attr.clinicAttributed,
          compensationDetail: attr.detail,
          isFixedMonthly: attr.isFixedMonthly,
          isHybrid: attr.isHybrid,
          revenueSharePart: attr.revenueSharePart,
          fixedMonthlyPart: attr.fixedMonthlyPart,
          percentageApplied: attr.percentageApplied
        }
      })
      .sort((a, b) => b.paidRevenue - a.paidRevenue)

    const revenueShareToDoctors = breakdown.reduce((s, r) => {
      if (r.isHybrid) return s + Number(r.revenueSharePart || 0)
      if (r.isFixedMonthly) return s
      return s + Number(r.doctorAttributed || 0)
    }, 0)
    const fixedMonthlySalarySum = breakdown.reduce((s, r) => {
      if (r.isHybrid) return s + Number(r.fixedMonthlyPart || 0)
      if (r.isFixedMonthly) return s + Number(r.doctorAttributed || 0)
      return s
    }, 0)
    const totals = {
      paidRevenue: breakdown.reduce((s, r) => s + r.paidRevenue, 0),
      outstandingAmount: breakdown.reduce((s, r) => s + r.outstandingAmount, 0),
      totalAppointments: breakdown.reduce((s, r) => s + r.totalAppointments, 0),
      paidVisitCount: breakdown.reduce((s, r) => s + (r.paidVisitCount || 0), 0),
      revenueShareToDoctors,
      fixedMonthlySalarySum,
      totalDoctorCompensationEstimate: revenueShareToDoctors + fixedMonthlySalarySum
    }

    res.json({
      success: true,
      filterDoctorId: filterDocId || null,
      totals,
      doctors: breakdown
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export { addDoctor, updateDoctorByAdmin, loginAdmin, verifyAdminMfaLogin, completeAdminMfaLoginSetup, getAdminProfile, updateAdminProfile, getAdminMfaStatus, startAdminMfaSetup, enableAdminMfa, disableAdminMfa, allDoctors, allPatients, allUsers, createUserByAdmin, updateUserByAdmin, resetUserPassword, updateUserMfaRequirement, resetUserMfa, deleteUserAccount, patientDetails, changePatientStatus, deletePatientProfile, appointmentsAdmin, appointmentCancel, adminDashboard, allAppointmentHistory, deleteAppointmentHistory, deleteProfile, addReceptionist, allReceptionists, changeReceptionistStatus, receptionistProfileByAdmin, updateReceptionistByAdmin, adminFinancialAnalytics }
