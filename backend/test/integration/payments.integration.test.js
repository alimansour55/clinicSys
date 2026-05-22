import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api, loginPatient, authHeader, futureBookingSlot } from './helpers/harness.js'
import { testIds } from './helpers/seed.js'

vi.mock('../../config/stripe.js', () => ({
  default: {
    paymentIntents: {
      create: vi.fn().mockResolvedValue({
        id: 'pi_test_integration',
        client_secret: 'cs_test_secret',
        status: 'requires_payment_method',
      }),
      retrieve: vi.fn().mockResolvedValue({
        id: 'pi_test_integration',
        status: 'succeeded',
        metadata: {},
        latest_charge: 'ch_test',
      }),
    },
    refunds: { create: vi.fn().mockResolvedValue({ id: 're_test' }) },
  },
  stripeCurrency: 'egp',
}))

describe('T3.12 Payments (mocked Stripe)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates booking payment intent for Visa flow', async () => {
    const loginRes = await loginPatient()
    const { slotDate, slotTime } = futureBookingSlot(3)

    const res = await api()
      .post('/api/user/create-booking-payment-intent')
      .set(authHeader.patient(loginRes.body.token))
      .send({
        docId: testIds.doctorId,
        slotDate,
        slotTime,
        appointmentType: 'Clinic',
        clinicLocation: 'Main Clinic',
      })

    expect(res.body.success).toBe(true)
    expect(res.body.clientSecret).toBe('cs_test_secret')
  })
})
