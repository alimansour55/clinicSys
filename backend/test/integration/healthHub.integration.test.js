import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { api, loginPatient, authHeader, signPatientToken } from './helpers/harness.js'
import { TEST_PASSWORD, testIds } from './helpers/seed.js'
import userModel from '../../models/userModel.js'
import appointmentModel from '../../models/appointmentModel.js'
import prescriptionModel from '../../models/prescriptionModel.js'
import healthReminderModel from '../../models/healthReminderModel.js'
import notificationModel from '../../models/notificationModel.js'

const today = () => new Date().toISOString().slice(0, 10)
const yesterday = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10)
const tomorrow = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10)

let me
let other
let otherId

beforeEach(async () => {
  me = authHeader.patient((await loginPatient()).body.token)
  const created = await userModel.create({
    name: 'Other Patient',
    email: 'other@test.com',
    password: await bcrypt.hash(TEST_PASSWORD, 4),
    phone: '01077778888',
    patientId: 'PAT-TEST-003',
    emailVerified: true,
    accountVerifiedAt: Date.now()
  })
  otherId = String(created._id)
  other = authHeader.patient(signPatientToken(otherId))
})

const reminderBody = (extra = {}) => ({
  title: 'Metformin 500mg', kind: 'medication', frequency: 'daily', times: ['08:00'], startDate: today(), tzOffsetMinutes: -120, ...extra
})

describe('family profiles', () => {
  it('creates, edits and deletes, and deleting takes the member records with it', async () => {
    const created = await api().post('/api/account/family').set(me).send({ name: 'Layla', relation: 'child', dob: '2018-03-01', bloodType: 'O+', allergies: 'Peanuts' })
    expect(created.body.success).toBe(true)
    const id = created.body.member._id

    const edit = await api().put(`/api/account/family/${id}`).set(me).send({ name: 'Layla M', relation: 'child' })
    expect(edit.body.member.name).toBe('Layla M')

    await api().post('/api/account/entries').set(me).send({ memberId: id, type: 'note', date: today(), title: 'Fever' })
    await api().post('/api/account/reminders').set(me).send(reminderBody({ memberId: id }))

    await api().delete(`/api/account/family/${id}`).set(me)
    const left = await api().get('/api/account/entries').set(me)
    expect(left.body.entries).toHaveLength(0)
    expect((await api().get('/api/account/reminders').set(me)).body.reminders).toHaveLength(0)
  })

  it('rejects a birth date in the future and a blank name', async () => {
    expect((await api().post('/api/account/family').set(me).send({ name: 'X', dob: '2999-01-01' })).body.success).toBe(false)
    expect((await api().post('/api/account/family').set(me).send({ name: '' })).body.success).toBe(false)
  })
})

