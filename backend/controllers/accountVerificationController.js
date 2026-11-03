import userModel from '../models/userModel.js'
import { logAudit } from '../services/auditService.js'
import {
  buildVerificationStatus,
  getUserFromVerificationToken,
  isAccountVerified,
  issueVerificationCodes,
  OTP_MAX_ATTEMPTS,
  otpMatches
} from '../services/accountVerificationService.js'
import { clearFailures, consumeQuota, getLockMinutes, recordFailure } from '../services/authThrottleService.js'
import { completeSignIn } from '../services/patientSessionService.js'
import { checkPhoneVerification, isTwilioVerifyConfigured } from '../services/twilioVerifyService.js'

const HOUR = 60 * 60 * 1000
const SESSION_EXPIRED = 'Verification session expired. Please sign in again.'
const SOMETHING_WRONG = 'Something went wrong. Please try again.'

const lockMessage = (minutes) => `Too many attempts. Try again in ${minutes} minutes or request a new code.`

/** Counts a wrong code. Reaching the limit throws the code away, so guessing has to start again against a new one. */
const failCode = async (user, channel, res, message) => {
  const { locked } = await recordFailure(`verify-${channel}`, user._id, { max: OTP_MAX_ATTEMPTS })
  if (locked) {
    const clear = channel === 'email'
      ? { emailVerifyOtp: '', emailVerifyOtpExpireAt: 0 }
      : { phoneVerifyOtp: '', phoneVerifyOtpExpireAt: 0 }
    await userModel.findByIdAndUpdate(user._id, clear)
  }
  return res.json({ success: false, message })
}

/** Verifying is not a substitute for the MFA step: with MFA on, the person is sent back to sign in. */
const finishVerification = async (fresh, req, payload) => {
  const result = await completeSignIn(fresh, req, { loginId: fresh.patientId || fresh.email })
  if (result.token) payload.token = result.token
  else payload.signInRequired = true

  await logAudit({
    action: 'account_verified',
    actorUserId: fresh._id,
    actorRole: 'patient',
    status: 'success',
    entityType: 'user',
    entityId: fresh._id,
    req
  })
}

export const getAccountVerificationStatus = async (req, res) => {
  try {
    const user = await getUserFromVerificationToken(req.body?.verificationToken)
    if (!user) return res.json({ success: false, sessionExpired: true, message: SESSION_EXPIRED })

    return res.json({ success: true, ...buildVerificationStatus(user) })
  } catch (error) {
    console.error('Verification status:', error.message)
    return res.json({ success: false, message: SOMETHING_WRONG })
  }
}

export const resendAccountVerificationCodes = async (req, res) => {
  try {
    const { verificationToken, channel } = req.body || {}
    const user = await getUserFromVerificationToken(verificationToken)
    if (!user) return res.json({ success: false, sessionExpired: true, message: SESSION_EXPIRED })

    // This used to hand out a login token, which turned a leftover verification token into a way past MFA.
    if (isAccountVerified(user)) {
      return res.json({ success: true, signInRequired: true, message: 'Your account is already verified. Please sign in.', ...buildVerificationStatus(user) })
    }

    if (!(await consumeQuota('verify-resend', user._id, { max: 6, windowMs: HOUR }))) {
      return res.json({ success: false, message: 'Too many codes requested. Please try again later.' })
    }

    const forceEmail = !channel || channel === 'email' || channel === 'both'
    const forcePhone = !channel || channel === 'phone' || channel === 'both'

    const { smsDevMode } = await issueVerificationCodes(user, { forceEmail, forcePhone })
    await clearFailures(forceEmail ? 'verify-email' : 'verify-phone', user._id)
    const fresh = await userModel.findById(user._id)

    return res.json({
      success: true,
      message: 'Verification codes sent',
      smsDevMode: Boolean(smsDevMode),
      ...buildVerificationStatus(fresh)
    })
  } catch (error) {
    console.error('Verification resend:', error.code || error.message)
    const message = error.code === 'RESEND_COOLDOWN' ? error.message : 'Could not send verification codes'
    return res.json({ success: false, message })
  }
}

