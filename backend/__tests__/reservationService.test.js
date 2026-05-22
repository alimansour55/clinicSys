import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getNextReservationNumber } from '../services/reservationService.js'

vi.mock('../models/counterModel.js', () => ({
  default: {
    findByIdAndUpdate: vi.fn(),
  },
}))

import counterModel from '../models/counterModel.js'

describe('reservationService', () => {
  beforeEach(() => {
    vi.mocked(counterModel.findByIdAndUpdate).mockReset()
  })

  it('returns padded reservation numbers from counter', async () => {
    counterModel.findByIdAndUpdate.mockResolvedValue({ seq: 42 })

    const number = await getNextReservationNumber()

    expect(counterModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'reservationNumber',
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    )
    expect(number).toBe('RES000042')
  })
})
