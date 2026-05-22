import { describe, it, expect } from 'vitest'
import { api, loginAdmin, loginPatient, loginDoctor, loginReceptionist, authHeader } from './helpers/harness.js'
import { testIds } from './helpers/seed.js'

describe('T3.4 RBAC', () => {
  it('patient cannot access admin routes', async () => {
    const res = await loginPatient()
    const r = await api()
      .get('/api/admin/users')
      .set(authHeader.patient(res.body.token))
    expect(r.status).toBe(403)
  })

  it('doctor cannot access admin audit logs', async () => {
    const res = await loginDoctor()
    const r = await api()
      .get('/api/admin/audit-logs')
      .set(authHeader.doctor(res.body.token))
    expect(r.status).toBe(403)
  })

  it('receptionist cannot manage site settings', async () => {
    const res = await loginReceptionist()
    const r = await api()
      .get('/api/admin/site-settings')
      .set(authHeader.receptionist(res.body.token))
    expect(r.status).toBe(403)
  })

  it('patient cannot access doctor dashboard', async () => {
    const res = await loginPatient()
    const r = await api()
      .get('/api/doctor/dashboard')
      .set(authHeader.patient(res.body.token))
    expect(r.status).toBe(403)
  })

  it('admin can list users', async () => {
    const token = await loginAdmin()
    const r = await api().get('/api/admin/users').set(authHeader.admin(token))
    expect(r.body.success).toBe(true)
    expect(Array.isArray(r.body.users)).toBe(true)
  })

  it('doctor can read own profile', async () => {
    const res = await loginDoctor()
    const r = await api()
      .get('/api/doctor/profile')
      .set(authHeader.doctor(res.body.token))
    expect(r.body.success).toBe(true)
    expect(r.body.profileData._id).toBe(testIds.doctorId)
  })
})
