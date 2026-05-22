import { EGYPT_DIAL_CODE } from '../utils/egyptPhone.js'

const twilioConfigured = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
  )

/** Egyptian stored phone (01…) → E.164 +201… */
export const toE164 = (storedPhone) => {
  const digits = String(storedPhone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('20')) return `+${digits}`
  if (digits.startsWith('0')) return `${EGYPT_DIAL_CODE}${digits.slice(1)}`
  if (digits.startsWith('1')) return `${EGYPT_DIAL_CODE}${digits}`
  return `+${digits}`
}

export const sendSms = async ({ to, body }) => {
  const toE164Number = to.startsWith('+') ? to : toE164(to)
  if (!toE164Number) {
    throw new Error('Invalid phone number for SMS')
  }

  if (!twilioConfigured()) {
    console.log('[SMS dev mode] To:', toE164Number)
    console.log('[SMS dev mode] Message:', body)
    return { delivered: false, devMode: true }
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  const auth = Buffer.from(`${sid}:${token}`).toString('base64')

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ To: toE164Number, From: from, Body: body })
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('Twilio SMS error:', errText)
    throw new Error('Failed to send SMS. Check Twilio configuration.')
  }

  return { delivered: true, devMode: false }
}
