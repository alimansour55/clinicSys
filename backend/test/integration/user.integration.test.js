import { describe, it, expect, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { api, loginPatient, authHeader } from './helpers/harness.js'
import { testUsers, testIds } from './helpers/seed.js'
import signupVerificationModel from '../../models/signupVerificationModel.js'

describe('T3.5 User profile + account verification', () => {
  it('returns patient profile', async () => {
    const loginRes = await loginPatient()
    const res = await api()
      .get('/api/user/get-profile')
      .set(authHeader.patient(loginRes.body.token))
    expect(res.body.success).toBe(true)
    expect(res.body.userData.email).toBe(testUsers.patient.email)
  })

  it('account verification status for verified patient', async () => {
    const token = jwt.sign(
      { id: testIds.patientId, role: 'patient', purpose: 'account-verify' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    )
    const res = await api()
      .post('/api/user/verify-account/status')
      .send({ verificationToken: token })
    expect(res.body.success).toBe(true)
    expect(res.body.accountVerified).toBe(true)
  })
})

describe('T3.6 Signup verification (mocked mail/SMS)', () => {
  it('sends and confirms email signup code', async () => {
    const email = 'signup-new@test.com'
    const sendRes = await api().post('/api/user/signup-verify/send-email').send({ email })
    expect(sendRes.body.message).toBeTruthy()

    const pending = await signupVerificationModel.findOne({ key: `email:${email}` })
    expect(pending?.otp).toMatch(/^\d{6}$/)

    const confirmRes = await api()
      .post('/api/user/signup-verify/confirm-email')
      .send({ email, code: pending.otp })
    expect(confirmRes.body.verificationToken).toBeTruthy()
    expect(confirmRes.body.message).toMatch(/verified/i)
  })

  it('send phone signup code in dev mode', async () => {
    const res = await api()
      .post('/api/user/signup-verify/send-phone')
      .send({ phone: '01055556666' })
    expect(res.body.message).toBeTruthy()
    expect(res.body.smsDevMode).toBe(true)
  })
})
