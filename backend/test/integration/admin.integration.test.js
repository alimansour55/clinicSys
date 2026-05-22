import { describe, it, expect } from 'vitest'
import auditLogModel from '../../models/auditLogModel.js'
import { api, loginAdmin, authHeader } from './helpers/harness.js'
import { testIds, testUsers } from './helpers/seed.js'

describe('T3.16 Admin users / doctors / receptionists', () => {
  it('lists doctors, patients, and receptionists', async () => {
    const token = await loginAdmin()
    const headers = authHeader.admin(token)

    const doctors = await api().post('/api/admin/all-doctors').set(headers).send({})
    expect(doctors.body.success).toBe(true)

    const patients = await api().get('/api/admin/patients').set(headers)
    expect(patients.body.success).toBe(true)

    const receptionists = await api().get('/api/admin/receptionists').set(headers)
    expect(receptionists.body.success).toBe(true)
  })

  it('reads patient details by id', async () => {
    const token = await loginAdmin()
    const res = await api()
      .get(`/api/admin/patients/${testIds.patientId}`)
      .set(authHeader.admin(token))
    expect(res.body.success).toBe(true)
    expect(res.body.patient.email).toBe(testUsers.patient.email)
  })
})

describe('T3.17 Admin audit logs', () => {
  it('returns audit log entries', async () => {
    await auditLogModel.create({
      action: 'test.action',
      actorUserId: 'admin@test.com',
      actorRole: 'admin',
      status: 'success',
      metadata: { test: true },
    })

    const token = await loginAdmin()
    const res = await api()
      .get('/api/admin/audit-logs')
      .set(authHeader.admin(token))
    expect(res.body.success).toBe(true)
    expect(res.body.logs.length).toBeGreaterThan(0)
  })
})

describe('T3.18 Admin financial analytics', () => {
  it('returns financial analytics payload', async () => {
    const token = await loginAdmin()
    const res = await api()
      .get('/api/admin/financial-analytics')
      .set(authHeader.admin(token))
    expect(res.body.success).toBe(true)
    expect(res.body.doctors).toBeTruthy()
  })
})
