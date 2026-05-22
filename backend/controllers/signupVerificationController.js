import {
  confirmSignupEmailVerification,
  confirmSignupPhoneVerification,
  sendSignupEmailVerification,
  sendSignupPhoneVerification
} from '../services/signupVerificationService.js'

const handleError = (res, error) => {
  console.log(error)
  const message = error.code === 'RESEND_COOLDOWN' ? error.message : error.message || 'Request failed'
  return res.json({ success: false, message })
}

export const sendSignupEmailCode = async (req, res) => {
  try {
    const { email } = req.body
    const result = await sendSignupEmailVerification(email)
    return res.json({ success: true, ...result })
  } catch (error) {
    return handleError(res, error)
  }
}

export const confirmSignupEmailCode = async (req, res) => {
  try {
    const { email, code } = req.body
    const result = await confirmSignupEmailVerification(email, code)
    return res.json({ success: true, ...result })
  } catch (error) {
    return handleError(res, error)
  }
}

export const sendSignupPhoneCode = async (req, res) => {
  try {
    const { phone } = req.body
    const result = await sendSignupPhoneVerification(phone)
    return res.json({ success: true, ...result })
  } catch (error) {
    return handleError(res, error)
  }
}

export const confirmSignupPhoneCode = async (req, res) => {
  try {
    const { phone, code } = req.body
    const result = await confirmSignupPhoneVerification(phone, code)
    return res.json({ success: true, ...result })
  } catch (error) {
    return handleError(res, error)
  }
}
