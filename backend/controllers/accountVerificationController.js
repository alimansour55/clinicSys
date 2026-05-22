import jwt from 'jsonwebtoken'
import userModel from '../models/userModel.js'
import { createJwtPayload } from '../middlewares/rbac.js'
import { logAudit } from '../services/auditService.js'
import {
  buildVerificationStatus,
  getUserFromVerificationToken,
  isAccountVerified,
  issueVerificationCodes,
  signVerificationToken
} from '../services/accountVerificationService.js'
import { checkPhoneVerification, isTwilioVerifyConfigured } from '../services/twilioVerifyService.js'

const issueLoginToken = (user) =>
  jwt.sign(createJwtPayload({ id: user._id, role: 'patient', email: user.email }), process.env.JWT_SECRET)

export const getAccountVerificationStatus = async (req, res) => {
  try {
    const { verificationToken } = req.body
    const user = await getUserFromVerificationToken(verificationToken)
    if (!user) {
      return res.json({ success: false, message: 'Verification session expired. Please sign in again.' })
    }

    return res.json({
      success: true,
      ...buildVerificationStatus(user)
    })
  } catch (error) {
    console.log(error)
    return res.json({ success: false, message: error.message })
  }
}

export const resendAccountVerificationCodes = async (req, res) => {
  try {
    const { verificationToken, channel } = req.body
    const user = await getUserFromVerificationToken(verificationToken)
    if (!user) {
      return res.json({ success: false, message: 'Verification session expired. Please sign in again.' })
    }

    if (isAccountVerified(user)) {
      return res.json({ success: true, accountVerified: true, token: issueLoginToken(user) })
    }

    const forceEmail = !channel || channel === 'email' || channel === 'both'
    const forcePhone = !channel || channel === 'phone' || channel === 'both'

    const { smsDevMode } = await issueVerificationCodes(user, { forceEmail, forcePhone })
    const fresh = await userModel.findById(user._id)

    return res.json({
      success: true,
      message: 'Verification codes sent',
      smsDevMode: Boolean(smsDevMode),
      ...buildVerificationStatus(fresh)
    })
  } catch (error) {
    console.log(error)
    const message =
      error.code === 'RESEND_COOLDOWN'
        ? error.message
        : error.message || 'Could not send verification codes'
    return res.json({ success: false, message })
  }
}

export const verifyAccountEmail = async (req, res) => {
  try {
    const { verificationToken, code } = req.body
    const user = await getUserFromVerificationToken(verificationToken)
    if (!user) {
      return res.json({ success: false, message: 'Verification session expired. Please sign in again.' })
    }

    if (user.emailVerified) {
      return res.json({ success: true, message: 'Email already verified', ...buildVerificationStatus(user) })
    }

    const otp = String(code || '').trim()
    if (!otp || user.emailVerifyOtp !== otp) {
      return res.json({ success: false, message: 'Invalid email verification code' })
    }
    if (!user.emailVerifyOtpExpireAt || user.emailVerifyOtpExpireAt < Date.now()) {
      return res.json({ success: false, message: 'Email code has expired. Request a new one.' })
    }

    const updates = {
      emailVerified: true,
      emailVerifyOtp: '',
      emailVerifyOtpExpireAt: 0,
      accountVerifiedAt: Date.now()
    }

    await userModel.findByIdAndUpdate(user._id, updates)
    const fresh = await userModel.findById(user._id)

    const payload = {
      success: true,
      message: 'Email verified successfully',
      ...buildVerificationStatus(fresh)
    }
    if (isAccountVerified(fresh)) {
      payload.token = issueLoginToken(fresh)
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

    return res.json(payload)
  } catch (error) {
    console.log(error)
    return res.json({ success: false, message: error.message })
  }
}

export const verifyAccountPhone = async (req, res) => {
  try {
    const { verificationToken, code } = req.body
    const user = await getUserFromVerificationToken(verificationToken)
    if (!user) {
      return res.json({ success: false, message: 'Verification session expired. Please sign in again.' })
    }

    if (user.phoneVerified) {
      return res.json({ success: true, message: 'Phone already verified', ...buildVerificationStatus(user) })
    }

    const otp = String(code || '').trim()
    if (!otp) {
      return res.json({ success: false, message: 'SMS verification code is required' })
    }

    if (isTwilioVerifyConfigured()) {
      const check = await checkPhoneVerification(user.phone, otp)
      if (!check.approved) {
        return res.json({ success: false, message: check.message || 'Invalid SMS verification code' })
      }
    } else {
      if (user.phoneVerifyOtp !== otp) {
        return res.json({ success: false, message: 'Invalid SMS verification code' })
      }
      if (!user.phoneVerifyOtpExpireAt || user.phoneVerifyOtpExpireAt < Date.now()) {
        return res.json({ success: false, message: 'SMS code has expired. Request a new one.' })
      }
    }

    const updates = {
      phoneVerified: true,
      phoneVerifyOtp: '',
      phoneVerifyOtpExpireAt: 0
    }
    if (user.emailVerified) updates.accountVerifiedAt = Date.now()

    await userModel.findByIdAndUpdate(user._id, updates)
    const fresh = await userModel.findById(user._id)

    const payload = {
      success: true,
      message: 'Phone verified successfully',
      ...buildVerificationStatus(fresh)
    }
    if (isAccountVerified(fresh)) {
      payload.token = issueLoginToken(fresh)
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

    return res.json(payload)
  } catch (error) {
    console.log(error)
    return res.json({ success: false, message: error.message })
  }
}
