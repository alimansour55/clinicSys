import request from 'supertest'
import jwt from 'jsonwebtoken'
import { getApp } from '../setup.js'
import { TEST_PASSWORD, testUsers } from './seed.js'

export const authHeader = {
  admin: (token) => ({ atoken: token }),
  doctor: (token) => ({ dtoken: token }),
  receptionist: (token) => ({ rtoken: token }),
  patient: (token) => ({ token }),
}

export function api() {
  return request(getApp())
}

export async function loginAdmin() {
  const res = await api()
    .post('/api/admin/login')
    .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
  if (!res.body.success) throw new Error(`Admin login failed: ${res.body.message}`)
  return res.body.token
}

export async function loginPatient(email = testUsers.patient.email) {
  const res = await api().post('/api/user/login').send({ email, password: TEST_PASSWORD })
  return res
}

export async function loginDoctor() {
  const res = await api()
    .post('/api/doctor/login')
    .send({ email: testUsers.doctor.email, password: TEST_PASSWORD })
  return res
}

export async function loginReceptionist() {
  const res = await api()
    .post('/api/receptionist/login')
    .send({ email: testUsers.receptionist.email, password: TEST_PASSWORD })
  return res
}

/** Future slot string DD_MM_YYYY and HH:mm on a working weekday. */
export function futureBookingSlot(weekday = 2) {
  const date = new Date()
  date.setHours(14, 0, 0, 0)
  while (date.getDay() !== weekday) date.setDate(date.getDate() + 1)
  if (date <= new Date()) date.setDate(date.getDate() + 7)
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  return { slotDate: `${day}_${month}_${year}`, slotTime: '10:00', weekday: date.getDay() }
}

export function signPatientToken(userId) {
  return jwt.sign({ id: userId, userId, role: 'patient' }, process.env.JWT_SECRET, { expiresIn: '7d' })
}
