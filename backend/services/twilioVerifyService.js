import { toE164 } from './smsService.js'

export const isTwilioVerifyConfigured = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_VERIFY_SERVICE_SID
  )

const verifyBaseUrl = () =>
  `https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}`

const twilioAuthHeader = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`
}

const twilioFetch = async (path, body) => {
  const response = await fetch(`${verifyBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: twilioAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(body)
  })

  const data = await response.json()
  if (!response.ok) {
    const message = data.message || data.error_message || 'Twilio Verify request failed'
    console.error('Twilio Verify error:', data)
    throw new Error(message)
  }
  return data
}

/** Send OTP via Twilio Verify (SMS). */
export const startPhoneVerification = async (phone) => {
  const to = toE164(phone)
  if (!to) throw new Error('Invalid phone number for SMS verification')

  const data = await twilioFetch('/Verifications', {
    To: to,
    Channel: 'sms'
  })

  return { to, status: data.status, devMode: false }
}

/** Validate OTP with Twilio Verify. */
export const checkPhoneVerification = async (phone, code) => {
  const to = toE164(phone)
  const otp = String(code || '').trim()
  if (!to || !otp) return { approved: false, message: 'Phone and code are required' }

  try {
    const data = await twilioFetch('/VerificationCheck', {
      To: to,
      Code: otp
    })
    return {
      approved: data.status === 'approved',
      status: data.status,
      message: data.status === 'approved' ? 'approved' : 'Invalid or expired SMS code'
    }
  } catch (error) {
    return { approved: false, message: error.message }
  }
}
