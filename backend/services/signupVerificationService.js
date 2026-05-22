import jwt from 'jsonwebtoken'
import validator from 'validator'
import transporter from '../config/nodemailer.js'
import { ACCOUNT_VERIFICATION_TEMPLATE } from '../config/EmailTemplates.js'
import { getPublicAppBrand } from '../config/publicBrand.js'
import userModel from '../models/userModel.js'
import signupVerificationModel from '../models/signupVerificationModel.js'
import { findOneByEmail, normalizeEmail } from '../utils/emailUtils.js'
import { isValidEgyptPhone, normalizeEgyptPhone } from '../utils/egyptPhone.js'
import { generateOtp, getOtpExpiryMs } from './accountVerificationService.js'
import { checkPhoneVerification, isTwilioVerifyConfigured, startPhoneVerification } from './twilioVerifyService.js'

const PROOF_EXPIRES_IN = '30m'
const RESEND_COOLDOWN_MS = 60 * 1000

const canResend = (sentAt) => !sentAt || Date.now() - sentAt >= RESEND_COOLDOWN_MS

const signProof = (purpose, value) =>
  jwt.sign({ purpose, value, role: 'signup-proof' }, process.env.JWT_SECRET, {
    expiresIn: PROOF_EXPIRES_IN
  })

export const verifySignupProof = (token, purpose, expectedValue) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (decoded?.role !== 'signup-proof' || decoded?.purpose !== purpose) return false
    if (purpose === 'signup-email') {
      return decoded.value === expectedValue
    }
    if (purpose === 'signup-phone') {
      return decoded.value === expectedValue
    }
    return false
  } catch {
    return false
  }
}

const sendSignupEmailOtpMessage = async (email, otp) => {
  const minutes = Math.round(getOtpExpiryMs() / 60000)
  const html = ACCOUNT_VERIFICATION_TEMPLATE
    .replace(/\{\{otp\}\}/g, otp)
    .replace(/\{\{email\}\}/g, email)
    .replace(/\{\{minutes\}\}/g, String(minutes))
    .replace(/\{\{FOOTER_YEAR\}\}/g, String(new Date().getFullYear()))
    .replace(/\{\{FOOTER_BRAND\}\}/g, getPublicAppBrand())

  await transporter.sendMail({
    from: process.env.SENDER_EMAIL,
    to: email,
    subject: `${getPublicAppBrand()} — verify your email`,
    html
  })
}

export const sendSignupEmailVerification = async (rawEmail) => {
  const email = normalizeEmail(rawEmail)
  if (!validator.isEmail(email)) {
    throw Object.assign(new Error('Enter a valid email'), { statusCode: 400 })
  }

  const existing = await findOneByEmail(userModel, email)
  if (existing) {
    throw Object.assign(new Error('Email already registered'), { statusCode: 400 })
  }

  const key = `email:${email}`
  let pending = await signupVerificationModel.findOne({ key })

  if (pending?.verified) {
    return {
      alreadyVerified: true,
      verificationToken: signProof('signup-email', email),
      message: 'Email already verified'
    }
  }

  if (pending && !canResend(pending.otpSentAt)) {
    throw Object.assign(new Error('Please wait before requesting a new email code'), {
      code: 'RESEND_COOLDOWN'
    })
  }

  const otp = generateOtp()
  const now = Date.now()
  const expiryMs = getOtpExpiryMs()

  pending = await signupVerificationModel.findOneAndUpdate(
    { key },
    {
      key,
      type: 'email',
      otp,
      otpExpireAt: now + expiryMs,
      otpSentAt: now,
      verified: false
    },
    { upsert: true, new: true }
  )

  await sendSignupEmailOtpMessage(email, otp)

  return {
    message: 'Verification code sent to your email',
    otpExpiresInMinutes: Math.round(expiryMs / 60000)
  }
}

export const confirmSignupEmailVerification = async (rawEmail, code) => {
  const email = normalizeEmail(rawEmail)
  const otp = String(code || '').trim()

  if (!validator.isEmail(email)) {
    throw Object.assign(new Error('Enter a valid email'), { statusCode: 400 })
  }

  const pending = await signupVerificationModel.findOne({ key: `email:${email}` })
  if (!pending || pending.otp !== otp) {
    throw Object.assign(new Error('Invalid email verification code'), { statusCode: 400 })
  }
  if (!pending.otpExpireAt || pending.otpExpireAt < Date.now()) {
    throw Object.assign(new Error('Email code has expired. Request a new one.'), { statusCode: 400 })
  }

  await signupVerificationModel.findOneAndUpdate(
    { key: `email:${email}` },
    { verified: true, otp: '', otpExpireAt: 0 }
  )

  return {
    message: 'Email verified',
    verificationToken: signProof('signup-email', email)
  }
}

