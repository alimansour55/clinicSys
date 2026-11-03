import jwt from 'jsonwebtoken'
import validator from 'validator'
import transporter from '../config/nodemailer.js'
import { ACCOUNT_VERIFICATION_TEMPLATE } from '../config/EmailTemplates.js'
import { getPublicAppBrand } from '../config/publicBrand.js'
import userModel from '../models/userModel.js'
import signupVerificationModel from '../models/signupVerificationModel.js'
import { findOneByEmail, normalizeEmail } from '../utils/emailUtils.js'
import { isValidEgyptPhone, normalizeEgyptPhone } from '../utils/egyptPhone.js'
import { generateOtp, getOtpExpiryMs, OTP_MAX_ATTEMPTS } from './accountVerificationService.js'
import { clearFailures, consumeQuota, getLockMinutes, recordFailure } from './authThrottleService.js'
import { checkPhoneVerification, isTwilioVerifyConfigured, startPhoneVerification } from './twilioVerifyService.js'

const PROOF_EXPIRES_IN = '30m'
const RESEND_COOLDOWN_MS = 60 * 1000
const HOUR = 60 * 60 * 1000
const SEND_LIMIT_PER_KEY = 6
const SEND_LIMIT_PER_IP = 20

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

/** The owner of a registered email gets a nudge instead of a code, and the caller sees the normal reply. */
const sendAlreadyRegisteredNotice = async (email) => {
  const brand = getPublicAppBrand()
  await transporter.sendMail({
    from: process.env.SENDER_EMAIL,
    to: email,
    subject: `${brand}: you already have an account`,
    html: `<p>Someone, probably you, tried to sign up with this email. You already have an account, so no code is needed.</p><p>Sign in, or use "Forgot password" if you cannot remember your password. If this was not you, you can ignore this email.</p><p>${brand}</p>`
  })
}

const checkSendQuota = async (key, ip) => {
  const allowed =
    (await consumeQuota('signup-send', key, { max: SEND_LIMIT_PER_KEY, windowMs: HOUR })) &&
    (await consumeQuota('signup-send-ip', ip, { max: SEND_LIMIT_PER_IP, windowMs: HOUR }))
  if (!allowed) {
    throw Object.assign(new Error('Too many codes requested. Please try again later.'), { code: 'RESEND_COOLDOWN' })
  }
}

/** Wrong guesses count against the code. The fifth destroys it, so a six-digit code cannot be brute forced. */
const checkPendingCode = async (key, otp, invalidMessage, expiredMessage) => {
  const lockMinutes = await getLockMinutes('signup-otp', key)
  if (lockMinutes) {
    throw Object.assign(new Error(`Too many attempts. Please try again in ${lockMinutes} minutes.`), { statusCode: 429 })
  }

  const pending = await signupVerificationModel.findOne({ key })
  if (!pending || !pending.otp || pending.otp !== otp) {
    const { locked } = await recordFailure('signup-otp', key, { max: OTP_MAX_ATTEMPTS })
    if (locked && pending) await signupVerificationModel.findOneAndUpdate({ key }, { otp: '', otpExpireAt: 0 })
    throw Object.assign(new Error(invalidMessage), { statusCode: 400 })
  }
  if (!pending.otpExpireAt || pending.otpExpireAt < Date.now()) {
    throw Object.assign(new Error(expiredMessage), { statusCode: 400 })
  }
  await clearFailures('signup-otp', key)
}

