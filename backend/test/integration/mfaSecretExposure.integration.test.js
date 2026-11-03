import { describe, it, expect } from 'vitest'
import doctorModel from '../../models/doctorModel.js'
import siteSettingModel from '../../models/siteSettingModel.js'
import { generateMfaSecret, generateTotpCode } from '../../services/mfaService.js'
import { api, loginDoctor } from './helpers/harness.js'
import { testIds } from './helpers/seed.js'

const enableDoctorMfa = async () => {
  const secret = generateMfaSecret()
  await doctorModel.updateOne(
    { _id: testIds.doctorId },
    { $set: { 'mfa.secret': secret, 'mfa.enabled': true } }
  )
  return secret
}

describe('MFA secrets stay private', () => {
  it('omits doctor MFA secrets from the public doctor list', async () => {
    await enableDoctorMfa()
    const res = await api().get('/api/doctor/list')
    expect(res.body.success).toBe(true)
    expect(res.body.doctors.length).toBeGreaterThan(0)
    for (const doctor of res.body.doctors) {
      expect(doctor.mfa?.secret).toBeUndefined()
    }
  })

  it('omits the admin MFA secret from public site settings', async () => {
    await api().get('/api/user/site-settings')
    await siteSettingModel.updateMany({}, { $set: { 'security.adminMfa.secret': 'ADMINSECRET', 'security.adminMfa.enabled': true } })
    const res = await api().get('/api/user/site-settings')
    expect(res.body.success).toBe(true)
    expect(JSON.stringify(res.body)).not.toContain('ADMINSECRET')
    expect(res.body.settings.security).toBeUndefined()
  })

  it('still verifies doctor MFA at login', async () => {
    const secret = await enableDoctorMfa()
    const login = await loginDoctor()
    expect(login.body.mfaRequired).toBe(true)

    const rejected = await api().post('/api/doctor/mfa/verify-login').send({ mfaToken: login.body.mfaToken, code: '000000' })
    expect(rejected.body.success).toBe(false)

    const verified = await api()
      .post('/api/doctor/mfa/verify-login')
      .send({ mfaToken: login.body.mfaToken, code: generateTotpCode(secret) })
    expect(verified.body.success).toBe(true)
    expect(verified.body.token).toBeTruthy()
  })
})
