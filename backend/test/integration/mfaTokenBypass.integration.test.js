import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { api, loginDoctor, authHeader } from './helpers/harness.js'
import { testIds, testUsers } from './helpers/seed.js'
import doctorModel from '../../models/doctorModel.js'
import { authenticateRole, authenticateAny } from '../../middlewares/rbac.js'
import { generateMfaSecret } from '../../services/mfaService.js'

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

const signPurposeToken = (payload, purpose) =>
  jwt.sign({ ...payload, purpose }, process.env.JWT_SECRET, { expiresIn: '10m' })

const purposeCases = () => [
  { role: 'patient', header: 'token', purpose: 'patient-mfa', id: testIds.patientId, route: '/api/user/get-profile' },
  { role: 'patient', header: 'token', purpose: 'patient-mfa-setup', id: testIds.patientId, route: '/api/user/get-profile' },
  { role: 'doctor', header: 'dtoken', purpose: 'doctor-mfa', id: testIds.doctorId, route: '/api/doctor/profile' },
  { role: 'doctor', header: 'dtoken', purpose: 'doctor-mfa-setup', id: testIds.doctorId, route: '/api/doctor/profile' },
  { role: 'receptionist', header: 'rtoken', purpose: 'receptionist-mfa', id: testIds.receptionistId, route: '/api/receptionist/profile' },
  { role: 'receptionist', header: 'rtoken', purpose: 'receptionist-mfa-setup', id: testIds.receptionistId, route: '/api/receptionist/profile' },
]

/** App with only the auth middleware, so the check in rbac.js is tested without the global session guard. */
const middlewareOnlyApp = () => {
  const app = express()
  app.get('/patient', authenticateRole('patient'), (req, res) => res.json({ success: true }))
  app.get('/doctor', authenticateRole('doctor'), (req, res) => res.json({ success: true }))
  app.get('/receptionist', authenticateRole('receptionist'), (req, res) => res.json({ success: true }))
  app.get('/admin', authenticateRole('admin'), (req, res) => res.json({ success: true }))
  app.get('/any', authenticateAny, (req, res) => res.json({ success: true }))
  return app
}

describe('pre-MFA tokens are not login tokens', () => {
  it('every role route refuses a token that carries a purpose', async () => {
    for (const c of purposeCases()) {
      const token = signPurposeToken({ id: c.id, role: c.role }, c.purpose)
      const res = await api().get(c.route).set({ [c.header]: token })
      expect(res.status, `${c.purpose} on ${c.route}`).toBe(401)
      expect(res.body.success).toBe(false)
    }
  })

  it('the admin MFA step token cannot reach admin routes', async () => {
    const token = signPurposeToken({ id: process.env.ADMIN_EMAIL, role: 'admin', email: process.env.ADMIN_EMAIL }, 'admin-mfa')
    const res = await api().get('/api/admin/users').set(authHeader.admin(token))
    expect(res.status).toBe(401)
  })

  it('authenticateRole and authenticateAny refuse purpose tokens on their own', async () => {
    const app = middlewareOnlyApp()
    for (const c of purposeCases()) {
      const token = signPurposeToken({ id: c.id, role: c.role }, c.purpose)
      expect((await request(app).get(`/${c.role}`).set({ [c.header]: token })).status, c.purpose).toBe(401)
      expect((await request(app).get('/any').set({ [c.header]: token })).status, `${c.purpose} on any`).toBe(401)
    }
    const adminToken = signPurposeToken({ id: process.env.ADMIN_EMAIL, role: 'admin' }, 'admin-mfa-setup')
    expect((await request(app).get('/admin').set({ atoken: adminToken })).status).toBe(401)
  })

  it('a normal session token still passes the middleware', async () => {
    const app = middlewareOnlyApp()
    const token = jwt.sign({ id: testIds.doctorId, userId: testIds.doctorId, role: 'doctor' }, process.env.JWT_SECRET)
    expect((await request(app).get('/doctor').set({ dtoken: token })).status).toBe(200)
    expect((await request(app).get('/any').set({ dtoken: token })).status).toBe(200)
  })

  it('the doctor MFA verify endpoint still exchanges the step token for a session', async () => {
    const secret = generateMfaSecret()
    await doctorModel.updateOne({ email: testUsers.doctor.email }, { 'mfa.secret': secret, 'mfa.enabled': true })

    const login = await loginDoctor()
    expect(login.body.mfaRequired).toBe(true)
    expect((await api().get('/api/doctor/profile').set(authHeader.doctor(login.body.mfaToken))).status).toBe(401)

    const verify = await api().post('/api/doctor/mfa/verify-login').send({ mfaToken: login.body.mfaToken, code: totp(secret) })
    expect(verify.body.success).toBe(true)

    const profile = await api().get('/api/doctor/profile').set(authHeader.doctor(verify.body.token))
    expect(profile.body.success).toBe(true)
    expect(profile.body.profileData._id).toBe(testIds.doctorId)
  })
})
