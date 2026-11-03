import { describe, it, expect, vi, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import appointmentModel from '../../models/appointmentModel.js'
import doctorModel from '../../models/doctorModel.js'
import prescriptionModel from '../../models/prescriptionModel.js'
import ratingModel from '../../models/ratingModel.js'
import siteSettingModel from '../../models/siteSettingModel.js'
import slotHoldModel from '../../models/slotHoldModel.js'
import userModel from '../../models/userModel.js'
import waitlistModel from '../../models/waitlistModel.js'
import { addDaysToSlotDate, clinicTodaySlotDate, slotStartDate } from '../../services/clinicTimeService.js'
import { resetSweepThrottle, sweepExpiredHolds } from '../../services/slotHoldService.js'
import { api, authHeader, loginPatient } from './helpers/harness.js'
import { TEST_PASSWORD, testIds, testUsers } from './helpers/seed.js'

const stripeState = vi.hoisted(() => ({ intents: new Map(), counter: 0, refunds: [] }))

vi.mock('../../config/stripe.js', () => {
  const create = vi.fn(async (params) => {
    stripeState.counter += 1
    const intent = {
      id: `pi_${stripeState.counter}`,
      client_secret: `secret_${stripeState.counter}`,
      status: 'requires_payment_method',
      amount: params.amount,
      currency: params.currency,
      metadata: params.metadata,
      latest_charge: `ch_${stripeState.counter}`
    }
    stripeState.intents.set(intent.id, intent)
    return intent
  })
  const retrieve = vi.fn(async (id) => {
    const intent = stripeState.intents.get(id)
    if (!intent) throw new Error('No such payment_intent')
    return { ...intent }
  })
  const cancel = vi.fn(async (id) => {
    const intent = stripeState.intents.get(id)
    intent.status = 'canceled'
    return { ...intent }
  })
  const refundsCreate = vi.fn(async (params, options) => {
    // Same idempotency key, same refund: this is how Stripe behaves, and what retries rely on.
    const existing = stripeState.refunds.find((row) => row.key === options?.idempotencyKey)
    if (existing) return existing.refund
    const refund = { id: `re_${stripeState.refunds.length + 1}`, status: 'succeeded', amount: stripeState.intents.get(params.payment_intent)?.amount }
    stripeState.refunds.push({ key: options?.idempotencyKey, refund, params })
    return refund
  })
  return {
    default: {
      paymentIntents: { create, retrieve, cancel },
      refunds: { create: refundsCreate, retrieve: vi.fn(async (id) => ({ id, status: 'succeeded' })) }
    },
    stripeCurrency: 'egp'
  }
})

const payIntent = (id) => {
  const intent = stripeState.intents.get(id)
  intent.status = 'succeeded'
  intent.amount_received = intent.amount
}

/** A clinic slot on a day the seed doctor has no home-visit hours, which would make it overlap. */
const clinicSlot = (time = '09:30 AM', minDays = 2) => {
  let slotDate = addDaysToSlotDate(clinicTodaySlotDate(), minDays)
  while (![0, 1, 3, 5, 6].includes(new Date(Date.UTC(...slotDate.split('_').reverse().map((value, index) => index === 1 ? Number(value) - 1 : Number(value)))).getUTCDay())) {
    slotDate = addDaysToSlotDate(slotDate, 1)
  }
  return { slotDate, slotTime: time }
}

const homeSlot = (time = '10:00 AM') => {
  let slotDate = addDaysToSlotDate(clinicTodaySlotDate(), 2)
  while (![2, 4].includes(new Date(Date.UTC(...slotDate.split('_').reverse().map((value, index) => index === 1 ? Number(value) - 1 : Number(value)))).getUTCDay())) {
    slotDate = addDaysToSlotDate(slotDate, 1)
  }
  return { slotDate, slotTime: time }
}

/** The seed gives the doctor clinic hours on every day, which overlap home-visit hours. Free up the home-visit days. */
const separateHomeVisitDays = () => doctorModel.updateOne({ _id: testIds.doctorId }, { 'schedule.workingDays': [0, 1, 3, 5, 6] })

const bookedTimes = async (slotDate) => {
  const doctor = await doctorModel.findById(testIds.doctorId).lean()
  return doctor.slots_booked?.[slotDate] || []
}

const secondPatient = async (suffix = '2') => {
  const hash = (await userModel.findOne({ email: testUsers.patient.email })).password
  const user = await userModel.create({
    name: `Second Patient ${suffix}`,
    email: `second${suffix}@test.com`,
    password: hash,
    phone: `0101111222${suffix}`,
    patientId: `PAT-SECOND-${suffix}`,
    emailVerified: true,
    phoneVerified: true,
    accountVerifiedAt: Date.now()
  })
  const res = await api().post('/api/user/login').send({ email: user.email, password: TEST_PASSWORD })
  return { user, token: res.body.token }
}

const patientToken = async () => (await loginPatient()).body.token

const book = (token, body) => api().post('/api/user/book-appointment').set(authHeader.patient(token)).send({
  docId: testIds.doctorId,
  paymentMethod: 'Cash',
  appointmentType: 'Clinic',
  clinicLocation: 'Main Clinic',
  ...body
})

const startCheckout = (token, body) => api().post('/api/user/create-booking-payment-intent').set(authHeader.patient(token)).send({
  docId: testIds.doctorId,
  appointmentType: 'Clinic',
  clinicLocation: 'Main Clinic',
  ...body
})

const confirmCheckout = (token, paymentIntentId) => api().post('/api/user/confirm-booking-payment-intent').set(authHeader.patient(token)).send({ paymentIntentId })

const cancel = (token, appointmentId) => api().post('/api/user/cancel-appointment').set(authHeader.patient(token)).send({ appointmentId })

beforeEach(async () => {
  stripeState.intents.clear()
  stripeState.refunds.length = 0
  stripeState.counter = 0
  resetSweepThrottle()
  await Promise.all([appointmentModel.init(), slotHoldModel.init()])
})

describe('double booking', () => {
  it('lets one of many simultaneous patients have the slot', async () => {
    const patients = [await secondPatient('2'), await secondPatient('3'), await secondPatient('4'), await secondPatient('5')]
    const slot = clinicSlot()
    const results = await Promise.all(patients.map(({ token }) => book(token, slot)))

    expect(results.filter((res) => res.body.success)).toHaveLength(1)
    expect(await appointmentModel.countDocuments({ docId: testIds.doctorId, ...slot, cancelled: false })).toBe(1)
    expect(await bookedTimes(slot.slotDate)).toEqual([slot.slotTime])
  })

  it('treats differently written dates and times as the same slot', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const slot = clinicSlot('09:30 AM')
    const [day, month, year] = slot.slotDate.split('_')

    expect((await book(token, slot)).body.success).toBe(true)
    const respelled = await book(other, {
      slotDate: `${day.padStart(2, '0')}_${month.padStart(2, '0')}_${year}`,
      slotTime: '09:30'
    })
    expect(respelled.body.success).toBe(false)
    expect(await appointmentModel.countDocuments({ docId: testIds.doctorId, cancelled: false })).toBe(1)
  })

  it('rejects a date with a smuggled path segment', async () => {
    const token = await patientToken()
    const { slotDate } = clinicSlot()
    const res = await book(token, { slotDate: `${slotDate}_x.$y`, slotTime: '09:30 AM' })
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/Invalid appointment date/)
  })

  it('the unique index stops a second live appointment even if the slot list was wiped', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const slot = clinicSlot()
    expect((await book(token, slot)).body.success).toBe(true)

    // What the old cancel paths could do: rewrite the whole slot list from a stale read.
    await doctorModel.updateOne({ _id: testIds.doctorId }, { slots_booked: {} })

    const res = await book(other, slot)
    expect(res.body.success).toBe(false)
    expect(await appointmentModel.countDocuments({ docId: testIds.doctorId, ...slot, cancelled: false })).toBe(1)
  })

  it('a double click returns the same appointment instead of an error', async () => {
    const token = await patientToken()
    const slot = clinicSlot()
    const [first, second] = await Promise.all([book(token, slot), book(token, slot)])
    const winner = first.body.success ? first : second
    expect(winner.body.success).toBe(true)
    const retry = await book(token, slot)
    expect(retry.body.success).toBe(true)
    expect(retry.body.alreadyBooked).toBe(true)
    expect(String(retry.body.appointmentId)).toBe(String(winner.body.appointmentId))
    expect(await appointmentModel.countDocuments({ userId: testIds.patientId })).toBe(1)
  })

  it('stops a patient being in two places at once', async () => {
    const token = await patientToken()
    const slot = clinicSlot()
    expect((await book(token, slot)).body.success).toBe(true)

    const hash = (await doctorModel.findById(testIds.doctorId)).password
    const otherDoctor = await doctorModel.create({
      ...(await doctorModel.findById(testIds.doctorId).lean()),
      _id: new mongoose.Types.ObjectId(),
      email: 'other-doctor@test.com',
      password: hash,
      slots_booked: {}
    })
    const res = await book(token, { ...slot, docId: String(otherDoctor._id) })
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/another appointment/)
  })
})

