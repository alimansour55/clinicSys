/**
 * One-time setup: obtain MICROSOFT_REFRESH_TOKEN for Hotmail/Outlook SMTP.
 *
 * Prerequisites (Azure Portal → App registrations):
 * 1. New app → Supported accounts: "Personal Microsoft accounts only" (or multi-tenant + personal)
 * 2. Authentication → Allow public client flows: Yes (for device code)
 * 3. Copy Application (client) ID → MICROSOFT_CLIENT_ID in backend/.env
 * 4. Optional: Certificates & secrets → client secret → MICROSOFT_CLIENT_SECRET
 *
 * Run from backend folder:
 *   node scripts/microsoft-oauth-device.js
 */
import '../config/env.js'
import {
  getMicrosoftOAuthConfig,
  pollDeviceCodeToken,
  requestDeviceCode
} from '../services/microsoftOAuthService.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const main = async () => {
  const { clientId, user } = getMicrosoftOAuthConfig()
  if (!clientId) {
    console.error('Set MICROSOFT_CLIENT_ID in backend/.env first.')
    process.exit(1)
  }
  if (!user) {
    console.error('Set SENDER_EMAIL=mans.nesr55@hotmail.com in backend/.env first.')
    process.exit(1)
  }

  console.log('\nMicrosoft OAuth setup (SMTP send)\n')
  console.log('Sign in as:', user)
  console.log('---')

  const device = await requestDeviceCode()
  console.log(device.message)
  console.log('\nOpen:', device.verification_uri)
  console.log('Code:', device.user_code)
  console.log('\nWaiting for approval...\n')

  let interval = (device.interval || 5) * 1000
  const deadline = Date.now() + (device.expires_in || 900) * 1000

  while (Date.now() < deadline) {
    const result = await pollDeviceCodeToken(device.device_code)
    if (result.pending) {
      if (result.slowDown) interval += 5000
      await sleep(interval)
      continue
    }

    console.log('\nSuccess! Add this to backend/.env:\n')
    console.log(`MICROSOFT_REFRESH_TOKEN=${result.refresh_token}`)
    console.log('\nThen remove APP_PASSWORD (not used with OAuth) and restart the backend.\n')
    process.exit(0)
  }

  console.error('Device code expired. Run the script again.')
  process.exit(1)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
