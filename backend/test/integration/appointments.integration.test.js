import { describe, it, expect } from 'vitest'
import appointmentModel from '../../models/appointmentModel.js'
import userModel from '../../models/userModel.js'
import { api, loginPatient, loginDoctor, loginAdmin, loginReceptionist, authHeader, futureBookingSlot } from './helpers/harness.js'
import { testIds } from './helpers/seed.js'

describe('T3.9 Appointments', () => {
  it('patient books, lists, and cancels clinic appointment', async () => {
    const loginRes = await loginPatient()
    const token = loginRes.body.token
    const { slotDate, slotTime } = futureBookingSlot(2)

    const bookRes = await api()
      .post('/api/user/book-appointment')
      .set(authHeader.patient(token))
      .send({
        docId: testIds.doctorId,
        slotDate,
        slotTime,
        paymentMethod: 'Cash',
        appointmentType: 'Clinic',
        clinicLocation: 'Main Clinic',
      })
    expect(bookRes.body.success).toBe(true)
    const aptId = bookRes.body.appointment?._id

    const listRes = await api()
      .get('/api/user/appointments')
      .set(authHeader.patient(token))
    expect(listRes.body.success).toBe(true)
    expect(listRes.body.appointments.some((a) => String(a._id) === String(aptId))).toBe(true)

    const cancelRes = await api()
      .post('/api/user/cancel-appointment')
      .set(authHeader.patient(token))
      .send({ appointmentId: aptId })
    expect(cancelRes.body.success).toBe(true)
  })

  it('staff views appointments', async () => {
    const docLogin = await loginDoctor()
    const docApts = await api()
      .get('/api/doctor/appointments')
      .set(authHeader.doctor(docLogin.body.token))
    expect(docApts.body.success).toBe(true)

    const adminToken = await loginAdmin()
    const adminApts = await api()
      .get('/api/admin/appointments')
      .set(authHeader.admin(adminToken))
    expect(adminApts.body.success).toBe(true)
  })
})

describe('T3.10 Home visit booking + pricing', () => {
  it('books home visit with surcharge', async () => {
    const loginRes = await loginPatient()
    const { slotDate, slotTime } = futureBookingSlot(4)

    const res = await api()
      .post('/api/user/book-appointment')
      .set(authHeader.patient(loginRes.body.token))
      .send({
        docId: testIds.doctorId,
        slotDate,
        slotTime,
        paymentMethod: 'Cash',
        appointmentType: 'Home Visit',
        homeVisitAddress: { area: 'Cairo', street: 'Nile St 1' },
      })
    expect(res.body.success).toBe(true)
    const apt = await appointmentModel.findById(res.body.appointmentId)
    expect(apt.appointmentType).toBe('Home Visit')
    expect(Number(apt.homeVisitSurcharge || 0)).toBeGreaterThan(0)
  })
})

describe('T3.11 Insurance on booking', () => {
  it('patient updates insurance and receptionist verifies', async () => {
    const loginRes = await loginPatient()
    await api()
      .post('/api/user/insurance')
      .set(authHeader.patient(loginRes.body.token))
      .send({
        enabled: true,
        provider: 'AXA Egypt',
        fullName: 'Test Patient',
        birthDate: '1990-01-01',
        idNumber: 'ID123',
        expiryDate: '2030-12-31',
      })

    const user = await userModel.findById(testIds.patientId)
    expect(user.insurance.enabled).toBe(true)
    expect(user.insurance.verificationStatus).toBe('pending')

    const recLogin = await loginReceptionist()
    const verifyRes = await api()
      .post('/api/receptionist/patient-insurance-verify')
      .set(authHeader.receptionist(recLogin.body.token))
      .send({
        patientId: testIds.patientId,
        status: 'approved',
      })
    expect(verifyRes.body.success).toBe(true)
  })
})
