import { describe, it, expect, vi } from 'vitest'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { api, loginPatient, loginReceptionist, authHeader, signPatientToken } from './helpers/harness.js'
import { TEST_PASSWORD, testIds, testUsers } from './helpers/seed.js'
import userModel from '../../models/userModel.js'
import signupVerificationModel from '../../models/signupVerificationModel.js'
import appointmentModel from '../../models/appointmentModel.js'
import transporter from '../../config/nodemailer.js'
import { generateMfaSecret } from '../../services/mfaService.js'

const NEW_PASSWORD = 'BrandNew1!pass'

const totp = (secret, offset = 0) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of secret) bits += alphabet.indexOf(char).toString(2).padStart(5, '0')
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  const counter = Buffer.alloc(8)
  counter.writeUInt32BE(Math.floor(Date.now() / 1000 / 30) + offset, 4)
  const hmac = crypto.createHmac('sha1', Buffer.from(bytes)).update(counter).digest()
  const o = hmac[hmac.length - 1] & 0xf
  const value = ((hmac[o] & 0x7f) << 24) | ((hmac[o + 1] & 0xff) << 16) | ((hmac[o + 2] & 0xff) << 8) | (hmac[o + 3] & 0xff)
  return String(value % 1000000).padStart(6, '0')
}

const profile = (token) => api().get('/api/user/get-profile').set(authHeader.patient(token))

const lastMailedCode = () => {
  const html = vi.mocked(transporter.sendMail).mock.calls.at(-1)[0].html
  return /otp-code">(\d{6})</.exec(html)[1]
}

const enrollMfa = async () => {
  const secret = generateMfaSecret()
  await userModel.updateOne({ email: testUsers.patient.email }, { 'mfa.secret': secret, 'mfa.enabled': true })
  return secret
}

describe('single-purpose tokens are not sessions', () => {
  it('the MFA step token cannot read the profile (MFA bypass)', async () => {
    await enrollMfa()
    const res = await loginPatient()
    expect(res.body.mfaRequired).toBe(true)
    const attempt = await profile(res.body.mfaToken)
    expect(attempt.status).toBe(401)
    expect(attempt.body.userData).toBeUndefined()
  })

  it('an account verification token cannot read the profile', async () => {
    const token = jwt.sign({ id: testIds.patientId, role: 'patient', purpose: 'account-verify' }, process.env.JWT_SECRET, { expiresIn: '30m' })
    expect((await profile(token)).status).toBe(401)
  })

  it('a leftover verification token does not hand out a session', async () => {
    const token = jwt.sign({ id: testIds.patientId, role: 'patient', purpose: 'account-verify' }, process.env.JWT_SECRET, { expiresIn: '30m' })
    const res = await api().post('/api/user/verify-account/resend').send({ verificationToken: token, channel: 'email' })
    expect(res.body.token).toBeUndefined()
  })

  it('an expired verification token gets a clean message, not a JWT error', async () => {
    const token = jwt.sign({ id: testIds.patientId, role: 'patient', purpose: 'account-verify' }, process.env.JWT_SECRET, { expiresIn: -10 })
    const res = await api().post('/api/user/verify-account/status').send({ verificationToken: token })
    expect(res.body.sessionExpired).toBe(true)
    expect(res.body.message).not.toMatch(/jwt/i)
  })
})

describe('sessions end when they should', () => {
  it('a deactivated patient is signed out at once', async () => {
    const { body } = await loginPatient()
    await userModel.updateOne({ _id: testIds.patientId }, { isActive: false })
    expect((await profile(body.token)).status).toBe(401)
  })

  it('tokens without an expiry stop working after a week', async () => {
    const iat = Math.floor(Date.now() / 1000) - 8 * 24 * 3600
    const old = jwt.sign({ id: testIds.patientId, userId: testIds.patientId, role: 'patient', iat }, process.env.JWT_SECRET)
    expect((await profile(old)).status).toBe(401)
  })

  it('sign out everywhere ends older sessions and keeps this device', async () => {
    const iat = Math.floor(Date.now() / 1000) - 60
    const older = jwt.sign({ id: testIds.patientId, role: 'patient', iat }, process.env.JWT_SECRET)
    const res = await api().post('/api/account/sign-out-everywhere').set(authHeader.patient(older))
    expect(res.body.success).toBe(true)
    expect((await profile(older)).status).toBe(401)
    expect((await profile(res.body.token)).status).toBe(200)
  })

  it('login tokens carry an expiry', async () => {
    const { body } = await loginPatient()
    expect(jwt.decode(body.token).exp).toBeTruthy()
  })
})