describe('one patient cannot reach another patient', () => {
  it('family, entries and reminders are invisible and immutable to others', async () => {
    const member = (await api().post('/api/account/family').set(me).send({ name: 'Layla', allergies: 'Peanuts' })).body.member
    const entry = (await api().post('/api/account/entries').set(me).send({ type: 'note', date: today(), title: 'Private' })).body.entry
    const reminder = (await api().post('/api/account/reminders').set(me).send(reminderBody())).body.reminder

    expect((await api().get('/api/account/family').set(other)).body.members).toHaveLength(0)
    expect((await api().get('/api/account/entries').set(other)).body.entries).toHaveLength(0)
    expect((await api().get('/api/account/reminders').set(other)).body.reminders).toHaveLength(0)
    expect((await api().get(`/api/account/entries?memberId=${member._id}`).set(other)).body.entries).toHaveLength(0)
    expect((await api().get(`/api/account/timeline?memberId=${member._id}`).set(other)).body.events).toHaveLength(0)

    expect((await api().put(`/api/account/family/${member._id}`).set(other).send({ name: 'Hacked' })).body.success).toBe(false)
    expect((await api().delete(`/api/account/family/${member._id}`).set(other)).body.success).toBe(false)
    expect((await api().delete(`/api/account/entries/${entry._id}`).set(other)).body.success).toBe(false)
    expect((await api().put(`/api/account/reminders/${reminder._id}`).set(other).send({ active: false })).body.success).toBe(false)
    expect((await api().post(`/api/account/reminders/${reminder._id}/respond`).set(other).send({ action: 'taken' })).body.success).toBe(false)
    expect((await api().delete(`/api/account/reminders/${reminder._id}`).set(other)).body.success).toBe(false)

    // Nor can they file records under someone else's family member.
    expect((await api().post('/api/account/entries').set(other).send({ memberId: member._id, type: 'note', date: today(), title: 'x' })).body.success).toBe(false)
    expect((await api().post('/api/account/reminders').set(other).send(reminderBody({ memberId: member._id }))).body.success).toBe(false)
  })

  it('timeline and export hold only the caller\'s visits and prescriptions', async () => {
    const appointment = await appointmentModel.create({
      userId: testIds.patientId, docId: testIds.doctorId, slotDate: '5_1_2026', slotTime: '10:00',
      userData: { name: 'Test Patient' }, docData: { name: 'Dr Test', speciality: 'General', mfa: { secret: 'DOCSECRET' } }, amount: 100, date: Date.now(),
      appointmentStatus: 'Finished', isCompleted: true
    })
    await prescriptionModel.create({
      appointmentId: String(appointment._id), userId: testIds.patientId, docId: testIds.doctorId, slotDate: '5_1_2026', slotTime: '10:00', amount: 100,
      diagnosis: 'Secret diagnosis', symptoms: 's', instructions: 'i', nextVisit: '2026-02-01',
      medicationItems: [{ name: 'Amoxicillin', dosage: '500mg', frequency: '3 times a day', duration: '7 days' }]
    })

    const mine = await api().get('/api/account/timeline').set(me)
    const visit = mine.body.events.find((e) => e.type === 'visit')
    expect(visit.status).toBe('finished')
    expect(visit.prescription.medicationItems[0].name).toBe('Amoxicillin')
    expect(JSON.stringify(mine.body)).not.toContain('DOCSECRET')

    const theirs = await api().get('/api/account/timeline').set(other)
    expect(JSON.stringify(theirs.body)).not.toContain('Secret diagnosis')

    const theirExport = await api().get('/api/account/export').set(other)
    expect(JSON.stringify(theirExport.body)).not.toContain('Secret diagnosis')
    const myExport = await api().get('/api/account/export').set(me)
    expect(JSON.stringify(myExport.body)).toContain('Secret diagnosis')
    expect(JSON.stringify(myExport.body)).not.toMatch(/"password"|"secret"|resetOtp/)
  })

  it('every hub route needs a patient session', async () => {
    for (const path of ['/hub', '/timeline', '/family', '/entries', '/reminders', '/export', '/security/activity']) {
      expect((await api().get(`/api/account${path}`)).status).toBe(401)
    }
  })

  it('notifications are private to their recipient', async () => {
    const note = await notificationModel.create({ recipientRole: 'patient', recipientId: testIds.patientId, title: 't', message: 'private', read: false })
    expect((await api().post(`/api/notifications/${note._id}/read`).set(other)).body.success).toBe(false)
    expect((await api().get('/api/notifications').set(other)).body.notifications).toHaveLength(0)
  })
})

describe('journal', () => {
  it('stores vitals and refuses impossible readings or future dates', async () => {
    const ok = await api().post('/api/account/entries').set(me).send({ type: 'vitals', date: today(), vitals: { systolic: 120, diastolic: 80 } })
    expect(ok.body.success).toBe(true)
    expect((await api().post('/api/account/entries').set(me).send({ type: 'vitals', date: today(), vitals: { systolic: 9000 } })).body.success).toBe(false)
    expect((await api().post('/api/account/entries').set(me).send({ type: 'vitals', date: today(), vitals: {} })).body.success).toBe(false)
    expect((await api().post('/api/account/entries').set(me).send({ type: 'note', date: '2999-01-01', title: 'x' })).body.success).toBe(false)
  })
})

