import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { api, loginPatient, loginAdmin, authHeader } from './helpers/harness.js'
import { TEST_PASSWORD, testUsers } from './helpers/seed.js'
import userModel from '../../models/userModel.js'

const totpCode = (secret) => {
  const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const normalized = String(secret).replace(/=+$/g, '').toUpperCase()
  let bits = ''
  for (const char of normalized) {
    const value = base32Alphabet.indexOf(char)
    if (value === -1) continue
    bits += value.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  const key = Buffer.from(bytes)
  const timeStep = Math.floor(Date.now() / 1000 / 30)
  const counter = Buffer.alloc(8)
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

describe('T3.2 Auth', () => {
  it('patient login succeeds with valid credentials', async () => {
    const res = await loginPatient()
    expect(res.body.success).toBe(true)
    expect(res.body.token).toBeTruthy()
  })

  it('rejects wrong password', async () => {
    const res = await api()
      .post('/api/user/login')
      .send({ email: testUsers.patient.email, password: 'WrongPass1!' })
    expect(res.body.success).toBe(false)
  })

  it('rejects inactive patient', async () => {
    const res = await loginPatient(testUsers.inactivePatient.email)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/deactivated/i)
  })

  it('register rejects missing signup verification tokens', async () => {
    const res = await api().post('/api/user/register').send({
      name: 'New User',
      email: 'newuser@test.com',
      password: TEST_PASSWORD,
      phone: '01011112222',
      dob: '1990-01-15',
    })
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/verify your email/i)
  })

  it('admin login succeeds', async () => {
    const token = await loginAdmin()
    expect(token).toBeTruthy()
  })
})

describe('T3.3 MFA (patient)', () => {
  it('enrolls, verifies, and disables MFA', async () => {
    const loginRes = await loginPatient()
    const token = loginRes.body.token

    const setupRes = await api()
      .post('/api/user/mfa/setup')
      .set(authHeader.patient(token))
    expect(setupRes.body.success).toBe(true)
    expect(setupRes.body.setup?.secret).toBeTruthy()

    const secret = setupRes.body.setup.secret
    const enableRes = await api()
      .post('/api/user/mfa/enable')
      .set(authHeader.patient(token))
      .send({ code: totpCode(secret) })
    expect(enableRes.body.success).toBe(true)

    const statusRes = await api()
      .get('/api/user/mfa/status')
      .set(authHeader.patient(token))
    expect(statusRes.body.success).toBe(true)

    const disableRes = await api()
      .post('/api/user/mfa/disable')
      .set(authHeader.patient(token))
      .send({ code: totpCode(secret) })
    expect(disableRes.body.success).toBe(true)

    const user = await userModel.findOne({ email: testUsers.patient.email })
    expect(user.mfa.enabled).toBe(false)
  })
})