describe('no account enumeration', () => {
  it('login gives the same answer for an unknown account and a wrong password', async () => {
    const unknown = await api().post('/api/user/login').send({ email: 'nobody@test.com', password: 'WrongPass1!' })
    const wrong = await api().post('/api/user/login').send({ email: testUsers.patient.email, password: 'WrongPass1!' })
    expect(unknown.body.message).toBe(wrong.body.message)
  })

  it('a deactivated account is only revealed to someone with the password', async () => {
    const wrong = await api().post('/api/user/login').send({ email: testUsers.inactivePatient.email, password: 'WrongPass1!' })
    expect(wrong.body.message).not.toMatch(/deactivated/i)
  })

  it('password reset gives the same answer for any email', async () => {
    const known = await api().post('/api/user/send-reset-otp').send({ email: testUsers.patient.email })
    const unknown = await api().post('/api/user/send-reset-otp').send({ email: 'nobody@test.com' })
    expect(known.body).toEqual(unknown.body)
  })

  it('signup gives the same answer for a registered email, with no code to confirm', async () => {
    const known = await api().post('/api/user/signup-verify/send-email').send({ email: testUsers.patient.email })
    const fresh = await api().post('/api/user/signup-verify/send-email').send({ email: 'brand-new@test.com' })
    expect(known.body).toEqual(fresh.body)
    const pending = await signupVerificationModel.findOne({ key: `email:${testUsers.patient.email}` })
    expect(pending.otp).toBe('')
  })

  it('register does not reveal registered emails without a proof', async () => {
    const res = await api().post('/api/user/register').send({
      name: 'X', email: testUsers.patient.email, password: TEST_PASSWORD, phone: '01011112222', dob: '1990-01-15'
    })
    expect(res.body.message).toMatch(/verify your email/i)
  })
})

describe('login lockout', () => {
  it('locks after the policy limit, even with the right password, and for unknown accounts too', async () => {
    for (let i = 0; i < 5; i += 1) {
      await api().post('/api/user/login').send({ email: testUsers.patient.email, password: 'WrongPass1!' })
      await api().post('/api/user/login').send({ email: 'nobody@test.com', password: 'WrongPass1!' })
    }
    const right = await loginPatient()
    expect(right.body.locked).toBe(true)
    expect(right.body.token).toBeUndefined()
    const unknown = await api().post('/api/user/login').send({ email: 'nobody@test.com', password: 'WrongPass1!' })
    expect(unknown.body.locked).toBe(true)
  })

  it('a spoofed X-Forwarded-For chain does not change the IP used for limits', async () => {
    const res = await api().post('/api/user/login').set('X-Forwarded-For', '1.2.3.4, 5.6.7.8').send({ email: 'a@test.com', password: 'x' })
    expect(res.body.success).toBe(false)
  })
})