describe('reminders', () => {
  it('notifies once when due, and taking it moves on to the next day', async () => {
    const { reminder } = (await api().post('/api/account/reminders').set(me).send(reminderBody())).body
    await healthReminderModel.updateOne({ _id: reminder._id }, { nextDueAt: Date.now() - 60000, startDate: yesterday() })

    await api().post('/api/account/reminders/sync').set(me).send({})
    await api().post('/api/account/reminders/sync').set(me).send({})
    const notes = await notificationModel.find({ recipientId: testIds.patientId, type: 'health_reminder' })
    expect(notes).toHaveLength(1)
    expect(notes[0].meta.reminderId).toBe(reminder._id)

    const res = await api().post(`/api/account/reminders/${reminder._id}/respond`).set(me).send({ action: 'taken' })
    expect(res.body.reminder.history.at(-1).action).toBe('taken')
    expect(res.body.reminder.nextDueAt).toBeGreaterThan(Date.now())
  })

  it('a dose nobody answered is marked missed and rolls forward', async () => {
    const { reminder } = (await api().post('/api/account/reminders').set(me).send(reminderBody())).body
    await healthReminderModel.updateOne({ _id: reminder._id }, { nextDueAt: Date.now() - 8 * 3600 * 1000, startDate: yesterday() })
    await api().post('/api/account/reminders/sync').set(me).send({})
    const fresh = await healthReminderModel.findById(reminder._id)
    expect(fresh.history.at(-1).action).toBe('missed')
    expect(fresh.nextDueAt).toBeGreaterThan(Date.now())
  })

  it('refuses an end before the start, and pausing stops notifications', async () => {
    expect((await api().post('/api/account/reminders').set(me).send(reminderBody({ endDate: yesterday() }))).body.success).toBe(false)
    const { reminder } = (await api().post('/api/account/reminders').set(me).send(reminderBody({ startDate: tomorrow() }))).body
    await api().put(`/api/account/reminders/${reminder._id}`).set(me).send({ active: false })
    await healthReminderModel.updateOne({ _id: reminder._id }, { nextDueAt: Date.now() - 1000 })
    await api().post('/api/account/reminders/sync').set(me).send({})
    expect(await notificationModel.countDocuments({ recipientId: testIds.patientId, type: 'health_reminder' })).toBe(0)
  })
})

describe('profile', () => {
  const update = (body) => api().post('/api/user/update-profile').set(me).send(body)
  const base = { name: 'Test Patient', phone: '01012345678', dob: '1990-01-15' }

  it('saves, and ignores anything but the two address lines', async () => {
    const res = await update({ ...base, address: { line1: 'Street', line2: 'Floor', isAdmin: true } })
    expect(res.body.success).toBe(true)
    const user = await userModel.findById(testIds.patientId).lean()
    expect(user.address).toEqual({ line1: 'Street', line2: 'Floor' })
  })

  it('a malformed address is refused rather than a parse error', async () => {
    const res = await update({ ...base, address: '{nope' })
    expect(res.body.message).toBe('Please check the address')
  })

  it('a new phone number must be valid and clears the verified badge', async () => {
    expect((await update({ ...base, phone: '123' })).body.success).toBe(false)
    expect((await update({ ...base, phone: '01099990000' })).body.success).toBe(true)
    const user = await userModel.findById(testIds.patientId)
    expect(user.phone).toBe('01099990000')
    expect(user.phoneVerified).toBe(false)
  })

  it('role and verification fields cannot be set from the body', async () => {
    await update({ ...base, isActive: false, emailVerified: false, patientId: 'HACK', 'mfa.enabled': true })
    const user = await userModel.findById(testIds.patientId).lean()
    expect(user.isActive).toBe(true)
    expect(user.emailVerified).toBe(true)
    expect(user.patientId).toBe('PAT-TEST-001')
    expect(user.mfa?.enabled).toBeFalsy()
  })

  it('verifies a phone number once it is changed, with attempt limits', async () => {
    await update({ ...base, phone: '01099990000' })
    expect((await api().post('/api/account/phone/send').set(me)).body.success).toBe(true)
    for (let i = 0; i < 5; i += 1) {
      await api().post('/api/account/phone/confirm').set(me).send({ code: '000000' })
    }
    const stored = await userModel.findById(testIds.patientId).select('+phoneVerifyOtp')
    expect(stored.phoneVerifyOtp).toBe('')
    expect(stored.phoneVerified).toBe(false)
  })
})

