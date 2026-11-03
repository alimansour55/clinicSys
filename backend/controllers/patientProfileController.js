import { v2 as cloudinary } from 'cloudinary'
import userModel from '../models/userModel.js'
import { OTP_MAX_ATTEMPTS, issueVerificationCodes, otpMatches } from '../services/accountVerificationService.js'
import { logAudit } from '../services/auditService.js'
import { clearFailures, consumeQuota, getLockMinutes, recordFailure } from '../services/authThrottleService.js'
import { checkPhoneVerification, isTwilioVerifyConfigured } from '../services/twilioVerifyService.js'
import { isValidEgyptPhone, normalizeEgyptPhone } from '../utils/egyptPhone.js'
import { BLOOD_TYPES } from '../models/familyMemberModel.js'
import { destroyCloudinaryUpload } from './patientAuthController.js'
import { buildInsuranceData, isPastDate } from './userController.js'

const HOUR = 60 * 60 * 1000
const MEDICAL_FIELD_MAX = 5000
const medicalHistoryFields = ['conditions', 'allergies', 'surgeries', 'familyHistory', 'socialHistory', 'notes']

const asText = (value, max = 200) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) : '')

// Only the message is logged. An error object from a save can quote the health data it was given.
const failed = (res, label, error) => {
  console.error(`${label}:`, error.message)
  return res.json({ success: false, message: 'Something went wrong. Please try again.' })
}

export const getProfile = async (req, res) => {
  try {
    const userData = await userModel.findById(req.user.userId).select('-password')
    return res.json({ success: true, userData })
  } catch (error) {
    return failed(res, 'Get profile', error)
  }
}

const parseAddress = (address) => {
  if (!address) return { line1: '', line2: '' }
  let source = address
  if (typeof address === 'string') {
    try {
      source = JSON.parse(address)
    } catch {
      return null
    }
  }
  if (!source || typeof source !== 'object') return null
  return { line1: asText(source.line1, 200), line2: asText(source.line2, 200) }
}

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId
    const body = req.body || {}
    const name = asText(body.name, 120)
    const dob = asText(body.dob, 10)
    const rawPhone = asText(body.phone, 20)

    if (!name || !rawPhone || !dob) return res.json({ success: false, message: 'Data Missing' })
    if (!isPastDate(dob)) return res.json({ success: false, message: 'Birth date must be in the past' })

    const address = parseAddress(body.address)
    if (!address) return res.json({ success: false, message: 'Please check the address' })

    const current = await userModel.findById(userId).select('phone image')
    if (!current) return res.json({ success: false, message: 'User not found' })

    const updates = {
      name,
      address,
      dob,
      gender: ['Male', 'Female'].includes(body.gender) ? body.gender : 'Not Selected'
    }

    const phone = normalizeEgyptPhone(rawPhone)
    if (rawPhone !== current.phone) {
      if (!isValidEgyptPhone(phone)) {
        return res.json({ success: false, message: 'Please enter a valid Egyptian mobile number' })
      }
      if (phone !== current.phone) {
        if (await userModel.findOne({ phone, _id: { $ne: userId } }).select('_id').lean()) {
          return res.json({ success: false, message: 'Phone number already registered' })
        }
        // A verified badge belongs to a number, not to the account.
        Object.assign(updates, { phone, phoneVerified: false, phoneVerifyOtp: '', phoneVerifyOtpExpireAt: 0, phoneVerifyOtpSentAt: 0 })
      }
    }

    if (req.file) {
      const uploaded = await cloudinary.uploader.upload(req.file.path, { resource_type: 'image' })
      updates.image = uploaded.secure_url
    }

    await userModel.findByIdAndUpdate(userId, updates)
    if (updates.image) void destroyCloudinaryUpload(current.image)

    return res.json({ success: true, message: 'Profile Updated' })
  } catch (error) {
    return failed(res, 'Update profile', error)
  }
}

