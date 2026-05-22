import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { generateMfaSecret, verifyTotpCode, buildMfaSetupPayload } from '../services/mfaService.js'

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

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

const totpForTest = (secret, timeStep = Math.floor(Date.now() / 1000 / 30)) => {
  const key = base32ToBuffer(secret)
  const counter = Buffer.alloc(8)
  counter.writeUInt32BE(0, 0)
  counter.writeUInt32BE(timeStep, 4)
  const hmac = crypto.createHmac('sha1', key).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(binary % 1000000).padStart(6, '0')
}

describe('mfaService', () => {
  it('generates base32 secret', () => {
    const secret = generateMfaSecret()
    expect(secret.length).toBeGreaterThan(10)
    expect(secret).toMatch(/^[A-Z2-7]+$/)
  })

  it('verifies valid TOTP within time window', () => {
    const secret = generateMfaSecret()
    const code = totpForTest(secret)
    expect(verifyTotpCode(secret, code)).toBe(true)
  })

  it('rejects invalid code format or value', () => {
    const secret = generateMfaSecret()
    expect(verifyTotpCode(secret, 'abc')).toBe(false)
    expect(verifyTotpCode(secret, '000000')).toBe(false)
  })

  it('builds otpauth and QR URLs', () => {
    const secret = generateMfaSecret()
    const payload = buildMfaSetupPayload({ secret, accountName: 'user@test.com' })
    expect(payload.secret).toBe(secret)
    expect(payload.otpauthUrl).toContain('otpauth://totp/')
    expect(payload.qrCodeUrl).toContain('api.qrserver.com')
  })
})