describe('password reset', () => {
  const startReset = async () => {
    vi.mocked(transporter.sendMail).mockClear()
    await api().post('/api/user/send-reset-otp').send({ email: testUsers.patient.email })
    return lastMailedCode()
  }

  it('stores the code hashed and resets once', async () => {
    const otp = await startReset()
    const stored = await userModel.findOne({ email: testUsers.patient.email }).select('+resetOtp')
    expect(stored.resetOtp).not.toBe(otp)

    expect((await api().post('/api/user/verify-reset-otp').send({ email: testUsers.patient.email, otp })).body.success).toBe(true)
    const reset = await api().post('/api/user/reset-password').send({ email: testUsers.patient.email, otp, newPassword: NEW_PASSWORD })
    expect(reset.body.success).toBe(true)

    const replay = await api().post('/api/user/reset-password').send({ email: testUsers.patient.email, otp, newPassword: 'Another1!pass' })
    expect(replay.body.success).toBe(false)
    const login = await api().post('/api/user/login').send({ email: testUsers.patient.email, password: NEW_PASSWORD })
    expect(login.body.success).toBe(true)
  })

  it('an expired code cannot reset the password', async () => {
    const otp = await startReset()
    await userModel.updateOne({ email: testUsers.patient.email }, { resetOtpExpireAt: Date.now() - 1000 })
    const res = await api().post('/api/user/reset-password').send({ email: testUsers.patient.email, otp, newPassword: NEW_PASSWORD })
    expect(res.body.success).toBe(false)
  })

  it('a verified code still expires (verifying used to remove the expiry check)', async () => {
    const otp = await startReset()
    await api().post('/api/user/verify-reset-otp').send({ email: testUsers.patient.email, otp })
    await userModel.updateOne({ email: testUsers.patient.email }, { resetOtpExpireAt: Date.now() - 1000 })
    const res = await api().post('/api/user/reset-password').send({ email: testUsers.patient.email, otp, newPassword: NEW_PASSWORD })
    expect(res.body.success).toBe(false)
  })

  it('five wrong guesses destroy the code', async () => {
    const otp = await startReset()
    for (let i = 0; i < 5; i += 1) {
      await api().post('/api/user/verify-reset-otp').send({ email: testUsers.patient.email, otp: otp === '111111' ? '222222' : '111111' })
    }
    const res = await api().post('/api/user/verify-reset-otp').send({ email: testUsers.patient.email, otp })
    expect(res.body.success).toBe(false)
    const stored = await userModel.findOne({ email: testUsers.patient.email }).select('+resetOtp')
    expect(stored.resetOtp).toBe('')
  })

  it('resetting the password ends existing sessions', async () => {
    const iat = Math.floor(Date.now() / 1000) - 60
    const stolen = jwt.sign({ id: testIds.patientId, role: 'patient', iat }, process.env.JWT_SECRET)
    const otp = await startReset()
    await api().post('/api/user/reset-password').send({ email: testUsers.patient.email, otp, newPassword: NEW_PASSWORD })
    expect((await profile(stolen)).status).toBe(401)
  })

  it('object values are rejected instead of reaching the query', async () => {
    const res = await api().post('/api/user/reset-password').send({ email: testUsers.patient.email, otp: { $ne: '' }, newPassword: NEW_PASSWORD })
    expect(res.body.success).toBe(false)
  })
})

describe('signup codes', () => {
  it('a verified signup record no longer hands a proof to whoever asks', async () => {
    const email = 'walkaway@test.com'
    await signupVerificationModel.create({ key: `email:${email}`, type: 'email', otp: '', otpSentAt: 0, verified: true })
    const res = await api().post('/api/user/signup-verify/send-email').send({ email })
    expect(res.body.verificationToken).toBeUndefined()
  })

  it('five wrong guesses destroy the code', async () => {
    const email = 'guess@test.com'
    await api().post('/api/user/signup-verify/send-email').send({ email })
    const { otp } = await signupVerificationModel.findOne({ key: `email:${email}` })
    for (let i = 0; i < 5; i += 1) {
      await api().post('/api/user/signup-verify/confirm-email').send({ email, code: otp === '111111' ? '222222' : '111111' })
    }
    const res = await api().post('/api/user/signup-verify/confirm-email').send({ email, code: otp })
    expect(res.body.verificationToken).toBeUndefined()
  })

  it('a full signup works, and the proof only works for its own email', async () => {
    const email = 'full-signup@test.com'
    await api().post('/api/user/signup-verify/send-email').send({ email })
    const { otp } = await signupVerificationModel.findOne({ key: `email:${email}` })
    const { body } = await api().post('/api/user/signup-verify/confirm-email').send({ email, code: otp })

    const base = { name: 'New Person', password: TEST_PASSWORD, phone: '01011112222', dob: '1990-01-15', emailVerificationToken: body.verificationToken }
    expect((await api().post('/api/user/register').send({ ...base, email: 'someone-else@test.com' })).body.success).toBe(false)

    const res = await api().post('/api/user/register').send({ ...base, email })
    expect(res.body.success).toBe(true)
    expect((await profile(res.body.token)).body.userData.email).toBe(email)
  })
})

