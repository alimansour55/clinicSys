/** Microsoft OAuth2 for Outlook / Hotmail SMTP (Modern Auth). */

const DEFAULT_TENANT = 'common'
const SMTP_SCOPE = 'https://outlook.office.com/SMTP.Send offline_access openid profile email'

export const getMicrosoftOAuthConfig = () => ({
  tenant: process.env.MICROSOFT_TENANT || DEFAULT_TENANT,
  clientId: process.env.MICROSOFT_CLIENT_ID || '',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  refreshToken: process.env.MICROSOFT_REFRESH_TOKEN || '',
  user: process.env.SENDER_EMAIL || ''
})

export const isMicrosoftOAuthConfigured = () => {
  const { clientId, refreshToken, user } = getMicrosoftOAuthConfig()
  return Boolean(clientId && refreshToken && user)
}

const tokenEndpoint = (tenant) =>
  `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`

const deviceCodeEndpoint = (tenant) =>
  `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/devicecode`

export const requestDeviceCode = async () => {
  const { tenant, clientId } = getMicrosoftOAuthConfig()
  if (!clientId) {
    throw new Error('MICROSOFT_CLIENT_ID is missing in backend/.env')
  }

  const body = new URLSearchParams({
    client_id: clientId,
    scope: SMTP_SCOPE
  })

  const response = await fetch(deviceCodeEndpoint(tenant), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Device code request failed')
  }
  return data
}

export const pollDeviceCodeToken = async (deviceCode) => {
  const { tenant, clientId, clientSecret } = getMicrosoftOAuthConfig()
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    client_id: clientId,
    device_code: deviceCode
  })
  if (clientSecret) body.set('client_secret', clientSecret)

  const response = await fetch(tokenEndpoint(tenant), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  const data = await response.json()
  if (!response.ok) {
    if (data.error === 'authorization_pending') {
      return { pending: true }
    }
    if (data.error === 'slow_down') {
      return { pending: true, slowDown: true }
    }
    throw new Error(data.error_description || data.error || 'Token request failed')
  }

  return { pending: false, ...data }
}

export const refreshMicrosoftAccessToken = async () => {
  const { tenant, clientId, clientSecret, refreshToken } = getMicrosoftOAuthConfig()
  if (!clientId || !refreshToken) {
    throw new Error('Microsoft OAuth is not configured (CLIENT_ID / REFRESH_TOKEN)')
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: SMTP_SCOPE
  })
  if (clientSecret) body.set('client_secret', clientSecret)

  const response = await fetch(tokenEndpoint(tenant), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Failed to refresh Microsoft access token')
  }
  return data.access_token
}