describe('time zones', () => {
  it('rejects a slot already past in Cairo even though it is still ahead in UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // 10:30 in Cairo is 08:30 UTC in winter. A server in UTC used to think 09:30 was still ahead.
    vi.setSystemTime(new Date('2030-01-16T08:30:00.000Z'))
    try {
      const token = jwt.sign({ id: testIds.patientId, userId: testIds.patientId, role: 'patient' }, process.env.JWT_SECRET)
      const res = await book(token, { slotDate: '16_1_2030', slotTime: '09:30 AM' })
      expect(res.body.success).toBe(false)
      expect(res.body.message).toMatch(/past/)

      const later = await book(token, { slotDate: '16_1_2030', slotTime: '11:30 AM' })
      expect(later.body.success).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('availability counts "today" in clinic time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // 23:00 UTC on the 15th is already the 16th in Cairo.
    vi.setSystemTime(new Date('2030-01-15T23:00:00.000Z'))
    try {
      const res = await api().get(`/api/user/availability/${testIds.doctorId}`).query({ appointmentType: 'Clinic' })
      expect(res.body.success).toBe(true)
      expect(res.body.days[0].slotDate).toBe('16_1_2030')
      expect(res.body.timeZone).toBe('Africa/Cairo')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('availability and next available', () => {
  it('shows only slots the booking call would accept, and marks taken ones', async () => {
    const token = await patientToken()
    const slot = clinicSlot('09:30 AM')
    await book(token, slot)

    const res = await api().get(`/api/user/availability/${testIds.doctorId}`).query({ appointmentType: 'Clinic' })
    const day = res.body.days.find((row) => row.slotDate === slot.slotDate)
    expect(day.slots.find((row) => row.time === '09:30 AM')).toMatchObject({ available: false, status: 'taken' })
    expect(day.slots.find((row) => row.time === '10:00 AM')).toMatchObject({ available: true })
    expect(res.body.nextAvailable).toBeTruthy()

    const nextSlot = res.body.nextAvailable
    const { token: other } = await secondPatient()
    const booked = await book(other, { slotDate: nextSlot.slotDate, slotTime: nextSlot.slotTime })
    expect(booked.body.success).toBe(true)
  })

  it('finds the soonest doctor across a speciality and never exposes staff data', async () => {
    const seed = await doctorModel.findById(testIds.doctorId).lean()
    const later = { ...seed.schedule, startTime: '15:00', endTime: '17:00', workingDays: [0, 1, 2, 3, 4, 5, 6] }
    await doctorModel.create({
      ...seed,
      _id: new mongoose.Types.ObjectId(),
      name: 'Dr Later',
      email: 'later@test.com',
      schedule: later,
      homeVisitSchedule: { workingDays: [] },
      homeVisitAreas: [],
      slots_booked: {}
    })

    const res = await api().get('/api/user/next-available').query({ speciality: 'General', appointmentType: 'Clinic' })
    expect(res.body.success).toBe(true)
    expect(res.body.doctors.length).toBe(2)
    const times = res.body.doctors.map((row) => row.startsAt)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(JSON.stringify(res.body)).not.toMatch(/password|financialCompensation|slots_booked|mfa/)
  })
})

describe('pricing', () => {
  it('charges what the server calculated and ignores amounts from the client', async () => {
    const token = await patientToken()
    const res = await book(token, { ...clinicSlot(), amount: 1, originalAmount: 1 })
    expect(res.body.appointment.amount).toBe(500)
  })

  it('a home visit total adds up and the surcharge is stored', async () => {
    await separateHomeVisitDays()
    const token = await patientToken()
    const res = await book(token, {
      ...homeSlot(),
      appointmentType: 'Home Visit',
      clinicLocation: '',
      homeVisitAddress: { area: 'Cairo', street: 'Nile St 1' }
    })
    expect(res.body.success).toBe(true)
    const stored = await appointmentModel.findById(res.body.appointmentId)
    expect(stored.originalAmount).toBe(500)
    expect(stored.homeVisitSurcharge).toBe(250)
    expect(stored.amount).toBe(750)
  })

  it('the quote matches the booked amount, promo included', async () => {
    await doctorModel.updateOne({ _id: testIds.doctorId }, { promoCode: { code: 'SAVE10', discountType: 'percentage', discountValue: 10, active: true } })
    const quote = await api().get(`/api/user/booking-quote/${testIds.doctorId}`).query({ appointmentType: 'Clinic' })
    expect(quote.body.quote).toMatchObject({ baseAmount: 500, discountAmount: 50, amount: 450 })

    const token = await patientToken()
    const res = await book(token, clinicSlot())
    expect(res.body.appointment.amount).toBe(quote.body.quote.amount)
  })

  it('a fully discounted visit is recorded as free and paid, not as money due', async () => {
    await doctorModel.updateOne({ _id: testIds.doctorId }, { promoCode: { code: 'FREE', discountType: 'percentage', discountValue: 100, active: true } })
    const token = await patientToken()
    const res = await book(token, clinicSlot())
    expect(res.body.appointment).toMatchObject({ amount: 0, paymentMethod: 'Free', paymentStatus: 'Paid' })
  })

  it('uses global fees when the doctor has none', async () => {
    await doctorModel.updateOne({ _id: testIds.doctorId }, { fees: '' })
    await siteSettingModel.updateOne({ key: 'site-settings' }, { globalVisitFees: { enabled: true, examinationFee: 300, consultationFee: 150 } })
    const token = await patientToken()
    const res = await book(token, clinicSlot())
    expect(res.body.appointment.amount).toBe(300)
  })
})

describe('follow-up consultation eligibility', () => {
  const finishedExamination = (finishedAt, slot) => appointmentModel.create({
    userId: testIds.patientId,
    docId: testIds.doctorId,
    slotDate: slot.slotDate,
    slotTime: '08:00 AM',
    userData: { name: 'x' },
    docData: { name: 'y' },
    amount: 500,
    date: finishedAt - 40 * 86400000,
    statusUpdatedAt: finishedAt,
    appointmentStatus: 'Finished',
    isCompleted: true
  })

  it('counts 30 days from the finished visit, not from when it was booked', async () => {
    const token = await patientToken()
    await finishedExamination(Date.now() - 5 * 86400000, clinicSlot())
    const res = await book(token, { ...clinicSlot('10:00 AM'), visitFeeType: 'consultation' })
    expect(res.body.success).toBe(true)
    expect(res.body.appointment.amount).toBe(375)
  })

  it('refuses a follow-up whose visit date falls after the 30 days', async () => {
    const token = await patientToken()
    await finishedExamination(Date.now() - 29 * 86400000, clinicSlot())
    const res = await book(token, { ...clinicSlot('10:00 AM', 5), visitFeeType: 'consultation' })
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/30 days/)
  })
})

describe('online payment', () => {
  it('holds the slot at checkout so nobody can pay for a slot someone else is paying for', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const slot = clinicSlot()

    const first = await startCheckout(token, slot)
    expect(first.body.success).toBe(true)
    expect(first.body.amount).toBe(500)
    expect(first.body.holdExpiresAt).toBeGreaterThan(Date.now())

    const second = await startCheckout(other, slot)
    expect(second.body.success).toBe(false)
    expect(second.body.message).toMatch(/not available/)

    const cash = await book(other, slot)
    expect(cash.body.success).toBe(false)
  })

  it('a repeated checkout call reuses the same payment instead of a new charge', async () => {
    const token = await patientToken()
    const slot = clinicSlot()
    const first = await startCheckout(token, slot)
    const second = await startCheckout(token, slot)
    expect(second.body.paymentIntentId).toBe(first.body.paymentIntentId)
    expect(stripeState.counter).toBe(1)
  })

  it('confirming twice books once and never refunds the paid booking', async () => {
    const token = await patientToken()
    const slot = clinicSlot()
    const checkout = await startCheckout(token, slot)
    payIntent(checkout.body.paymentIntentId)

    const first = await confirmCheckout(token, checkout.body.paymentIntentId)
    const second = await confirmCheckout(token, checkout.body.paymentIntentId)

    expect(first.body.success).toBe(true)
    expect(second.body.success).toBe(true)
    expect(String(second.body.appointmentId)).toBe(String(first.body.appointmentId))
    expect(await appointmentModel.countDocuments({ stripePaymentIntentId: checkout.body.paymentIntentId })).toBe(1)
    expect(stripeState.refunds).toHaveLength(0)
    expect(first.body.appointment).toMatchObject({ paymentStatus: 'Paid', paymentMethod: 'Visa', amount: 500 })
  })

  it('simultaneous confirms still book once and never refund', async () => {
    const token = await patientToken()
    const checkout = await startCheckout(token, clinicSlot())
    payIntent(checkout.body.paymentIntentId)

    const results = await Promise.all([1, 2, 3].map(() => confirmCheckout(token, checkout.body.paymentIntentId)))
    expect(results.some((res) => res.body.success)).toBe(true)
    results.filter((res) => !res.body.success).forEach((res) => expect(res.body.pending).toBe(true))
    expect(await appointmentModel.countDocuments({ stripePaymentIntentId: checkout.body.paymentIntentId })).toBe(1)
    expect(stripeState.refunds).toHaveLength(0)
  })

  it('refuses to confirm another patient\'s payment', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const checkout = await startCheckout(token, clinicSlot())
    payIntent(checkout.body.paymentIntentId)
    const res = await confirmCheckout(other, checkout.body.paymentIntentId)
    expect(res.body.success).toBe(false)
    expect(await appointmentModel.countDocuments({})).toBe(0)
  })

  it('confirming an unpaid intent books nothing', async () => {
    const token = await patientToken()
    const checkout = await startCheckout(token, clinicSlot())
    const res = await confirmCheckout(token, checkout.body.paymentIntentId)
    expect(res.body.success).toBe(false)
    expect(await appointmentModel.countDocuments({})).toBe(0)
  })

  it('an abandoned checkout expires, cancels the charge and frees the slot', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const slot = clinicSlot()
    const checkout = await startCheckout(token, slot)
    await slotHoldModel.updateOne({ paymentIntentId: checkout.body.paymentIntentId }, { expiresAt: Date.now() - 1000 })

    const res = await book(other, slot)
    expect(res.body.success).toBe(true)
    expect(stripeState.intents.get(checkout.body.paymentIntentId).status).toBe('canceled')
  })

  it('paying after the hold expired wins the slot back if it is still free', async () => {
    const token = await patientToken()
    const slot = clinicSlot()
    const checkout = await startCheckout(token, slot)
    await slotHoldModel.updateOne({ paymentIntentId: checkout.body.paymentIntentId }, { state: 'expired', slotReleased: true })
    await doctorModel.updateOne({ _id: testIds.doctorId }, { $pull: { [`slots_booked.${slot.slotDate}`]: slot.slotTime } })
    payIntent(checkout.body.paymentIntentId)

    const res = await confirmCheckout(token, checkout.body.paymentIntentId)
    expect(res.body.success).toBe(true)
    expect(await bookedTimes(slot.slotDate)).toEqual([slot.slotTime])
  })

  it('paying after the hold expired and the slot went to someone else refunds exactly once', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const slot = clinicSlot()
    const checkout = await startCheckout(token, slot)
    await slotHoldModel.updateOne({ paymentIntentId: checkout.body.paymentIntentId }, { state: 'expired', slotReleased: true })
    await doctorModel.updateOne({ _id: testIds.doctorId }, { $pull: { [`slots_booked.${slot.slotDate}`]: slot.slotTime } })
    expect((await book(other, slot)).body.success).toBe(true)
    payIntent(checkout.body.paymentIntentId)

    const first = await confirmCheckout(token, checkout.body.paymentIntentId)
    const again = await confirmCheckout(token, checkout.body.paymentIntentId)

    expect(first.body.refunded).toBe(true)
    expect(again.body.refunded).toBe(true)
    expect(stripeState.refunds).toHaveLength(1)
    // The other patient keeps the slot.
    expect(await bookedTimes(slot.slotDate)).toEqual([slot.slotTime])
    expect(await appointmentModel.countDocuments({ ...slot, cancelled: false })).toBe(1)
  })

  it('recovers a paid booking when the browser never called confirm', async () => {
    const token = await patientToken()
    const slot = clinicSlot()
    const checkout = await startCheckout(token, slot)
    payIntent(checkout.body.paymentIntentId)

    const list = await api().get('/api/user/appointments').set(authHeader.patient(token))
    expect(list.body.appointments).toHaveLength(1)
    expect(list.body.appointments[0]).toMatchObject({ paymentStatus: 'Paid', stripePaymentIntentId: checkout.body.paymentIntentId })
  })

  it('the sweep keeps the slot for a patient who paid just before expiry', async () => {
    const token = await patientToken()
    const slot = clinicSlot()
    const checkout = await startCheckout(token, slot)
    payIntent(checkout.body.paymentIntentId)
    await slotHoldModel.updateOne({ paymentIntentId: checkout.body.paymentIntentId }, { expiresAt: Date.now() - 1000 })

    await sweepExpiredHolds({ docId: testIds.doctorId, force: true })
    expect(await appointmentModel.countDocuments({ stripePaymentIntentId: checkout.body.paymentIntentId })).toBe(1)
    expect(stripeState.refunds).toHaveLength(0)
  })

  it('moving to another slot lets the first one go', async () => {
    const token = await patientToken()
    const first = clinicSlot('09:30 AM')
    const second = clinicSlot('10:00 AM')
    const checkout = await startCheckout(token, first)
    await startCheckout(token, second)
    expect(await bookedTimes(first.slotDate)).toEqual([second.slotTime])
    expect(stripeState.intents.get(checkout.body.paymentIntentId).status).toBe('canceled')
  })

  it('backing out of checkout frees the slot at once', async () => {
    const token = await patientToken()
    const slot = clinicSlot()
    const checkout = await startCheckout(token, slot)
    const res = await api().post('/api/user/release-booking-hold').set(authHeader.patient(token)).send({ paymentIntentId: checkout.body.paymentIntentId })
    expect(res.body.released).toBe(true)
    expect(await bookedTimes(slot.slotDate)).toEqual([])
  })

  it('long home visit notes do not break Stripe metadata and survive into the appointment', async () => {
    await separateHomeVisitDays()
    const token = await patientToken()
    const notes = 'n'.repeat(900)
    const checkout = await startCheckout(token, {
      ...homeSlot(),
      appointmentType: 'Home Visit',
      clinicLocation: '',
      homeVisitAddress: { area: 'Cairo', street: 'Nile St', notes }
    })
    expect(checkout.body.success).toBe(true)
    Object.values(stripeState.intents.get(checkout.body.paymentIntentId).metadata).forEach((value) => expect(String(value).length).toBeLessThanOrEqual(500))

    payIntent(checkout.body.paymentIntentId)
    const res = await confirmCheckout(token, checkout.body.paymentIntentId)
    expect(res.body.appointment.homeVisitAddress.notes).toBe(notes)
    expect(res.body.appointment.homeVisitSurcharge).toBe(250)
    expect(res.body.appointment.amount).toBe(750)
  })

  it('validates the chosen branch schedule at checkout', async () => {
    await doctorModel.updateOne({ _id: testIds.doctorId }, {
      locations: ['Main Clinic', 'Second Clinic'],
      locationSchedules: {
        'Main Clinic': { workingDays: [0, 1, 2, 3, 4, 5, 6], startTime: '09:00', endTime: '12:00', slotDuration: 30 },
        'Second Clinic': { workingDays: [0, 1, 2, 3, 4, 5, 6], startTime: '15:00', endTime: '17:00', slotDuration: 30 }
      },
      homeVisitSchedule: { workingDays: [] }
    })
    const token = await patientToken()
    const { slotDate } = clinicSlot()
    const wrongBranch = await startCheckout(token, { slotDate, slotTime: '03:30 PM', clinicLocation: 'Main Clinic' })
    expect(wrongBranch.body.success).toBe(false)
    const rightBranch = await startCheckout(token, { slotDate, slotTime: '03:30 PM', clinicLocation: 'Second Clinic' })
    expect(rightBranch.body.success).toBe(true)
  })

  it('will not reserve a slot as unpaid Visa', async () => {
    const token = await patientToken()
    const slot = clinicSlot()
    const res = await book(token, { ...slot, paymentMethod: 'Visa' })
    expect(res.body.success).toBe(false)
    expect(await bookedTimes(slot.slotDate)).toEqual([])
  })
})

describe('paying later for a cash booking', () => {
  const payLaterIntent = (token, appointmentId) => api().post('/api/user/create-payment-intent').set(authHeader.patient(token)).send({ appointmentId })
  const confirmLater = (token, appointmentId, paymentIntentId) => api().post('/api/user/confirm-payment-intent').set(authHeader.patient(token)).send({ appointmentId, paymentIntentId })

  it('marks paid once however many times it is confirmed', async () => {
    const token = await patientToken()
    const booked = await book(token, clinicSlot())
    const intent = await payLaterIntent(token, booked.body.appointmentId)
    payIntent(intent.body.paymentIntentId)

    const first = await confirmLater(token, booked.body.appointmentId, intent.body.paymentIntentId)
    const paidAt = first.body.appointment.paidAt
    const second = await confirmLater(token, booked.body.appointmentId, intent.body.paymentIntentId)
    expect(second.body.success).toBe(true)
    expect(second.body.appointment.paidAt).toBe(paidAt)
    expect(second.body.appointment.paymentMethod).toBe('Visa')
  })

  it('keeps the chosen method until the money actually arrives', async () => {
    const token = await patientToken()
    const booked = await book(token, clinicSlot())
    await payLaterIntent(token, booked.body.appointmentId)
    expect((await appointmentModel.findById(booked.body.appointmentId)).paymentMethod).toBe('Cash')
  })

  it('a payment that lands after cancelling is refunded and does not mark the visit paid', async () => {
    const token = await patientToken()
    const booked = await book(token, clinicSlot())
    const intent = await payLaterIntent(token, booked.body.appointmentId)
    await cancel(token, booked.body.appointmentId)
    payIntent(intent.body.paymentIntentId)

    const res = await confirmLater(token, booked.body.appointmentId, intent.body.paymentIntentId)
    expect(res.body.refunded).toBe(true)
    expect(stripeState.refunds).toHaveLength(1)
    expect((await appointmentModel.findById(booked.body.appointmentId)).paymentStatus).toBe('Not Paid')
  })

  it('cannot re-mark a refunded visit as paid by replaying the old payment', async () => {
    const token = await patientToken()
    const booked = await book(token, clinicSlot())
    const intent = await payLaterIntent(token, booked.body.appointmentId)
    payIntent(intent.body.paymentIntentId)
    await confirmLater(token, booked.body.appointmentId, intent.body.paymentIntentId)
    await cancel(token, booked.body.appointmentId)

    const replay = await confirmLater(token, booked.body.appointmentId, intent.body.paymentIntentId)
    expect(replay.body.success).toBe(false)
    const stored = await appointmentModel.findById(booked.body.appointmentId)
    expect(stored.paymentStatus).toBe('Not Paid')
    expect(stored.refundStatus).toBe('Refunded')
  })

  it('refuses a payment for less than the amount due', async () => {
    const token = await patientToken()
    const booked = await book(token, clinicSlot())
    const intent = await payLaterIntent(token, booked.body.appointmentId)
    payIntent(intent.body.paymentIntentId)
    await appointmentModel.updateOne({ _id: booked.body.appointmentId }, { amount: 900 })

    const res = await confirmLater(token, booked.body.appointmentId, intent.body.paymentIntentId)
    expect(res.body.success).toBe(false)
    expect((await appointmentModel.findById(booked.body.appointmentId)).paymentStatus).toBe('Not Paid')
  })
})

describe('cancel and refund', () => {
  const paidBooking = async (token, slot = clinicSlot()) => {
    const checkout = await startCheckout(token, slot)
    payIntent(checkout.body.paymentIntentId)
    return (await confirmCheckout(token, checkout.body.paymentIntentId)).body.appointment
  }

  it('refunds once and frees the slot', async () => {
    const token = await patientToken()
    const slot = clinicSlot()
    const appointment = await paidBooking(token, slot)

    const res = await cancel(token, appointment._id)
    expect(res.body.success).toBe(true)
    const stored = await appointmentModel.findById(appointment._id)
    expect(stored).toMatchObject({ cancelled: true, refundStatus: 'Refunded', paymentStatus: 'Not Paid', refundAmount: 500 })
    expect(await bookedTimes(slot.slotDate)).toEqual([])
    expect(stripeState.refunds).toHaveLength(1)
  })

  it('cancelling twice does not free a slot someone else has since booked', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const slot = clinicSlot()
    const booked = await book(token, slot)
    await cancel(token, booked.body.appointmentId)
    expect((await book(other, slot)).body.success).toBe(true)

    const again = await cancel(token, booked.body.appointmentId)
    expect(again.body.success).toBe(true)
    expect(again.body.alreadyCancelled).toBe(true)
    expect(await bookedTimes(slot.slotDate)).toEqual([slot.slotTime])
  })

  it('simultaneous cancels refund once', async () => {
    const token = await patientToken()
    const appointment = await paidBooking(token)
    await Promise.all([cancel(token, appointment._id), cancel(token, appointment._id), cancel(token, appointment._id)])
    expect(stripeState.refunds).toHaveLength(1)
  })

  it('a finished visit cannot be cancelled for a refund', async () => {
    const token = await patientToken()
    const appointment = await paidBooking(token)
    await appointmentModel.updateOne({ _id: appointment._id }, { appointmentStatus: 'Finished', isCompleted: true })

    const res = await cancel(token, appointment._id)
    expect(res.body.success).toBe(false)
    expect(stripeState.refunds).toHaveLength(0)
    expect((await appointmentModel.findById(appointment._id)).appointmentStatus).toBe('Finished')
  })

  it('a checked-in visit cannot be cancelled', async () => {
    const token = await patientToken()
    const booked = await book(token, clinicSlot())
    await appointmentModel.updateOne({ _id: booked.body.appointmentId }, { appointmentStatus: 'Checked In' })
    expect((await cancel(token, booked.body.appointmentId)).body.success).toBe(false)
  })

  it('a visit whose time has passed cannot be cancelled for a refund', async () => {
    const token = await patientToken()
    const appointment = await paidBooking(token)
    await appointmentModel.updateOne({ _id: appointment._id }, { slotDate: '1_1_2020' })
    expect((await cancel(token, appointment._id)).body.success).toBe(false)
    expect(stripeState.refunds).toHaveLength(0)
  })

  it('a failed refund still cancels, is recorded, and retries', async () => {
    const token = await patientToken()
    const appointment = await paidBooking(token)
    const stripe = (await import('../../config/stripe.js')).default
    stripe.refunds.create.mockRejectedValueOnce(new Error('Stripe is down'))

    const res = await cancel(token, appointment._id)
    expect(res.body.success).toBe(true)
    let stored = await appointmentModel.findById(appointment._id)
    expect(stored).toMatchObject({ cancelled: true, refundStatus: 'Refund Failed', paymentStatus: 'Paid', refundAttempts: 1 })

    await api().get('/api/user/appointments').set(authHeader.patient(token))
    stored = await appointmentModel.findById(appointment._id)
    expect(stored).toMatchObject({ refundStatus: 'Refunded', paymentStatus: 'Not Paid' })
    expect(stripeState.refunds).toHaveLength(1)
  })

  it('another patient cannot cancel, and a missing id does not crash', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const booked = await book(token, clinicSlot())

    expect((await cancel(other, booked.body.appointmentId)).body.message).toBe('Unauthorized action')
    expect((await cancel(token, new mongoose.Types.ObjectId().toString())).body.message).toBe('Appointment not found')
    expect((await cancel(token, { $ne: null })).body.message).toBe('Appointment not found')
  })
})