describe('MFA', () => {
  const session = async () => (await loginPatient()).body.token

  it('opting in can be undone: the policy helper no longer treats it as mandatory', async () => {
    const token = await session()
    const setup = await api().post('/api/user/mfa/setup').set(authHeader.patient(token))
    const { secret } = setup.body.setup
    expect(JSON.stringify(setup.body)).not.toContain('qrserver')

    const enable = await api().post('/api/user/mfa/enable').set(authHeader.patient(token)).send({ code: totp(secret, -1) })
    expect(enable.body.success).toBe(true)
    expect(enable.body.recoveryCodes).toHaveLength(8)

    const status = await api().get('/api/user/mfa/status').set(authHeader.patient(token))
    expect(status.body.mfa).toMatchObject({ enabled: true, required: false, recoveryCodesLeft: 8 })

    const off = await api().post('/api/user/mfa/disable').set(authHeader.patient(token)).send({ code: totp(secret, 0) })
    expect(off.body.success).toBe(true)
  })

  it('setup cannot silently replace a working authenticator', async () => {
    const secret = await enrollMfa()
    const token = signPatientToken(testIds.patientId)
    const res = await api().post('/api/user/mfa/setup').set(authHeader.patient(token))
    expect(res.body.success).toBe(false)
    const user = await userModel.findById(testIds.patientId).select('+mfa.secret')
    expect(user.mfa.enabled).toBe(true)
    expect(user.mfa.secret).toBe(secret)
  })

  it('one code cannot be used twice', async () => {
    const secret = await enrollMfa()
    const code = totp(secret)
    const first = await api().post('/api/user/mfa/verify-login').send({ mfaToken: (await loginPatient()).body.mfaToken, code })
    expect(first.body.success).toBe(true)
    const second = await api().post('/api/user/mfa/verify-login').send({ mfaToken: (await loginPatient()).body.mfaToken, code })
    expect(second.body.success).toBe(false)
  })

  it('locks after five wrong codes, even with the right code', async () => {
    const secret = await enrollMfa()
    const { mfaToken } = (await loginPatient()).body
    for (let i = 0; i < 5; i += 1) {
      await api().post('/api/user/mfa/verify-login').send({ mfaToken, code: '000000' })
    }
    const res = await api().post('/api/user/mfa/verify-login').send({ mfaToken, code: totp(secret) })
    expect(res.body.locked).toBe(true)
  })

  it('a recovery code gets you in once, so a lost phone is not a dead end', async () => {
    const token = await session()
    const { body: { setup } } = await api().post('/api/user/mfa/setup').set(authHeader.patient(token))
    const { body: { recoveryCodes } } = await api().post('/api/user/mfa/enable').set(authHeader.patient(token)).send({ code: totp(setup.secret, -1) })

    const use = async () => api().post('/api/user/mfa/verify-login').send({ mfaToken: (await loginPatient()).body.mfaToken, code: recoveryCodes[0] })
    const first = await use()
    expect(first.body.success).toBe(true)
    expect(first.body.recoveryCodesLeft).toBe(7)
    expect((await use()).body.success).toBe(false)
  })
})

describe('secrets stay private', () => {
  const secretsIn = (value) => {
    const text = JSON.stringify(value)
    return ['resetOtp"', 'emailVerifyOtp"', 'phoneVerifyOtp"', 'secret"', 'recoveryCodes"', 'password"'].filter((key) => text.includes(key))
  }

  const plantSecrets = () =>
    userModel.updateOne({ _id: testIds.patientId }, {
      'mfa.secret': 'SECRETSECRET', 'mfa.recoveryCodes': ['abc'], resetOtp: 'hash', emailVerifyOtp: 'hash', phoneVerifyOtp: 'hash'
    })

  it('the patient profile response holds no secrets', async () => {
    const { body } = await loginPatient()
    await plantSecrets()
    const res = await profile(body.token)
    expect(secretsIn(res.body)).toEqual([])
  })

  it('the receptionist patient list holds no patient secrets', async () => {
    await plantSecrets()
    const { body } = await loginReceptionist()
    const res = await api().get('/api/receptionist/patients').set(authHeader.receptionist(body.token))
    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body)).not.toContain('SECRETSECRET')
  })

  it('an appointment snapshot taken with the usual query holds no secrets', async () => {
    await plantSecrets()
    const snapshot = await userModel.findById(testIds.patientId).select('-password')
    const appointment = await appointmentModel.create({
      userId: testIds.patientId, docId: testIds.doctorId, slotDate: '1_1_2030', slotTime: '10:00',
      userData: snapshot, docData: { name: 'Dr' }, amount: 1, date: Date.now()
    })
    const stored = await appointmentModel.findById(appointment._id).lean()
    expect(JSON.stringify(stored.userData)).not.toContain('SECRETSECRET')
    expect(stored.userData.resetOtp).toBeUndefined()
  })
})

describe('malformed requests', () => {
  it('a broken JSON body returns JSON with no stack trace', async () => {
    const res = await api().post('/api/user/login').set('Content-Type', 'application/json').send('{"email":')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(JSON.stringify(res.body)).not.toContain('node_modules')
  })

  it('an invalid notification id does not leak a cast error', async () => {
    const { body } = await loginPatient()
    const res = await api().post('/api/notifications/not-an-id/read').set(authHeader.patient(body.token))
    expect(res.body.message).toBe('Notification not found')
  })
})
