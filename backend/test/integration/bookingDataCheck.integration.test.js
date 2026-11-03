import { describe, expect, it } from 'vitest'
import appointmentModel from '../../models/appointmentModel.js'
import { checkBookingData, scrubSnapshots } from '../../scripts/check-booking-data.js'

const row = (fields) => ({
  userId: 'u', docId: 'd', slotDate: '5_11_2026', slotTime: '10:00 AM', userData: { name: 'p' }, docData: { name: 'd' }, amount: 1, date: 1, ...fields
})

describe('check-booking-data script', () => {
  it('reports what would block the new indexes, and scrubs copied secrets', async () => {
    // Old data predates the indexes, so drop them to recreate that state.
    await appointmentModel.init()
    await appointmentModel.collection.dropIndexes()
    await appointmentModel.collection.insertMany([
      row({ cancelled: false }),
      row({ cancelled: false, userId: 'u2' }),
      row({ cancelled: false, docId: 'd2', slotTime: '10:00', stripePaymentIntentId: 'pi_1', docData: { name: 'x', mfa: { secret: 'S' }, password: 'h' } }),
      row({ cancelled: true, docId: 'd3', stripePaymentIntentId: 'pi_1', userData: { name: 'y', medicalHistory: { conditions: 'c' } } })
    ])

    const lines = []
    const report = await checkBookingData({ log: (line) => lines.push(line) })
    expect(report).toEqual({ doubleBooked: 1, sharedPayments: 1, oddFormat: 1, withSecrets: 2 })

    expect(await scrubSnapshots()).toBe(2)
    const left = JSON.stringify(await appointmentModel.collection.find({}).toArray())
    expect(left).not.toMatch(/"mfa"|"password"|medicalHistory/)
    expect((await checkBookingData({ log: () => {} })).withSecrets).toBe(0)

    await appointmentModel.collection.deleteMany({})
    await appointmentModel.syncIndexes()
  })
})