export const sendSignupEmailVerification = async (rawEmail, { ip = 'unknown' } = {}) => {
  const email = normalizeEmail(rawEmail)
  if (!validator.isEmail(email)) {
    throw Object.assign(new Error('Enter a valid email'), { statusCode: 400 })
  }

  const key = `email:${email}`
  const expiryMs = getOtpExpiryMs()
  const reply = {
    message: 'Verification code sent to your email',
    otpExpiresInMinutes: Math.round(expiryMs / 60000),
    resendAfterSeconds: RESEND_COOLDOWN_MS / 1000
  }

  let pending = await signupVerificationModel.findOne({ key })

  // A verified record used to return a proof to anyone asking, with no code. Now it simply sends a new code.
  if (pending && !canResend(pending.otpSentAt)) {
    throw Object.assign(new Error('Please wait before requesting a new email code'), {
      code: 'RESEND_COOLDOWN'
    })
  }

  await checkSendQuota(key, ip)

  const now = Date.now()
  const existing = await findOneByEmail(userModel, email)
  if (existing) {
    // Remember the send, so the cooldown behaves the same as for a new email. There is no code to guess.
    await signupVerificationModel.findOneAndUpdate(
      { key },
      { key, type: 'email', otp: '', otpExpireAt: 0, otpSentAt: now, verified: false },
      { upsert: true, new: true }
    )
    await sendAlreadyRegisteredNotice(email).catch((error) => console.error('Signup notice email:', error.message))
    return reply
  }

  const otp = generateOtp()

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
  await clearFailures('signup-otp', key)

  try {
    await sendSignupEmailOtpMessage(email, otp)
  } catch (error) {
    // Do not leave the person waiting out a cooldown for a code that never left.
    console.error('Signup email:', error.message)
    await signupVerificationModel.findOneAndUpdate({ key }, { otp: '', otpExpireAt: 0, otpSentAt: 0 })
    throw Object.assign(new Error('Could not send the email. Please check the address and try again.'), { statusCode: 502 })
  }

  return reply
}

export const confirmSignupEmailVerification = async (rawEmail, code) => {
  const email = normalizeEmail(rawEmail)
  const otp = typeof code === 'string' || typeof code === 'number' ? String(code).trim() : ''

  if (!validator.isEmail(email)) {
    throw Object.assign(new Error('Enter a valid email'), { statusCode: 400 })
  }

  await checkPendingCode(
    `email:${email}`,
    otp,
    'Invalid email verification code',
    'Email code has expired. Request a new one.'
  )

  await signupVerificationModel.findOneAndUpdate(
    { key: `email:${email}` },
    { verified: true, otp: '', otpExpireAt: 0 }
  )

  return {
    message: 'Email verified',
    verificationToken: signProof('signup-email', email)
  }
}

export const sendSignupPhoneVerification = async (rawPhone, { ip = 'unknown' } = {}) => {
  const phone = normalizeEgyptPhone(rawPhone)
  if (!isValidEgyptPhone(phone)) {
    throw Object.assign(new Error('Please enter a valid Egyptian mobile number'), { statusCode: 400 })
  }

  const key = `phone:${phone}`
  let pending = await signupVerificationModel.findOne({ key })

  if (pending && !canResend(pending.otpSentAt)) {
    throw Object.assign(new Error('Please wait before requesting a new SMS code'), {
      code: 'RESEND_COOLDOWN'
    })
  }

  await checkSendQuota(key, ip)

  const now = Date.now()
  let smsDevMode = false

  // Same reply as a new number, with no SMS sent: this must not reveal which numbers have accounts, or cost money.
  if (await userModel.findOne({ phone }).select('_id').lean()) {
    await signupVerificationModel.findOneAndUpdate(
      { key },
      { key, type: 'phone', otp: '', otpExpireAt: 0, otpSentAt: now, verified: false },
      { upsert: true, new: true }
    )
    return {
      message: 'Verification code sent to your phone',
      smsDevMode: !isTwilioVerifyConfigured() && process.env.NODE_ENV !== 'production',
      otpExpiresInMinutes: Math.round(getOtpExpiryMs() / 60000)
    }
  }

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
  const otp = typeof code === 'string' || typeof code === 'number' ? String(code).trim() : ''

  if (!isValidEgyptPhone(phone)) {
    throw Object.assign(new Error('Please enter a valid Egyptian mobile number'), { statusCode: 400 })
  }

  if (isTwilioVerifyConfigured()) {
    const lockMinutes = await getLockMinutes('signup-otp', `phone:${phone}`)
    if (lockMinutes) {
      throw Object.assign(new Error(`Too many attempts. Please try again in ${lockMinutes} minutes.`), { statusCode: 429 })
    }
    const check = await checkPhoneVerification(phone, otp)
    if (!check.approved) {
      await recordFailure('signup-otp', `phone:${phone}`, { max: OTP_MAX_ATTEMPTS })
      throw Object.assign(new Error('Invalid SMS verification code'), {
        statusCode: 400
      })
    }
  } else {
    await checkPendingCode(
      `phone:${phone}`,
      otp,
      'Invalid SMS verification code',
      'SMS code has expired. Request a new one.'
    )
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