export const updateInsurance = async (req, res) => {
  try {
    const userId = req.user.userId
    const user = await userModel.findById(userId).select('insurance')
    if (!user) return res.json({ success: false, message: 'User not found' })

    const previousPhoto = user.insurance?.medicalCardPhoto || ''
    let insurance
    try {
      insurance = await buildInsuranceData(req.body || {}, req.file, user.insurance?.toObject?.() || {}, 'patient')
    } catch (validationError) {
      if (/insurance|medical card|provider|birth date/i.test(validationError.message)) {
        return res.json({ success: false, message: validationError.message })
      }
      throw validationError
    }

    // Turning insurance off should not leave a copy of the card on file.
    if (!insurance.enabled) insurance.medicalCardPhoto = ''

    const updatedUser = await userModel.findByIdAndUpdate(userId, { insurance }, { new: true }).select('-password')
    if (previousPhoto && previousPhoto !== insurance.medicalCardPhoto) void destroyCloudinaryUpload(previousPhoto)

    await logAudit({
      action: 'insurance_update',
      actorUserId: userId,
      actorRole: 'patient',
      status: 'success',
      targetUserId: userId,
      entityType: 'user',
      entityId: userId,
      metadata: { enabled: insurance.enabled },
      req
    })

    return res.json({ success: true, message: 'Insurance updated', userData: updatedUser, insurance: updatedUser.insurance })
  } catch (error) {
    return failed(res, 'Update insurance', error)
  }
}

export const getMedicalHistory = async (req, res) => {
  try {
    const userData = await userModel.findById(req.user.userId).select('medicalHistory')
    if (!userData) return res.json({ success: false, message: 'User not found' })
    return res.json({ success: true, medicalHistory: userData.medicalHistory || {} })
  } catch (error) {
    return failed(res, 'Get medical history', error)
  }
}

export const saveMedicalHistory = async (req, res) => {
  try {
    const userId = req.user.userId
    const source = req.body?.medicalHistory && typeof req.body.medicalHistory === 'object' ? req.body.medicalHistory : req.body || {}

    const current = await userModel.findById(userId).select('medicalHistory')
    if (!current) return res.json({ success: false, message: 'User not found' })

    const next = {}
    const changedFields = []
    for (const field of medicalHistoryFields) {
      next[field] = asText(source[field], MEDICAL_FIELD_MAX)
      if (next[field] !== (current.medicalHistory?.[field] || '')) changedFields.push(field)
    }
    next.updatedAt = Date.now()
    next.updatedBy = 'patient'

    const userData = await userModel.findByIdAndUpdate(userId, { medicalHistory: next }, { new: true }).select('medicalHistory')

    // Field names only. The values are health data and stay out of the audit log.
    await logAudit({
      action: 'medical_history_update',
      actorUserId: userId,
      actorRole: 'patient',
      status: 'success',
      targetUserId: userId,
      entityType: 'user',
      entityId: userId,
      metadata: { changedFields },
      req
    })

    return res.json({ success: true, message: req.method === 'PUT' ? 'Medical history updated' : 'Medical history saved', medicalHistory: userData.medicalHistory })
  } catch (error) {
    return failed(res, 'Save medical history', error)
  }
}

export const updateEmergencyProfile = async (req, res) => {
  try {
    const bloodType = asText(req.body?.bloodType, 3)
    const contactName = asText(req.body?.contactName, 120)
    const contactPhone = asText(req.body?.contactPhone, 24)

    if (!BLOOD_TYPES.includes(bloodType)) return res.json({ success: false, message: 'Please choose a blood type from the list' })
    if (contactPhone && !/^\+?[\d\s-]{6,24}$/.test(contactPhone)) {
      return res.json({ success: false, message: 'Please check the emergency contact number' })
    }

    const user = await userModel.findByIdAndUpdate(
      req.user.userId,
      { emergency: { bloodType, contactName, contactPhone, updatedAt: Date.now() } },
      { new: true }
    ).select('emergency')
    if (!user) return res.json({ success: false, message: 'User not found' })

    return res.json({ success: true, message: 'Emergency details saved', emergency: user.emergency })
  } catch (error) {
    return failed(res, 'Emergency profile', error)
  }
}

