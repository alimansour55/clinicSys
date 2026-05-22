import { describe, it, expect } from 'vitest'
import { getApp } from './setup.js'
import { api, loginPatient, loginAdmin, authHeader } from './helpers/harness.js'
import { testIds, testUsers, TEST_PASSWORD } from './helpers/seed.js'

describe('T3.1 Integration harness', () => {
  it('exports Express app and serves health route', async () => {
    const app = getApp()
    expect(app).toBeTruthy()
    const res = await api().get('/')
    expect(res.text).toBe('API WORKING')
  })

  it('seed users exist and auth headers work', async () => {
    expect(testIds.patientId).toBeTruthy()
    expect(testIds.doctorId).toBeTruthy()
    expect(testIds.receptionistId).toBeTruthy()

    const patientLogin = await loginPatient()
    expect(patientLogin.body.token).toBeTruthy()

    const adminToken = await loginAdmin()
    const adminMe = await api().get('/api/admin/users').set(authHeader.admin(adminToken))
    expect(adminMe.body.success).toBe(true)

    expect(testUsers.patient.email).toBe('patient@test.com')
    expect(TEST_PASSWORD).toBe('TestPass1!')
  })
})
