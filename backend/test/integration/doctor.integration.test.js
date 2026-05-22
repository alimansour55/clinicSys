import { describe, it, expect } from 'vitest'
import { api, loginAdmin, loginDoctor, authHeader } from './helpers/harness.js'
import { testIds } from './helpers/seed.js'

describe('T3.7 Doctor API', () => {
  it('lists doctors publicly', async () => {
    const res = await api().get('/api/doctor/list')
    expect(res.body.success).toBe(true)
    expect(res.body.doctors.length).toBeGreaterThan(0)
  })

  it('doctor profile requires auth', async () => {
    const res = await api().get('/api/doctor/profile')
    expect(res.status).toBe(401)
  })

  it('authenticated doctor reads profile', async () => {
    const loginRes = await loginDoctor()
    const res = await api()
      .get('/api/doctor/profile')
      .set(authHeader.doctor(loginRes.body.token))
    expect(res.body.success).toBe(true)
    expect(res.body.profileData.email).toBeTruthy()
  })

  it('admin toggles doctor availability', async () => {
    const token = await loginAdmin()
    const res = await api()
      .post('/api/admin/change-availability')
      .set(authHeader.admin(token))
      .send({ docId: testIds.doctorId, available: false })
    expect(res.body.success).toBe(true)
    expect(res.body.available).toBe(false)
  })
})
