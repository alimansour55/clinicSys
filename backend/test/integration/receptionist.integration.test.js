import { describe, it, expect } from 'vitest'
import { api, loginReceptionist, authHeader } from './helpers/harness.js'
import { testUsers } from './helpers/seed.js'

describe('T3.8 Receptionist API', () => {
  it('login and load profile', async () => {
    const loginRes = await loginReceptionist()
    expect(loginRes.body.success).toBe(true)

    const profile = await api()
      .get('/api/receptionist/profile')
      .set(authHeader.receptionist(loginRes.body.token))
    expect(profile.body.success).toBe(true)
    expect(profile.body.profileData.email).toBe(testUsers.receptionist.email)
  })

  it('lists clinics and patients', async () => {
    const loginRes = await loginReceptionist()
    const headers = authHeader.receptionist(loginRes.body.token)

    const clinics = await api().get('/api/receptionist/clinics').set(headers)
    expect(clinics.body.success).toBe(true)

    const patients = await api().get('/api/receptionist/patients').set(headers)
    expect(patients.body.success).toBe(true)
    expect(patients.body.patients.length).toBeGreaterThan(0)
  })
})