export const updateOnboarding = async (req, res) => {
  try {
    const action = req.body?.action
    if (!['complete', 'dismiss'].includes(action)) return res.json({ success: false, message: 'Unknown action' })
    const field = action === 'complete' ? 'onboarding.completedAt' : 'onboarding.dismissedAt'
    await userModel.findByIdAndUpdate(req.user.userId, { [field]: Date.now() })
    return res.json({ success: true })
  } catch (error) {
    return failed(res, 'Onboarding', error)
  }
}

export const sendPhoneVerification = async (req, res) => {
  try {
    const userId = req.user.userId
    const user = await userModel.findById(userId)
    if (!user) return res.json({ success: false, message: 'User not found' })
    if (user.phoneVerified) return res.json({ success: true, alreadyVerified: true, message: 'Phone already verified' })
    if (!isValidEgyptPhone(user.phone)) return res.json({ success: false, message: 'Please add a valid Egyptian mobile number to your profile first' })

    if (!(await consumeQuota('phone-send', userId, { max: 5, windowMs: HOUR }))) {
      return res.json({ success: false, message: 'Too many codes requested. Please try again later.' })
    }

    const { smsDevMode } = await issueVerificationCodes(user, { forceEmail: false, forcePhone: true })
    await clearFailures('phone-confirm', userId)
    return res.json({ success: true, message: 'Verification code sent to your phone', smsDevMode: Boolean(smsDevMode), resendAfterSeconds: 60 })
  } catch (error) {
    if (error.code === 'RESEND_COOLDOWN') return res.json({ success: false, message: error.message })
    console.error('Phone verification send:', error.message)
    return res.json({ success: false, message: 'We could not send an SMS right now. Please try again later.' })
  }
}

export const confirmPhoneVerification = async (req, res) => {
  try {
    const userId = req.user.userId
    const code = asText(req.body?.code, 10)
    if (!code) return res.json({ success: false, message: 'SMS verification code is required' })

    const lockMinutes = await getLockMinutes('phone-confirm', userId)
    if (lockMinutes) return res.json({ success: false, message: `Too many attempts. Please try again in ${lockMinutes} minutes.` })

    const user = await userModel.findById(userId).select('+phoneVerifyOtp phone phoneVerified phoneVerifyOtpExpireAt')
    if (!user) return res.json({ success: false, message: 'User not found' })
    if (user.phoneVerified) return res.json({ success: true, message: 'Phone already verified' })

    let approved
    if (isTwilioVerifyConfigured()) {
      approved = (await checkPhoneVerification(user.phone, code)).approved
    } else {
      approved = otpMatches(user.phoneVerifyOtp, code) && user.phoneVerifyOtpExpireAt >= Date.now()
    }

    if (!approved) {
      const { locked } = await recordFailure('phone-confirm', userId, { max: OTP_MAX_ATTEMPTS })
      if (locked) await userModel.findByIdAndUpdate(userId, { phoneVerifyOtp: '', phoneVerifyOtpExpireAt: 0 })
      return res.json({ success: false, message: 'Invalid or expired code. Check it or request a new one.' })
    }

    await userModel.findByIdAndUpdate(userId, { phoneVerified: true, phoneVerifyOtp: '', phoneVerifyOtpExpireAt: 0 })
    await clearFailures('phone-confirm', userId)
    await logAudit({ action: 'phone_verified', status: 'success', actorUserId: userId, actorRole: 'patient', entityType: 'user', entityId: userId, req })
    return res.json({ success: true, message: 'Phone verified successfully' })
  } catch (error) {
    return failed(res, 'Phone verification confirm', error)
  }
}