describe('reschedule', () => {
  const reschedule = (token, appointmentId, slot) => api().post('/api/user/reschedule-appointment').set(authHeader.patient(token)).send({ appointmentId, ...slot })

  it('moves the visit, keeps the payment and frees the old slot', async () => {
    const token = await patientToken()
    const from = clinicSlot('09:30 AM')
    const to = clinicSlot('11:00 AM')
    const checkout = await startCheckout(token, from)
    payIntent(checkout.body.paymentIntentId)
    const { appointment } = (await confirmCheckout(token, checkout.body.paymentIntentId)).body

    const res = await reschedule(token, appointment._id, to)
    expect(res.body.success).toBe(true)
    expect(res.body.appointment).toMatchObject({ slotTime: '11:00 AM', paymentStatus: 'Paid', amount: 500, rescheduleCount: 1 })
    expect(await bookedTimes(from.slotDate)).toEqual(['11:00 AM'])
    expect(stripeState.refunds).toHaveLength(0)
  })

  it('a retry after success is not a conflict and does not count twice', async () => {
    const token = await patientToken()
    const booked = await book(token, clinicSlot('09:30 AM'))
    const to = clinicSlot('11:00 AM')
    await reschedule(token, booked.body.appointmentId, to)
    const retry = await reschedule(token, booked.body.appointmentId, to)
    expect(retry.body.success).toBe(true)
    expect(retry.body.appointment.rescheduleCount).toBe(1)
  })

  it('refuses a taken slot and keeps the original', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const from = clinicSlot('09:30 AM')
    const to = clinicSlot('11:00 AM')
    const booked = await book(token, from)
    await book(other, to)

    const res = await reschedule(token, booked.body.appointmentId, to)
    expect(res.body.success).toBe(false)
    expect((await appointmentModel.findById(booked.body.appointmentId)).slotTime).toBe('09:30 AM')
    expect((await bookedTimes(from.slotDate)).sort()).toEqual(['09:30 AM', '11:00 AM'])
  })

  it('two reschedules racing for one slot leave one winner and no lost slots', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const a = await book(token, clinicSlot('09:30 AM'))
    const b = await book(other, clinicSlot('10:00 AM'))
    const target = clinicSlot('11:00 AM')

    const results = await Promise.all([reschedule(token, a.body.appointmentId, target), reschedule(other, b.body.appointmentId, target)])
    expect(results.filter((res) => res.body.success)).toHaveLength(1)
    expect(await appointmentModel.countDocuments({ ...target, cancelled: false })).toBe(1)
    const live = await appointmentModel.find({ cancelled: false }).lean()
    expect((await bookedTimes(target.slotDate)).sort()).toEqual(live.map((row) => row.slotTime).sort())
  })

  it('cannot change a finished visit or someone else\'s', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const booked = await book(token, clinicSlot('09:30 AM'))
    const to = clinicSlot('11:00 AM')

    expect((await reschedule(other, booked.body.appointmentId, to)).body.message).toBe('Unauthorized action')
    await appointmentModel.updateOne({ _id: booked.body.appointmentId }, { appointmentStatus: 'Finished', isCompleted: true })
    expect((await reschedule(token, booked.body.appointmentId, to)).body.success).toBe(false)
  })

  it('stops after the limit', async () => {
    const token = await patientToken()
    const booked = await book(token, clinicSlot('09:30 AM'))
    await appointmentModel.updateOne({ _id: booked.body.appointmentId }, { rescheduleCount: 3 })
    const res = await reschedule(token, booked.body.appointmentId, clinicSlot('11:00 AM'))
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/too many/)
  })

  it('regenerates the call link for the new time', async () => {
    const token = await patientToken()
    const booked = await book(token, { ...clinicSlot('09:30 AM'), appointmentType: 'Video Call' })
    const before = booked.body.appointment.teleconsultationLink
    const res = await reschedule(token, booked.body.appointmentId, clinicSlot('11:00 AM'))
    expect(res.body.appointment.teleconsultationLink).not.toBe(before)
  })
})