export const verifyAccountEmail = async (req, res) => {
  try {
    const { verificationToken, code } = req.body || {}
    const user = await getUserFromVerificationToken(verificationToken)
    if (!user) return res.json({ success: false, sessionExpired: true, message: SESSION_EXPIRED })

    if (user.emailVerified) {
      return res.json({ success: true, signInRequired: true, message: 'Email already verified', ...buildVerificationStatus(user) })
    }

    const lockMinutes = await getLockMinutes('verify-email', user._id)
    if (lockMinutes) return res.json({ success: false, message: lockMessage(lockMinutes) })

    if (!otpMatches(user.emailVerifyOtp, code)) {
      return failCode(user, 'email', res, 'Invalid email verification code')
    }
    if (!user.emailVerifyOtpExpireAt || user.emailVerifyOtpExpireAt < Date.now()) {
      return res.json({ success: false, message: 'Email code has expired. Request a new one.' })
    }

    await clearFailures('verify-email', user._id)
    await userModel.findByIdAndUpdate(user._id, {
      emailVerified: true,
      emailVerifyOtp: '',
      emailVerifyOtpExpireAt: 0,
      accountVerifiedAt: Date.now()
    })
    const fresh = await userModel.findById(user._id)

    const payload = { success: true, message: 'Email verified successfully', ...buildVerificationStatus(fresh) }
    if (isAccountVerified(fresh)) await finishVerification(fresh, req, payload)

    return res.json(payload)
  } catch (error) {
    console.error('Verify email:', error.message)
    return res.json({ success: false, message: SOMETHING_WRONG })
  }
}

export const verifyAccountPhone = async (req, res) => {
  try {
    const { verificationToken, code } = req.body || {}
    const user = await getUserFromVerificationToken(verificationToken)
    if (!user) return res.json({ success: false, sessionExpired: true, message: SESSION_EXPIRED })

    if (user.phoneVerified) {
      return res.json({ success: true, signInRequired: true, message: 'Phone already verified', ...buildVerificationStatus(user) })
    }

    const otp = typeof code === 'string' || typeof code === 'number' ? String(code).trim() : ''
    if (!otp) return res.json({ success: false, message: 'SMS verification code is required' })

    const lockMinutes = await getLockMinutes('verify-phone', user._id)
    if (lockMinutes) return res.json({ success: false, message: lockMessage(lockMinutes) })

    if (isTwilioVerifyConfigured()) {
      const check = await checkPhoneVerification(user.phone, otp)
      if (!check.approved) return failCode(user, 'phone', res, 'Invalid SMS verification code')
    } else {
      if (!otpMatches(user.phoneVerifyOtp, otp)) return failCode(user, 'phone', res, 'Invalid SMS verification code')
      if (!user.phoneVerifyOtpExpireAt || user.phoneVerifyOtpExpireAt < Date.now()) {
        return res.json({ success: false, message: 'SMS code has expired. Request a new one.' })
      }
    }

    await clearFailures('verify-phone', user._id)
    const updates = { phoneVerified: true, phoneVerifyOtp: '', phoneVerifyOtpExpireAt: 0 }
    if (user.emailVerified && !user.accountVerifiedAt) updates.accountVerifiedAt = Date.now()

    await userModel.findByIdAndUpdate(user._id, updates)
    const fresh = await userModel.findById(user._id)

    const payload = { success: true, message: 'Phone verified successfully', ...buildVerificationStatus(fresh) }
    if (isAccountVerified(fresh)) await finishVerification(fresh, req, payload)

    return res.json(payload)
  } catch (error) {
    console.error('Verify phone:', error.message)
    return res.json({ success: false, message: SOMETHING_WRONG })
  }
}
