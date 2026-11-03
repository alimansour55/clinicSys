import { beforeEach, describe, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'

vi.mock('../../services/plainTextTranslateService.js', () => ({
  tryTranslatePlainText: vi.fn(async (text, target) => `${target}:${text}`),
  resolvePlainTextTranslationsBatch: vi.fn(async () => ({}))
}))

import appointmentModel from '../../models/appointmentModel.js'
import doctorModel from '../../models/doctorModel.js'
import receptionistModel from '../../models/receptionistModel.js'
import siteSettingModel from '../../models/siteSettingModel.js'
import userModel from '../../models/userModel.js'
import { countPendingBilingual, backfillBilingual, retryPendingBilingual } from '../../services/bilingualContentService.js'
import { BILINGUAL_MODELS } from '../../services/bilingualRegistry.js'
import { tryTranslatePlainText } from '../../services/plainTextTranslateService.js'
import { api, authHeader, loginAdmin, loginDoctor } from './helpers/harness.js'
import { testIds, testUsers } from './helpers/seed.js'

const translator = vi.mocked(tryTranslatePlainText)
const settingsEntry = () => BILINGUAL_MODELS.find((entry) => entry.label === 'site settings')

const appointmentFor = (overrides = {}) => ({
  userId: testIds.patientId,
  docId: testIds.doctorId,
  slotDate: '1_1_2026',
  slotTime: '10:00',
  userData: { name: 'Test Patient' },
  docData: { name: 'Test Doctor', speciality: 'General physician' },
  amount: 100,
  date: Date.now(),
  ...overrides
})

beforeEach(() => {
  translator.mockReset()
  translator.mockImplementation(async (text, target) => `${target}:${text}`)
})

describe('admin endpoints enforce admin access', () => {
  const routes = [
    ['get', '/api/admin/dashboard'],
    ['get', '/api/admin/command-center'],
    ['get', '/api/admin/search?q=test'],
    ['get', '/api/admin/users'],
    ['get', '/api/admin/patients'],
    ['get', '/api/admin/appointments'],
    ['get', '/api/admin/audit-logs'],
    ['get', '/api/admin/site-settings'],
    ['get', '/api/admin/financial-analytics'],
    ['get', '/api/admin/translations/status'],
    ['post', '/api/admin/translate-preview'],
    ['post', '/api/admin/translations/retry'],
    ['post', '/api/admin/bulk/doctor-availability'],
    ['post', '/api/admin/bulk/user-status'],
    ['post', '/api/admin/bulk/user-mfa'],
    ['post', '/api/admin/bulk/reset-mfa'],
    ['post', '/api/admin/bulk/cancel-appointments'],
    ['post', '/api/admin/add-doctor'],
    ['post', '/api/admin/site-settings/footer'],
    ['post', '/api/admin/site-settings/security']
  ]

  it.each(routes)('%s %s refuses a request with no token', async (method, url) => {
    expect((await api()[method](url)).status).toBe(401)
  })

  it.each(routes)('%s %s refuses a doctor token', async (method, url) => {
    const doctor = await loginDoctor()
    const res = await api()[method](url).set({ atoken: doctor.body.token })
    expect(res.status).toBe(403)
  })
})

describe('admin session', () => {
  it('a token from before the MFA code cannot open admin routes', async () => {
    await siteSettingModel.updateOne(
      { key: 'site-settings' },
      { $set: { 'security.mfaEnabled': true, 'security.mfaRequiredGlobally': true } }
    )
    const login = await api()
      .post('/api/admin/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    expect(login.body.mfaSetupRequired).toBe(true)
    const res = await api().get('/api/admin/dashboard').set(authHeader.admin(login.body.mfaToken))
    expect(res.status).toBe(403)
  })

  it('expires with the session timeout in the security settings', async () => {
    await siteSettingModel.updateOne({ key: 'site-settings' }, { $set: { 'security.sessionTimeoutMinutes': 30 } })
    const decoded = jwt.decode(await loginAdmin())
    expect(decoded.exp - decoded.iat).toBe(30 * 60)
  })

  it('locks out an address after too many failed attempts, even with the right password', async () => {
    await siteSettingModel.updateOne({ key: 'site-settings' }, { $set: { 'security.maxLoginAttempts': 3 } })
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await api().post('/api/admin/login').send({ email: process.env.ADMIN_EMAIL, password: 'wrong' })
    }
    const res = await api()
      .post('/api/admin/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/too many/i)
  })
})

describe('secrets stay on the server', () => {
  beforeEach(async () => {
    await siteSettingModel.updateOne(
      { key: 'site-settings' },
      { $set: { 'security.adminMfa.secret': 'ADMINSECRET', 'adminProfile.phone': '01000000000' } }
    )
    await doctorModel.updateOne({ _id: testIds.doctorId }, { $set: { 'mfa.secret': 'DOCTORSECRET' } })
    await receptionistModel.updateOne({ _id: testIds.receptionistId }, { $set: { 'mfa.secret': 'DESKSECRET' } })
  })

  it('the public settings route carries no security policy or admin details', async () => {
    const { body } = await api().get('/api/user/site-settings')
    expect(JSON.stringify(body)).not.toContain('ADMINSECRET')
    expect(body.settings.security).toBeUndefined()
    expect(body.settings.adminProfile).toBeUndefined()
  })

  it('admin responses do not carry MFA secrets', async () => {
    const headers = authHeader.admin(await loginAdmin())
    const responses = await Promise.all([
      api().get('/api/admin/site-settings').set(headers),
      api().post('/api/admin/all-doctors').set(headers),
      api().get('/api/admin/receptionists').set(headers),
      api().get('/api/admin/users').set(headers),
      api().post('/api/admin/site-settings/footer').set(headers).send({ email: 'a@b.co' })
    ])
    for (const res of responses) {
      expect(res.body.success).toBe(true)
      expect(JSON.stringify(res.body)).not.toMatch(/ADMINSECRET|DOCTORSECRET|DESKSECRET/)
    }
  })

  it('saving security settings cannot replace the admin MFA secret', async () => {
    const headers = authHeader.admin(await loginAdmin())
    await api()
      .post('/api/admin/site-settings/security')
      .set(headers)
      .send({ passwordMinLength: 10, adminMfa: { enabled: true, secret: 'ATTACKER' } })
    const saved = await siteSettingModel.findOne({ key: 'site-settings' }).lean()
    expect(saved.security.adminMfa).toMatchObject({ secret: 'ADMINSECRET', enabled: false })
    expect(saved.security.passwordMinLength).toBe(10)
  })
})

describe('bilingual staff records', () => {
  it('stores a doctor update in both languages and keeps the speciality plain field in English', async () => {
    const headers = authHeader.admin(await loginAdmin())
    const res = await api()
      .post('/api/admin/update-doctor')
      .set(headers)
      .send({
        docId: testIds.doctorId,
        nameI18n: JSON.stringify({ en: 'Mona Hassan', ar: '', source: 'en' }),
        aboutI18n: JSON.stringify({ en: '', ar: 'طبيبة ذات خبرة', source: 'ar' }),
        degreeI18n: { en: 'MD', ar: '', source: 'en' },
        addressI18n: { en: 'Nasr City', ar: '', source: 'en' },
        address: JSON.stringify({ line1: 'old', line2: 'kept' }),
        speciality: 'Dermatologist'
      })
    expect(res.body.success).toBe(true)

    const doctor = await doctorModel.findById(testIds.doctorId).lean()
    expect(doctor.name).toBe('Mona Hassan')
    expect(doctor.i18n.name.ar).toBeTruthy()
    expect(doctor.about).toBe('en:طبيبة ذات خبرة')
    expect(doctor.i18n.about).toMatchObject({ ar: 'طبيبة ذات خبرة', source: 'ar' })
    expect(doctor.speciality).toBe('Dermatologist')
    expect(doctor.i18n.speciality).toMatchObject({ en: 'Dermatologist', ar: 'الجلدية' })
    expect(doctor.address).toMatchObject({ line1: 'Nasr City', line2: 'kept' })
    expect(doctor.i18n.address.en).toBe('Nasr City')
  })

  it('does not treat a plain address object as text', async () => {
    const headers = authHeader.admin(await loginAdmin())
    await api().post('/api/admin/update-doctor').set(headers).send({ docId: testIds.doctorId, address: { line1: 'Elsewhere', line2: '' } })
    const doctor = await doctorModel.findById(testIds.doctorId).lean()
    expect(doctor.address.line1).toBe('Elsewhere')
    expect(doctor.i18n?.address).toBeUndefined()
  })

  it('stores a receptionist name in both languages when created and when edited', async () => {
    const headers = authHeader.admin(await loginAdmin())
    const created = await api()
      .post('/api/admin/add-receptionist')
      .set(headers)
      .send({
        nameI18n: { en: '', ar: 'سارة علي', source: 'ar' },
        email: 'desk2@test.com',
        phone: '01011112222',
        password: 'TestPass1!'
      })
    expect(created.body.success).toBe(true)
    const list = await api().get('/api/admin/receptionists').set(headers)
    const row = list.body.receptionists.find((item) => item.email === 'desk2@test.com')
    expect(row.i18n.name.ar).toBe('سارة علي')
    expect(row.i18n.name.en).toBeTruthy()
    expect(row.name).toBe(row.i18n.name.en)

    await api()
      .post('/api/admin/update-receptionist')
      .set(headers)
      .send({ receptionistId: row._id, nameI18n: { en: 'Sara Mostafa', ar: '', source: 'en' } })
    const saved = await receptionistModel.findById(row._id).lean()
    expect(saved.name).toBe('Sara Mostafa')
    expect(saved.i18n.name.ar).toBeTruthy()
  })

  it('renaming from the user accounts page keeps both languages in step', async () => {
    const headers = authHeader.admin(await loginAdmin())
    await api()
      .post('/api/admin/update-user')
      .set(headers)
      .send({ profileType: 'doctor', profileId: testIds.doctorId, name: 'Ali Hassan' })
    const doctor = await doctorModel.findById(testIds.doctorId).lean()
    expect(doctor.i18n.name.en).toBe('Ali Hassan')
    expect(doctor.i18n.name.ar).toBeTruthy()
  })
})

describe('bilingual site settings', () => {
  it('saves footer text in both languages and keeps a hand correction', async () => {
    const headers = authHeader.admin(await loginAdmin())
    await api()
      .post('/api/admin/site-settings/footer')
      .set(headers)
      .send({
        companyTitleI18n: { en: 'Clinic', ar: '', source: 'en' },
        contactTitleI18n: { en: 'Reach us', ar: 'تواصل معنا', source: 'en', manual: true },
        phoneNumber: '+20 100 000 0000'
      })
    let saved = (await siteSettingModel.findOne({ key: 'site-settings' }).lean()).footer
    expect(saved.companyTitle).toBe('Clinic')
    expect(saved.i18n.companyTitle.ar).toBe('ar:Clinic')
    expect(saved.i18n.contactTitle).toMatchObject({ ar: 'تواصل معنا', manual: true })
    expect(saved.phoneNumber).toBe('+20 100 000 0000')
    expect(saved.homeLabel).toBeTruthy()

    /* A later save of something else leaves it alone */
    await api().post('/api/admin/site-settings/footer').set(headers).send({ companyTitleI18n: { en: 'Clinic two', ar: '', source: 'en' } })
    saved = (await siteSettingModel.findOne({ key: 'site-settings' }).lean()).footer
    expect(saved.i18n.contactTitle.ar).toBe('تواصل معنا')
    expect(saved.i18n.companyTitle.ar).toBe('ar:Clinic two')
  })

  it('a multipart form posts the field as JSON text', async () => {
    const headers = authHeader.admin(await loginAdmin())
    const res = await api()
      .post('/api/admin/site-settings/home-hero')
      .set(headers)
      .field('titleI18n', JSON.stringify({ en: '', ar: 'احجز موعدك', source: 'ar' }))
      .field('backgroundColor', '#0b8074')
    expect(res.body.success).toBe(true)
    const hero = (await siteSettingModel.findOne({ key: 'site-settings' }).lean()).homeHero
    expect(hero.i18n.title).toMatchObject({ ar: 'احجز موعدك', en: 'en:احجز موعدك' })
    expect(hero.title).toBe('en:احجز موعدك')
    expect(hero.subtitle).toBeTruthy()
  })

  it('the public settings carry both languages', async () => {
    const headers = authHeader.admin(await loginAdmin())
    await api().post('/api/admin/site-settings/footer').set(headers).send({ copyrightText: 'All rights' })
    const { body } = await api().get('/api/user/site-settings')
    expect(body.settings.footer.i18n.copyrightText).toMatchObject({ en: 'All rights', ar: 'ar:All rights' })
  })

  it('stores insurance providers in both languages', async () => {
    const headers = authHeader.admin(await loginAdmin())
    const res = await api()
      .post('/api/admin/site-settings/insurance-providers')
      .set(headers)
      .send({ providersI18n: [{ en: 'New Care', ar: '', source: 'en' }, 'Second Care', { en: 'New Care', ar: 'مكرر', source: 'en' }] })
    expect(res.body.success).toBe(true)
    expect(res.body.settings.insuranceProviders).toEqual(['New Care', 'Second Care'])
    expect(res.body.settings.insuranceProvidersI18n[0]).toMatchObject({ name: 'New Care', en: 'New Care', ar: 'ar:New Care' })

    const publicList = await api().get('/api/user/insurance-providers')
    expect(publicList.body.providers).toEqual(['New Care', 'Second Care'])
    expect(publicList.body.providersI18n[1].ar).toBe('ar:Second Care')
  })

  it('a translator outage saves as pending, and the registry finds and finishes nested fields', async () => {
    const headers = authHeader.admin(await loginAdmin())
    const { model, fields } = settingsEntry()
    translator.mockResolvedValue(null)

    const res = await api().post('/api/admin/site-settings/footer').set(headers).send({ copyrightText: 'Rights' })
    expect(res.body.success).toBe(true)
    await api().post('/api/admin/site-settings/insurance-providers').set(headers).send({ providers: ['Pending Care'] })
    expect(await countPendingBilingual(model, fields)).toBe(1)

    translator.mockImplementation(async (text, target) => `${target}:${text}`)
    expect(await retryPendingBilingual(model, fields, { force: true })).toEqual({ completed: 2, stillPending: 0 })
    const saved = await model.findOne({ key: 'site-settings' }).lean()
    expect(saved.footer.i18n.copyrightText.ar).toBe('ar:Rights')
    expect(saved.insuranceProvidersI18n[0].ar).toBe('ar:Pending Care')
    expect(await countPendingBilingual(model, fields)).toBe(0)
  })

  it('the backfill walks nested fields and doctor addresses, and is safe to rerun', async () => {
    await siteSettingModel.updateOne({ key: 'site-settings' }, { $set: { insuranceProviders: ['Old Care'] } })
    const { model, fields } = settingsEntry()

    const dry = await backfillBilingual(model, fields, { dryRun: true })
    expect(dry.wouldFill).toBeGreaterThan(20)
    expect(translator).not.toHaveBeenCalled()

    const first = await backfillBilingual(model, fields, { dryRun: false })
    expect(first.pending).toBe(0)
    const saved = await model.findOne({ key: 'site-settings' }).lean()
    expect(saved.footer.i18n.homeLabel).toMatchObject({ en: 'Home', ar: 'ar:Home' })
    expect(saved.insuranceProvidersI18n[0].ar).toBe('ar:Old Care')
    translator.mockClear()
    expect((await backfillBilingual(model, fields, { dryRun: false })).filled).toBe(0)
    expect(translator).not.toHaveBeenCalled()

    const doctors = BILINGUAL_MODELS.find((entry) => entry.label === 'doctor')
    await backfillBilingual(doctors.model, doctors.fields, { dryRun: false })
    const doctor = await doctorModel.findById(testIds.doctorId).lean()
    expect(doctor.i18n.address.en).toBe('Clinic St, Cairo')
    expect(doctor.address).toMatchObject({ line1: 'Clinic St', line2: 'Cairo' })
  })
})

describe('command centre', () => {
  it('reports figures from the records and leaves refunds out of revenue', async () => {
    await appointmentModel.create([
      appointmentFor({ paymentStatus: 'Paid', paymentMethod: 'Cash', amount: 200, paidAt: Date.now() }),
      appointmentFor({ paymentStatus: 'Paid', paymentMethod: 'Visa', amount: 300, refundStatus: 'Refunded' }),
      appointmentFor({ cancelled: true, appointmentStatus: 'Cancelled' })
    ])
    await userModel.updateOne({ _id: testIds.patientId }, { $set: { 'insurance.enabled': true, 'insurance.verificationStatus': 'pending' } })

    const headers = authHeader.admin(await loginAdmin())
    const { body } = await api().get('/api/admin/command-center').set(headers)
    expect(body.success).toBe(true)
    const center = body.commandCenter
    expect(center.totals.revenue).toBe(200)
    expect(center.totals.appointments).toBe(3)
    expect(center.pulse.bookings.current).toBe(3)
    expect(center.pulse.cancellations.current).toBe(1)
    expect(center.series).toHaveLength(30)
    expect(center.attention.map((item) => item.key)).toEqual(expect.arrayContaining(['insuranceReviews', 'adminMfaOff', 'staleAppointments']))
    expect(center.attention.find((item) => item.key === 'insuranceReviews').count).toBe(1)
  })

  it('dashboard revenue also leaves refunds out', async () => {
    await appointmentModel.create([
      appointmentFor({ paymentStatus: 'Paid', amount: 200 }),
      appointmentFor({ paymentStatus: 'Paid', amount: 300, refundStatus: 'Refunded' })
    ])
    const { body } = await api().get('/api/admin/dashboard').set(authHeader.admin(await loginAdmin()))
    expect(body.dashData.revenue).toBe(200)
  })
})

describe('global search', () => {
  it('finds records and only returns what a result row shows', async () => {
    const headers = authHeader.admin(await loginAdmin())
    const { body } = await api().get('/api/admin/search').query({ q: testUsers.patient.email.slice(0, 7) }).set(headers)
    expect(body.results.patients[0].email).toBe(testUsers.patient.email)
    expect(body.results.patients[0].password).toBeUndefined()
    expect(body.results.patients[0].medicalHistory).toBeUndefined()
  })

  it('treats the query as text, not a pattern or an operator', async () => {
    const headers = authHeader.admin(await loginAdmin())
    const pattern = await api().get('/api/admin/search').query({ q: '.*' }).set(headers)
    expect(pattern.body.results.patients).toEqual([])
    const operator = await api().get('/api/admin/search?q[$ne]=x').set(headers)
    expect(operator.body.results.patients).toEqual([])
  })
})

describe('bulk actions', () => {
  it('changes doctor availability and writes one audit entry', async () => {
    const headers = authHeader.admin(await loginAdmin())
    const res = await api()
      .post('/api/admin/bulk/doctor-availability')
      .set(headers)
      .send({ doctorIds: [testIds.doctorId, 'not-an-id'], available: false })
    expect(res.body).toMatchObject({ success: true, updated: 1 })
    expect((await doctorModel.findById(testIds.doctorId).lean()).available).toBe(false)
  })

  it('refuses an empty selection', async () => {
    const headers = authHeader.admin(await loginAdmin())
    const res = await api().post('/api/admin/bulk/doctor-availability').set(headers).send({ doctorIds: [{ $ne: null }], available: false })
    expect(res.body.success).toBe(false)
  })

  it('deactivates accounts and requires MFA across roles', async () => {
    const headers = authHeader.admin(await loginAdmin())
    const users = [
      { profileType: 'patient', profileId: testIds.patientId },
      { profileType: 'receptionist', profileId: testIds.receptionistId },
      { profileType: 'admin', profileId: testIds.patientId }
    ]
    const status = await api().post('/api/admin/bulk/user-status').set(headers).send({ users, active: false })
    expect(status.body).toMatchObject({ success: true, updated: 2 })
    expect((await userModel.findById(testIds.patientId).lean()).isActive).toBe(false)
    expect((await receptionistModel.findById(testIds.receptionistId).lean()).isActive).toBe(false)

    const mfa = await api().post('/api/admin/bulk/user-mfa').set(headers).send({ users, requiredByAdmin: true })
    expect(mfa.body.updated).toBe(2)
    expect((await userModel.findById(testIds.patientId).lean()).mfa.requiredByAdmin).toBe(true)
  })

  it('resets MFA across roles so each account sets it up again', async () => {
    await doctorModel.updateOne({ _id: testIds.doctorId }, { $set: { 'mfa.enabled': true, 'mfa.secret': 'LEAKED' } })
    await userModel.updateOne({ _id: testIds.patientId }, { $set: { 'mfa.enabled': true, 'mfa.secret': 'LEAKED2' } })
    const headers = authHeader.admin(await loginAdmin())
    const res = await api()
      .post('/api/admin/bulk/reset-mfa')
      .set(headers)
      .send({ users: [{ profileType: 'doctor', profileId: testIds.doctorId }, { profileType: 'patient', profileId: testIds.patientId }] })
    expect(res.body).toMatchObject({ success: true, updated: 2 })
    const doctor = await doctorModel.findById(testIds.doctorId).select('+mfa.secret').lean()
    expect(doctor.mfa).toMatchObject({ enabled: false, secret: '' })
    expect(doctor.mfa.resetAt).toBeGreaterThan(0)
    expect(JSON.stringify(res.body)).not.toContain('LEAKED')
  })

  it('cancels what it can, frees the slot and reports the rest', async () => {
    const open = await appointmentModel.create(appointmentFor({ slotDate: '2_2_2030', slotTime: '11:00' }))
    const finished = await appointmentModel.create(appointmentFor({ isCompleted: true, appointmentStatus: 'Finished' }))
    await doctorModel.updateOne({ _id: testIds.doctorId }, { $set: { slots_booked: { '2_2_2030': ['11:00', '12:00'] } } })

    const headers = authHeader.admin(await loginAdmin())
    const res = await api()
      .post('/api/admin/bulk/cancel-appointments')
      .set(headers)
      .send({ appointmentIds: [String(open._id), String(finished._id)] })
    expect(res.body.cancelled).toBe(1)
    expect(res.body.failed).toHaveLength(1)
    expect((await appointmentModel.findById(open._id).lean()).cancelled).toBe(true)
    expect((await doctorModel.findById(testIds.doctorId).lean()).slots_booked['2_2_2030']).toEqual(['12:00'])
  })

  it('refuses to cancel the same appointment twice', async () => {
    const open = await appointmentModel.create(appointmentFor({ cancelled: true, appointmentStatus: 'Cancelled' }))
    const res = await api()
      .post('/api/admin/cancel-appointment')
      .set(authHeader.admin(await loginAdmin()))
      .send({ appointmentId: String(open._id) })
    expect(res.body.success).toBe(false)
  })

  it('will not delete a doctor who still has open appointments', async () => {
    await appointmentModel.create(appointmentFor({ slotDate: '2_2_2030' }))
    const res = await api()
      .post('/api/admin/delete-user-account')
      .set(authHeader.admin(await loginAdmin()))
      .send({ profileType: 'doctor', profileId: testIds.doctorId })
    expect(res.body.success).toBe(false)
    expect(await doctorModel.findById(testIds.doctorId).lean()).toBeTruthy()
  })
})