describe('teleconsultation', () => {
  it('a voice call room opens with the camera off and a video call does not', async () => {
    const token = await patientToken()
    const voice = await book(token, { ...clinicSlot('09:30 AM'), appointmentType: 'Voice Call' })
    const video = await book(token, { ...clinicSlot('10:00 AM'), appointmentType: 'Video Call' })
    expect(voice.body.appointment.teleconsultationLink).toContain('startWithVideoMuted=true')
    expect(video.body.appointment.teleconsultationLink).not.toContain('startWithVideoMuted')
  })

  it('refuses a call type the doctor switched off', async () => {
    await doctorModel.updateOne({ _id: testIds.doctorId }, { acceptsVoiceCall: false })
    const token = await patientToken()
    const res = await book(token, { ...clinicSlot(), appointmentType: 'Voice Call' })
    expect(res.body.success).toBe(false)
  })

  it('hides the link once the visit is cancelled', async () => {
    const token = await patientToken()
    const booked = await book(token, { ...clinicSlot(), appointmentType: 'Video Call' })
    await cancel(token, booked.body.appointmentId)
    const list = await api().get('/api/user/appointments').set(authHeader.patient(token))
    expect(list.body.appointments[0].teleconsultationLink).toBe('')
  })
})

describe('insurance', () => {
  const insure = (fields = {}) => userModel.updateOne({ _id: testIds.patientId }, {
    insurance: { enabled: true, provider: 'AXA', fullName: 'T', birthDate: '1990-01-01', idNumber: '1', expiryDate: '2099-01-01', verificationStatus: 'approved', ...fields }
  })

  it('books with insurance and leaves the amount for reception to settle', async () => {
    await insure()
    const token = await patientToken()
    const res = await book(token, { ...clinicSlot(), paymentMethod: 'Insurance' })
    expect(res.body.success).toBe(true)
    expect(res.body.appointment).toMatchObject({ paymentMethod: 'Insurance', paymentStatus: 'Not Paid', amount: 500, canPayOnline: false })
  })

  it('refuses without a card, with an expired card, or a declined one', async () => {
    const token = await patientToken()
    expect((await book(token, { ...clinicSlot(), paymentMethod: 'Insurance' })).body.success).toBe(false)
    await insure({ expiryDate: '2000-01-01' })
    expect((await book(token, { ...clinicSlot(), paymentMethod: 'Insurance' })).body.message).toMatch(/expired/)
    await insure({ verificationStatus: 'declined' })
    expect((await book(token, { ...clinicSlot(), paymentMethod: 'Insurance' })).body.message).toMatch(/declined/)
  })
})

