import { describe, it, expect } from 'vitest'
import { api, loginAdmin, loginDoctor, authHeader } from './helpers/harness.js'
import { testIds } from './helpers/seed.js'
import doctorModel from '../../models/doctorModel.js'

describe('T3.7 Doctor API', () => {
  it('lists doctors publicly', async () => {
    const res = await api().get('/api/doctor/list')
    expect(res.body.success).toBe(true)
    expect(res.body.doctors.length).toBeGreaterThan(0)
  })

  it('public doctor list leaves out private fields but keeps the offer', async () => {
    await doctorModel.updateOne(
      { _id: testIds.doctorId },
      { $set: { promoCode: { code: 'SECRET10', discountType: 'percentage', discountValue: 10, active: true } } }
    )
    const res = await api().get('/api/doctor/list')
    expect(res.body.success).toBe(true)
    const doctor = res.body.doctors.find((d) => String(d._id) === testIds.doctorId)
    expect(doctor).toBeTruthy()
    for (const d of res.body.doctors) {
      expect(d.password).toBeUndefined()
      expect(d.email).toBeUndefined()
      expect(d.mfa).toBeUndefined()
      expect(d.financialCompensation).toBeUndefined()
      expect(d.phone).toBeUndefined()
      expect(d.promoCode?.code).toBeUndefined()
    }
    expect(JSON.stringify(res.body)).not.toContain('SECRET10')
    expect(doctor.promoCode).toMatchObject({ active: true, discountType: 'percentage', discountValue: 10 })
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