export const sendSignupPhoneVerification = async (rawPhone) => {
  const phone = normalizeEgyptPhone(rawPhone)
  if (!isValidEgyptPhone(phone)) {
    throw Object.assign(new Error('Please enter a valid Egyptian mobile number'), { statusCode: 400 })
  }

  const existing = await userModel.findOne({ phone })
  if (existing) {
    throw Object.assign(new Error('Phone number already registered'), { statusCode: 400 })
  }

  const key = `phone:${phone}`
  let pending = await signupVerificationModel.findOne({ key })

  if (pending?.verified) {
    return {
      alreadyVerified: true,
      verificationToken: signProof('signup-phone', phone),
      message: 'Phone already verified',
      smsDevMode: !isTwilioVerifyConfigured()
    }
  }

  if (pending && !canResend(pending.otpSentAt)) {
    throw Object.assign(new Error('Please wait before requesting a new SMS code'), {
      code: 'RESEND_COOLDOWN'
    })
  }

  const now = Date.now()
  let smsDevMode = false

  if (isTwilioVerifyConfigured()) {
    await startPhoneVerification(phone)
  } else {
    const otp = generateOtp()
    const expiryMs = getOtpExpiryMs()
    const { sendSms } = await import('./smsService.js')
    const brand = getPublicAppBrand()
    const result = await sendSms({
      to: phone,
      body: `${brand}: your verification code is ${otp}. Valid for ${Math.round(expiryMs / 60000)} minutes.`
    })
    smsDevMode = Boolean(result.devMode)
    pending = await signupVerificationModel.findOneAndUpdate(
      { key },
      {
        key,
        type: 'phone',
        otp,
        otpExpireAt: now + expiryMs,
        otpSentAt: now,
        verified: false
      },
      { upsert: true, new: true }
    )
    return {
      message: smsDevMode
        ? 'Check the backend terminal for your SMS code (dev mode)'
        : 'Verification code sent to your phone',
      smsDevMode,
      otpExpiresInMinutes: Math.round(expiryMs / 60000)
    }
  }

  await signupVerificationModel.findOneAndUpdate(
    { key },
    {
      key,
      type: 'phone',
      otp: '',
      otpExpireAt: 0,
      otpSentAt: now,
      verified: false
    },
    { upsert: true, new: true }
  )

  return {
    message: 'Verification code sent to your phone',
    smsDevMode: false,
    otpExpiresInMinutes: Math.round(getOtpExpiryMs() / 60000)
  }
}

export const confirmSignupPhoneVerification = async (rawPhone, code) => {
  const phone = normalizeEgyptPhone(rawPhone)
  const otp = String(code || '').trim()

  if (!isValidEgyptPhone(phone)) {
    throw Object.assign(new Error('Please enter a valid Egyptian mobile number'), { statusCode: 400 })
  }

  if (isTwilioVerifyConfigured()) {
    const check = await checkPhoneVerification(phone, otp)
    if (!check.approved) {
      throw Object.assign(new Error(check.message || 'Invalid SMS verification code'), {
        statusCode: 400
      })
    }
  } else {
    const pending = await signupVerificationModel.findOne({ key: `phone:${phone}` })
    if (!pending || pending.otp !== otp) {
      throw Object.assign(new Error('Invalid SMS verification code'), { statusCode: 400 })
    }
    if (!pending.otpExpireAt || pending.otpExpireAt < Date.now()) {
      throw Object.assign(new Error('SMS code has expired. Request a new one.'), { statusCode: 400 })
    }
    await signupVerificationModel.findOneAndUpdate(
      { key: `phone:${phone}` },
      { verified: true, otp: '', otpExpireAt: 0 }
    )
  }

  if (isTwilioVerifyConfigured()) {
    await signupVerificationModel.findOneAndUpdate(
      { key: `phone:${phone}` },
      {
        key: `phone:${phone}`,
        type: 'phone',
        verified: true,
        otp: '',
        otpExpireAt: 0,
        otpSentAt: Date.now()
      },
      { upsert: true }
    )
  }

  return {
    message: 'Phone verified',
    verificationToken: signProof('signup-phone', phone)
  }
}
