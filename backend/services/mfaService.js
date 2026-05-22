import crypto from 'crypto'

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

const generateMfaSecret = () => {
  const bytes = crypto.randomBytes(20)
  let bits = ''
  let output = ''

  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0')
  for (let index = 0; index < bits.length; index += 5) {
    output += base32Alphabet[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)]
  }

  return output
}

const base32ToBuffer = (secret = '') => {
  const normalized = String(secret).replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase()
  let bits = ''
  for (const char of normalized) {
    const value = base32Alphabet.indexOf(char)
    if (value === -1) continue
    bits += value.toString(2).padStart(5, '0')
  }

  const bytes = []
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2))
  }

  return Buffer.from(bytes)
}

const generateTotpCode = (secret, timeStep = Math.floor(Date.now() / 1000 / 30)) => {
  const key = base32ToBuffer(secret)
  const counter = Buffer.alloc(8)
  counter.writeUInt32BE(0, 0)
  counter.writeUInt32BE(timeStep, 4)

  const hmac = crypto.createHmac('sha1', key).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const binary = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff)

  return String(binary % 1000000).padStart(6, '0')
}

const verifyTotpCode = (secret, code, window = 1) => {
  const normalizedCode = String(code || '').replace(/\s+/g, '')
  if (!/^\d{6}$/.test(normalizedCode)) return false

  const currentStep = Math.floor(Date.now() / 1000 / 30)
  for (let offset = -window; offset <= window; offset += 1) {
    if (generateTotpCode(secret, currentStep + offset) === normalizedCode) return true
  }

  return false
}

const buildOtpAuthUrl = ({ secret, accountName, issuer = 'ClinicSys' }) => {
  const label = encodeURIComponent(`${issuer}:${accountName}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  })

  return `otpauth://totp/${label}?${params.toString()}`
}

const buildQrCodeUrl = (otpauthUrl) => {
  const params = new URLSearchParams({
    size: '420x420',
    margin: '24',
    data: otpauthUrl
  })

  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`
}

const buildMfaSetupPayload = ({ secret, accountName }) => {
  const otpauthUrl = buildOtpAuthUrl({ secret, accountName })

  return {
    secret,
    otpauthUrl,
    qrCodeUrl: buildQrCodeUrl(otpauthUrl)
  }
}

export { buildMfaSetupPayload, generateMfaSecret, verifyTotpCode }
