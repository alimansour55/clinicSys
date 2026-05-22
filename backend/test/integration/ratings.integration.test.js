import { describe, it, expect } from 'vitest'
import appointmentModel from '../../models/appointmentModel.js'
import { api, loginPatient, authHeader } from './helpers/harness.js'
import { testIds } from './helpers/seed.js'

describe('T3.13 Ratings', () => {
  it('lists public doctor ratings', async () => {
    const res = await api().get(`/api/user/doctor-ratings/${testIds.doctorId}`)
    expect(res.body.success).toBe(true)
  })

  it('rejects rating before appointment finished', async () => {
    const loginRes = await loginPatient()
    const apt = await appointmentModel.create({
      userId: testIds.patientId,
      docId: testIds.doctorId,
      slotDate: '1_1_2030',
      slotTime: '10:00',
      amount: 100,
      appointmentStatus: 'Booked',
      isCompleted: false,
      cancelled: false,
      userData: { name: 'Test Patient' },
      docData: { name: 'Dr Test' },
      date: Date.now(),
    })

    const res = await api()
      .post('/api/user/ratings')
      .set(authHeader.patient(loginRes.body.token))
      .send({ appointmentId: String(apt._id), rating: 5, comment: 'Great' })

    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/finished/i)
  })

  it('creates rating for finished appointment', async () => {
    const loginRes = await loginPatient()
    const apt = await appointmentModel.create({
      userId: testIds.patientId,
      docId: testIds.doctorId,
      slotDate: '2_1_2030',
      slotTime: '11:00',
      amount: 100,
      appointmentStatus: 'Finished',
      isCompleted: true,
      cancelled: false,
      userData: { name: 'Test Patient' },
      docData: { name: 'Dr Test' },
      date: Date.now(),
    })

    const res = await api()
      .post('/api/user/ratings')
      .set(authHeader.patient(loginRes.body.token))
      .send({ appointmentId: String(apt._id), rating: 4 })

    expect(res.body.success).toBe(true)

    const dup = await api()
      .post('/api/user/ratings')
      .set(authHeader.patient(loginRes.body.token))
      .send({ appointmentId: String(apt._id), rating: 5 })
    expect(dup.body.success).toBe(false)
    expect(dup.body.message).toMatch(/already rated/i)
  })
})
