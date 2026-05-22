import { describe, it, expect } from 'vitest'
import { api, loginAdmin, authHeader } from './helpers/harness.js'

describe('T3.15 Site settings', () => {
  it('returns public site settings without auth', async () => {
    const res = await api().get('/api/user/site-settings')
    expect(res.body.success).toBe(true)
  })

  it('lists insurance providers publicly', async () => {
    const res = await api().get('/api/user/insurance-providers')
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.providers)).toBe(true)
  })

  it('admin updates footer and global visit fees', async () => {
    const token = await loginAdmin()

    const footerRes = await api()
      .post('/api/admin/site-settings/footer')
      .set(authHeader.admin(token))
      .send({ copyrightText: '© Test Clinic' })
    expect(footerRes.body.success).toBe(true)

    const feesRes = await api()
      .post('/api/admin/site-settings/global-visit-fees')
      .set(authHeader.admin(token))
      .send({ enabled: true, examinationFee: 150, consultationFee: 100 })
    expect(feesRes.body.success).toBe(true)

    const langRes = await api()
      .post('/api/admin/site-settings/language-policies')
      .set(authHeader.admin(token))
      .send({ patient: { en: true, ar: true } })
    expect(langRes.body.success).toBe(true)
  })
})