describe('privacy of appointment data', () => {
  it('the stored copy and the patient response carry no secrets or medical history', async () => {
    await userModel.updateOne({ _id: testIds.patientId }, { 'mfa.secret': 'PATIENTSECRET', resetOtp: 'OTPVALUE', 'medicalHistory.conditions': 'Diabetes' })
    await doctorModel.updateOne({ _id: testIds.doctorId }, { 'mfa.secret': 'DOCTORSECRET', 'financialCompensation.percentage': 40 })
    const token = await patientToken()
    const res = await book(token, clinicSlot())

    const stored = await appointmentModel.findById(res.body.appointmentId).lean()
    const storedText = JSON.stringify([stored.userData, stored.docData])
    expect(storedText).not.toMatch(/PATIENTSECRET|DOCTORSECRET|OTPVALUE|Diabetes|financialCompensation|"password"/)

    const list = await api().get('/api/user/appointments').set(authHeader.patient(token))
    expect(JSON.stringify(list.body)).not.toMatch(/PATIENTSECRET|DOCTORSECRET|financialCompensation|"password"/)
  })

  it('old records with secrets in their copy do not leak them to the patient', async () => {
    const token = await patientToken()
    const booked = await book(token, clinicSlot())
    await appointmentModel.updateOne({ _id: booked.body.appointmentId }, {
      docData: { name: 'x', mfa: { secret: 'LEGACYSECRET' }, password: 'hash' }
    })
    const list = await api().get('/api/user/appointments').set(authHeader.patient(token))
    expect(JSON.stringify(list.body)).not.toMatch(/LEGACYSECRET|hash/)
  })
})

