import jwt from 'jsonwebtoken'
import transporter from '../config/nodemailer.js'
import { ACCOUNT_VERIFICATION_TEMPLATE } from '../config/EmailTemplates.js'
import { getPublicAppBrand } from '../config/publicBrand.js'
import userModel from '../models/userModel.js'
import { sendSms } from './smsService.js'
import { isTwilioVerifyConfigured, startPhoneVerification } from './twilioVerifyService.js'

const VERIFICATION_TOKEN_EXPIRES_IN = '30m'
const RESEND_COOLDOWN_MS = 60 * 1000

export const getOtpExpiryMs = () => {
  const minutes = Number(process.env.ACCOUNT_VERIFY_OTP_MINUTES) || 10
  return minutes * 60 * 1000
}

export const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000))

export const isAccountVerified = (user) => {
  if (!user) return false
  if (user.accountVerifiedAt) return true
  if (user.emailVerified === true) return true
  if (user.emailVerified === undefined && user.phoneVerified === undefined) return true
  return false
}

export const maskEmail = (email) => {
  const [local, domain] = String(email || '').split('@')
  if (!domain) return email
  const visible = local.length <= 2 ? local[0] || '*' : `${local.slice(0, 2)}***`
  return `${visible}@${domain}`
}

export const maskPhone = (phone) => {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.length < 6) return phone
  return `${d.slice(0, 3)}****${d.slice(-3)}`
}

export const signVerificationToken = (userId) =>
  jwt.sign(
    { id: userId.toString(), role: 'patient', purpose: 'account-verify' },
    process.env.JWT_SECRET,
    { expiresIn: VERIFICATION_TOKEN_EXPIRES_IN }
  )

export const getUserFromVerificationToken = async (verificationToken) => {
  const decoded = jwt.verify(verificationToken, process.env.JWT_SECRET)
  if (decoded?.purpose !== 'account-verify' || decoded?.role !== 'patient' || !decoded?.id) {
    return null
  }
  return userModel.findById(decoded.id)
}

const canResend = (sentAt) => !sentAt || Date.now() - sentAt >= RESEND_COOLDOWN_MS

const sendEmailOtp = async (user, otp) => {
  const minutes = Math.round(getOtpExpiryMs() / 60000)
  const html = ACCOUNT_VERIFICATION_TEMPLATE
    .replace(/\{\{otp\}\}/g, otp)
    .replace(/\{\{email\}\}/g, user.email)
    .replace(/\{\{minutes\}\}/g, String(minutes))
    .replace(/\{\{FOOTER_YEAR\}\}/g, String(new Date().getFullYear()))
    .replace(/\{\{FOOTER_BRAND\}\}/g, getPublicAppBrand())

  await transporter.sendMail({
    from: process.env.SENDER_EMAIL,
    to: user.email,
    subject: `${getPublicAppBrand()} — verify your email`,
    html
  })
}

const sendPhoneOtp = async (user, otp) => {
  if (isTwilioVerifyConfigured()) {
    await startPhoneVerification(user.phone)
    return { devMode: false, twilioVerify: true }
  }

  const brand = getPublicAppBrand()
  const minutes = Math.round(getOtpExpiryMs() / 60000)
  return sendSms({
    to: user.phone,
    body: `${brand}: your verification code is ${otp}. Valid for ${minutes} minutes.`
  })
}

export const issueVerificationCodes = async (user, { forceEmail = true, forcePhone = false } = {}) => {
  const expiryMs = getOtpExpiryMs()
  const now = Date.now()
  const updates = {}

  if (forceEmail && !user.emailVerified) {
    if (!canResend(user.emailVerifyOtpSentAt)) {
      const err = new Error('Please wait before requesting a new email code')
      err.code = 'RESEND_COOLDOWN'
      throw err
    }
    const otp = generateOtp()
    updates.emailVerifyOtp = otp
    updates.emailVerifyOtpExpireAt = now + expiryMs
    updates.emailVerifyOtpSentAt = now
    await sendEmailOtp(user, otp)
  }

  if (forcePhone && !user.phoneVerified) {
    if (!canResend(user.phoneVerifyOtpSentAt)) {
      const err = new Error('Please wait before requesting a new SMS code')
      err.code = 'RESEND_COOLDOWN'
      throw err
    }
    updates.phoneVerifyOtpSentAt = now
    if (isTwilioVerifyConfigured()) {
      const smsResult = await sendPhoneOtp(user)
      updates._smsDevMode = smsResult.devMode
      updates.phoneVerifyOtp = ''
      updates.phoneVerifyOtpExpireAt = 0
    } else {
      const otp = generateOtp()
      updates.phoneVerifyOtp = otp
      updates.phoneVerifyOtpExpireAt = now + expiryMs
      const smsResult = await sendPhoneOtp(user, otp)
      updates._smsDevMode = smsResult.devMode
    }
  }

  if (Object.keys(updates).length) {
    const { _smsDevMode, ...dbUpdates } = updates
    await userModel.findByIdAndUpdate(user._id, dbUpdates)
    return { smsDevMode: _smsDevMode }
  }

  return { smsDevMode: false }
}

export const buildVerificationStatus = (user, extras = {}) => ({
  emailVerified: Boolean(user.emailVerified),
  phoneVerified: Boolean(user.phoneVerified),
  accountVerified: isAccountVerified(user),
  email: maskEmail(user.email),
  phone: maskPhone(user.phone),
  otpExpiresInMinutes: Math.round(getOtpExpiryMs() / 60000),
  phoneVerificationProvider: isTwilioVerifyConfigured() ? 'twilio-verify' : 'local',
  ...extras
})

export const markStaffCreatedAccountVerified = () => ({
  emailVerified: true,
  phoneVerified: true,
  accountVerifiedAt: Date.now(),
  emailVerifyOtp: '',
  emailVerifyOtpExpireAt: 0,
  phoneVerifyOtp: '',
  phoneVerifyOtpExpireAt: 0
})

export const buildRegistrationVerificationResponse = async (user) => {
  let smsDevMode = false
  try {
    const result = await issueVerificationCodes(user)
    smsDevMode = Boolean(result?.smsDevMode)
  } catch (error) {
    console.error('Failed to send verification codes:', error)
    throw error
  }

  return {
    success: true,
    verificationRequired: true,
    verificationToken: signVerificationToken(user._id),
    smsDevMode,
    message: 'We sent a verification code to your email. Enter the code to activate your account.',
    ...buildVerificationStatus(user)
  }
}
