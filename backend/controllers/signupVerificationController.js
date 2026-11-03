import { clientIp } from '../services/authThrottleService.js'
import {
  confirmSignupEmailVerification,
  confirmSignupPhoneVerification,
  sendSignupEmailVerification,
  sendSignupPhoneVerification
} from '../services/signupVerificationService.js'

const handleError = (res, error) => {
  // Errors raised on purpose carry a code or status. Anything else is internal and stays out of the response.
  const expected = error.code === 'RESEND_COOLDOWN' || error.statusCode
  if (!expected) console.error('Signup verification:', error.message)
  return res.json({ success: false, message: expected ? error.message : 'Something went wrong. Please try again.' })
}

export const sendSignupEmailCode = async (req, res) => {
  try {
    const result = await sendSignupEmailVerification(req.body?.email, { ip: clientIp(req) })
    return res.json({ success: true, ...result })
  } catch (error) {
    return handleError(res, error)
  }
}

export const confirmSignupEmailCode = async (req, res) => {
  try {
    const { email, code } = req.body || {}
    const result = await confirmSignupEmailVerification(email, code)
    return res.json({ success: true, ...result })
  } catch (error) {
    return handleError(res, error)
  }
}

export const sendSignupPhoneCode = async (req, res) => {
  try {
    const result = await sendSignupPhoneVerification(req.body?.phone, { ip: clientIp(req) })
    return res.json({ success: true, ...result })
  } catch (error) {
    return handleError(res, error)
  }
}

export const confirmSignupPhoneCode = async (req, res) => {
  try {
    const { phone, code } = req.body || {}
    const result = await confirmSignupPhoneVerification(phone, code)
    return res.json({ success: true, ...result })
  } catch (error) {
    return handleError(res, error)
  }
}