describe('ratings', () => {
  const finished = async (token) => {
    const booked = await book(token, clinicSlot())
    await appointmentModel.updateOne({ _id: booked.body.appointmentId }, { appointmentStatus: 'Finished', isCompleted: true })
    return booked.body.appointmentId
  }
  const rate = (token, appointmentId, rating = 5) => api().post('/api/user/ratings').set(authHeader.patient(token)).send({ appointmentId, rating, comment: 'Great' })

  it('one rating per visit, even when submitted twice at once', async () => {
    const token = await patientToken()
    const id = await finished(token)
    const results = await Promise.all([rate(token, id), rate(token, id)])
    expect(results.filter((res) => res.body.success)).toHaveLength(1)
    expect(await ratingModel.countDocuments({ appointmentId: id })).toBe(1)
  })

  it('only after the visit is finished, and only by that patient', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const booked = await book(token, clinicSlot())
    expect((await rate(token, booked.body.appointmentId)).body.success).toBe(false)
    await appointmentModel.updateOne({ _id: booked.body.appointmentId }, { appointmentStatus: 'Finished', isCompleted: true })
    expect((await rate(other, booked.body.appointmentId)).body.success).toBe(false)
  })

  it('the public list hides patient ids and shortens names', async () => {
    const token = await patientToken()
    const id = await finished(token)
    await rate(token, id)
    const res = await api().get(`/api/user/doctor-ratings/${testIds.doctorId}`)
    expect(res.body.ratings[0]).toMatchObject({ rating: 5, comment: 'Great', patientName: 'Test P.' })
    expect(res.body.ratings[0].userId).toBeUndefined()
    expect(res.body.ratings[0].appointmentId).toBeUndefined()
    expect(res.body.summary.ratingCount).toBe(1)
  })
})