describe('medical history', () => {
  it('saves, ignores unknown fields, caps length, and never audits the values', async () => {
    const res = await api().put('/api/user/medical-history').set(me).send({
      medicalHistory: { allergies: 'Penicillin', conditions: 'x'.repeat(9000), hacked: 'yes' }
    })
    expect(res.body.success).toBe(true)
    expect(res.body.medicalHistory.allergies).toBe('Penicillin')
    expect(res.body.medicalHistory.conditions).toHaveLength(5000)
    expect(res.body.medicalHistory.hacked).toBeUndefined()

    const { default: auditLogModel } = await import('../../models/auditLogModel.js')
    const logs = await auditLogModel.find({ action: 'medical_history_update' }).lean()
    expect(JSON.stringify(logs)).not.toContain('Penicillin')
    expect(logs[0].metadata.changedFields).toContain('allergies')
  })

  it('never writes health data to the server console', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')]
    await api().put('/api/user/medical-history').set(me).send({ medicalHistory: { allergies: 'UNIQUE-ALLERGY-TEXT' } })
    await api().post('/api/account/entries').set(me).send({ type: 'note', date: today(), title: 'UNIQUE-ALLERGY-TEXT' })
    await api().post('/api/account/family').set(me).send({ name: 'n', allergies: 'UNIQUE-ALLERGY-TEXT' })
    const printed = spies.flatMap((spy) => spy.mock.calls).flat().map(String).join(' ')
    spies.forEach((spy) => spy.mockRestore())
    expect(printed).not.toContain('UNIQUE-ALLERGY-TEXT')
  })
})

describe('hub', () => {
  it('loads everything for a new patient, with onboarding open', async () => {
    const res = await api().get('/api/account/hub').set(me)
    expect(res.body.success).toBe(true)
    expect(res.body.members).toEqual([])
    expect(res.body.onboarding.completedAt || 0).toBe(0)

    await api().post('/api/account/onboarding').set(me).send({ action: 'complete' })
    expect((await api().get('/api/account/hub').set(me)).body.onboarding.completedAt).toBeGreaterThan(0)
  })

  it('saves emergency details and refuses a made-up blood type', async () => {
    expect((await api().put('/api/account/emergency').set(me).send({ bloodType: 'Z+' })).body.success).toBe(false)
    const res = await api().put('/api/account/emergency').set(me).send({ bloodType: 'O+', contactName: 'Mona', contactPhone: '01011112222' })
    expect(res.body.emergency.bloodType).toBe('O+')
  })

  it('change password needs the current one and ends other sessions', async () => {
    const wrong = await api().post('/api/account/change-password').set(me).send({ currentPassword: 'nope', newPassword: 'BrandNew1!pass' })
    expect(wrong.body.success).toBe(false)
    const weak = await api().post('/api/account/change-password').set(me).send({ currentPassword: TEST_PASSWORD, newPassword: 'weak' })
    expect(weak.body.success).toBe(false)

    const iat = Math.floor(Date.now() / 1000) - 60
    const { default: jwt } = await import('jsonwebtoken')
    const older = authHeader.patient(jwt.sign({ id: testIds.patientId, role: 'patient', iat }, process.env.JWT_SECRET))
    const ok = await api().post('/api/account/change-password').set(me).send({ currentPassword: TEST_PASSWORD, newPassword: 'BrandNew1!pass' })
    expect(ok.body.success).toBe(true)
    expect((await api().get('/api/user/get-profile').set(older)).status).toBe(401)
    expect((await api().get('/api/user/get-profile').set(authHeader.patient(ok.body.token))).status).toBe(200)
  })

  it('security activity shows only this patient', async () => {
    await loginPatient()
    const mine = await api().get('/api/account/security/activity').set(me)
    expect(mine.body.activity.length).toBeGreaterThan(0)
    expect((await api().get('/api/account/security/activity').set(other)).body.activity).toHaveLength(0)
  })

  it('publishes the password policy without signing in', async () => {
    const res = await api().get('/api/account/password-policy')
    expect(res.body.policy.minLength).toBeGreaterThan(0)
  })
})
