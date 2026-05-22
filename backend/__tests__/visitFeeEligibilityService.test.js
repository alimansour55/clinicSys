import { describe, it, expect, vi, beforeEach } from 'vitest'
import { patientCanBookConsultation } from '../services/visitFeeEligibilityService.js'
import { mockFindChain } from './helpers/mockChain.js'

vi.mock('../models/appointmentModel.js', () => ({
  default: { find: vi.fn() },
}))

import appointmentModel from '../models/appointmentModel.js'

describe('visitFeeEligibilityService', () => {
  beforeEach(() => {
    vi.mocked(appointmentModel.find).mockReset()
  })

  it('returns false when userId or docId missing', async () => {
    expect(await patientCanBookConsultation('', 'doc1')).toEqual({ allowed: false, lastExaminationAt: null })
    expect(await patientCanBookConsultation('u1', '')).toEqual({ allowed: false, lastExaminationAt: null })
  })

  it('allows consultation when recent completed examination exists', async () => {
    const examDate = Date.now() - 5 * 24 * 60 * 60 * 1000
    const chain = mockFindChain([
      { visitFeeType: 'examination', isCompleted: true, appointmentStatus: 'Finished', date: examDate },
    ])
    appointmentModel.find.mockReturnValue(chain)

    const result = await patientCanBookConsultation('user1', 'doc1')
    expect(result.allowed).toBe(true)
    expect(result.lastExaminationAt).toBe(examDate)
  })

  it('denies when only cancelled or consultation visits exist', async () => {
    const chain = mockFindChain([
      { visitFeeType: 'examination', cancelled: true, date: Date.now() },
      { visitFeeType: 'consultation', isCompleted: true, appointmentStatus: 'Finished', date: Date.now() },
    ])
    appointmentModel.find.mockReturnValue(chain)

    const result = await patientCanBookConsultation('user1', 'doc1')
    expect(result.allowed).toBe(false)
  })
})