describe('documents', () => {
  it('downloads a calendar file in UTC for the clinic-time slot, only for the owner', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const booked = await book(token, { slotDate: clinicSlot().slotDate, slotTime: '09:30 AM' })
    const id = booked.body.appointmentId
    const stored = await appointmentModel.findById(id)

    const res = await api().get(`/api/user/appointments/${id}/calendar.ics`).set(authHeader.patient(token))
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/calendar/)
    const expected = slotStartDate(stored.slotDate, stored.slotTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
    expect(res.text).toContain(`DTSTART:${expected}`)
    expect(res.text).toContain(`UID:appointment-${id}@clinivo`)

    const denied = await api().get(`/api/user/appointments/${id}/calendar.ics`).set(authHeader.patient(other))
    expect(denied.status).toBe(404)
  })

  it('downloads the confirmation for the owner and an invoice only once paid', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const booked = await book(token, clinicSlot())
    const id = booked.body.appointmentId

    const pdf = await api().get(`/api/user/appointments/${id}/pdf`).set(authHeader.patient(token))
    expect(pdf.status).toBe(200)
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/)

    expect((await api().get(`/api/user/appointments/${id}/pdf`).query({ kind: 'invoice' }).set(authHeader.patient(token))).status).toBe(409)
    expect((await api().get(`/api/user/appointments/${id}/pdf`).set(authHeader.patient(other))).status).toBe(404)
  })

  it('downloads a prescription only for the owner', async () => {
    const token = await patientToken()
    const { token: other } = await secondPatient()
    const booked = await book(token, clinicSlot())
    const id = String(booked.body.appointmentId)
    await prescriptionModel.create({
      appointmentId: id,
      userId: testIds.patientId,
      docId: testIds.doctorId,
      slotDate: clinicSlot().slotDate,
      slotTime: '09:30 AM',
      amount: 500,
      diagnosis: 'نزلة برد',
      symptoms: 'Fever كحة',
      instructions: 'Rest',
      nextVisit: 'Two weeks',
      medicationItems: [{ name: 'Paracetamol', dosage: '500mg', frequency: 'Twice', duration: '5 days' }],
      userData: { name: 'مريض تجريبي' },
      docData: { name: 'Test' }
    })

    const res = await api().get(`/api/user/prescriptions/${id}/pdf`).set(authHeader.patient(token))
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/pdf/)
    expect((await api().get(`/api/user/prescriptions/${id}/pdf`).set(authHeader.patient(other))).status).toBe(404)
  })
})

describe('waitlist', () => {
  const fillDay = async (slotDate) => {
    const doctor = await doctorModel.findById(testIds.doctorId).lean()
    const times = []
    for (let minutes = 9 * 60; minutes + 30 <= 17 * 60; minutes += 30) {
      const hours24 = Math.floor(minutes / 60)
      times.push(`${String(hours24 % 12 || 12).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} ${hours24 >= 12 ? 'PM' : 'AM'}`)
    }
    await doctorModel.updateOne({ _id: doctor._id }, { [`slots_booked.${slotDate}`]: times })
    return times
  }
  const join = (token, slotDate) => api().post('/api/user/waitlist/join').set(authHeader.patient(token)).send({
    docId: testIds.doctorId, fromSlotDate: slotDate, appointmentType: 'Clinic', clinicLocation: 'Main Clinic'
  })
  const myWaitlist = async (token) => (await api().get('/api/user/waitlist').set(authHeader.patient(token))).body.entries

  it('refuses to join while slots are open', async () => {
    const token = await patientToken()
    const res = await join(token, clinicSlot().slotDate)
    expect(res.body.success).toBe(false)
    expect(res.body.slotsOpen).toBe(true)
  })

  it('joining twice keeps one place', async () => {
    const token = await patientToken()
    const { slotDate } = clinicSlot()
    await fillDay(slotDate)
    await join(token, slotDate)
    const again = await join(token, slotDate)
    expect(again.body.alreadyJoined).toBe(true)
    expect(await waitlistModel.countDocuments({ userId: testIds.patientId })).toBe(1)
  })

  it('a cancelled slot goes to the longest-waiting patient, reserved for them alone', async () => {
    const { token: canceller } = await secondPatient('2')
    const { token: firstWaiting } = await secondPatient('3')
    const { token: secondWaiting, user: secondUser } = await secondPatient('4')
    const slot = clinicSlot('09:30 AM')
    const booked = await book(canceller, slot)
    const times = await fillDay(slot.slotDate)
    expect(times).toContain('09:30 AM')

    await join(firstWaiting, slot.slotDate)
    await new Promise((resolve) => setTimeout(resolve, 5))
    await join(secondWaiting, slot.slotDate)

    expect((await cancel(canceller, booked.body.appointmentId)).body.success).toBe(true)

    const [offer] = await myWaitlist(firstWaiting)
    expect(offer).toMatchObject({ status: 'offered' })
    expect(offer.offer.slotTime).toBe('09:30 AM')
    const [waiting] = await myWaitlist(secondWaiting)
    expect(waiting).toMatchObject({ status: 'waiting' })

    // Nobody else can take it while it is reserved.
    expect((await book(secondWaiting, slot)).body.success).toBe(false)
    expect(secondUser).toBeTruthy()

    // The offered patient can.
    const claim = await book(firstWaiting, slot)
    expect(claim.body.success).toBe(true)
    expect(await myWaitlist(firstWaiting)).toHaveLength(0)
    expect(await slotHoldModel.countDocuments({ state: 'held' })).toBe(0)
  })

  it('an offer that lapses moves on to the next patient and not back to the first', async () => {
    const { token: canceller } = await secondPatient('2')
    const { token: firstWaiting } = await secondPatient('3')
    const { token: secondWaiting } = await secondPatient('4')
    const slot = clinicSlot('09:30 AM')
    const booked = await book(canceller, slot)
    await fillDay(slot.slotDate)
    await join(firstWaiting, slot.slotDate)
    await new Promise((resolve) => setTimeout(resolve, 5))
    await join(secondWaiting, slot.slotDate)
    await cancel(canceller, booked.body.appointmentId)

    await slotHoldModel.updateOne({ state: 'held' }, { expiresAt: Date.now() - 1000 })
    await sweepExpiredHolds({ docId: testIds.doctorId, force: true })

    expect((await myWaitlist(secondWaiting))[0]).toMatchObject({ status: 'offered' })
    expect((await myWaitlist(firstWaiting))[0]).toMatchObject({ status: 'waiting' })
  })

  it('declining passes it on straight away', async () => {
    const { token: canceller } = await secondPatient('2')
    const { token: firstWaiting } = await secondPatient('3')
    const { token: secondWaiting } = await secondPatient('4')
    const slot = clinicSlot('09:30 AM')
    const booked = await book(canceller, slot)
    await fillDay(slot.slotDate)
    await join(firstWaiting, slot.slotDate)
    await new Promise((resolve) => setTimeout(resolve, 5))
    await join(secondWaiting, slot.slotDate)
    await cancel(canceller, booked.body.appointmentId)

    const [offer] = await myWaitlist(firstWaiting)
    await api().post('/api/user/waitlist/leave').set(authHeader.patient(firstWaiting)).send({ entryId: offer._id })

    expect((await myWaitlist(secondWaiting))[0]).toMatchObject({ status: 'offered' })
  })

  it('an offer can be paid for online', async () => {
    const { token: canceller } = await secondPatient('2')
    const { token: waiting } = await secondPatient('3')
    const slot = clinicSlot('09:30 AM')
    const booked = await book(canceller, slot)
    await fillDay(slot.slotDate)
    await join(waiting, slot.slotDate)
    await cancel(canceller, booked.body.appointmentId)

    const checkout = await startCheckout(waiting, slot)
    expect(checkout.body.success).toBe(true)
    payIntent(checkout.body.paymentIntentId)
    const res = await confirmCheckout(waiting, checkout.body.paymentIntentId)
    expect(res.body.success).toBe(true)
    expect(await myWaitlist(waiting)).toHaveLength(0)
  })

  it('picks up a slot freed by another role on the next availability read', async () => {
    const { token: bookedPatient } = await secondPatient('2')
    const { token: waiting } = await secondPatient('3')
    const slot = clinicSlot('09:30 AM')
    const booked = await book(bookedPatient, slot)
    await fillDay(slot.slotDate)
    await join(waiting, slot.slotDate)

    // As the reception and admin screens do it today: no waitlist call.
    await appointmentModel.updateOne({ _id: booked.body.appointmentId }, { cancelled: true, appointmentStatus: 'Cancelled' })
    await doctorModel.updateOne({ _id: testIds.doctorId }, { $pull: { [`slots_booked.${slot.slotDate}`]: slot.slotTime } })

    resetSweepThrottle()
    await api().get(`/api/user/availability/${testIds.doctorId}`).query({ appointmentType: 'Clinic' })
    expect((await myWaitlist(waiting))[0]).toMatchObject({ status: 'offered' })
  })
})
