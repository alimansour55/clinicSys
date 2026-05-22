import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../models/clinicModel.js', () => ({
  default: {
    find: vi.fn(),
  },
}))

import clinicModel from '../models/clinicModel.js'
import {
  enrichDoctorWithSpecialityClinic,
  normalizePlaceKey,
  resolveClinicIdsForDoctor
} from '../utils/doctorClinicLink.js'

describe('doctorClinicLink', () => {
  beforeEach(() => {
    vi.mocked(clinicModel.find).mockReturnValue({
      select: () => ({
        lean: async () => [
          { _id: 'clinic1', name: 'General physician' },
          { _id: 'clinic2', name: 'Dermatologist' },
        ],
      }),
    })
  })

  it('normalizes place keys case-insensitively', () => {
    expect(normalizePlaceKey(' General Physician ')).toBe('general physician')
  })

  it('adds clinic id when speciality matches clinic name', async () => {
    const ids = await resolveClinicIdsForDoctor('General physician', [])
    expect(ids).toEqual(['clinic1'])
  })

  it('keeps explicit clinic ids and adds speciality match', async () => {
    const ids = await resolveClinicIdsForDoctor('Dermatologist', ['explicit99'])
    expect(ids).toEqual(['explicit99', 'clinic2'])
  })

  it('enriches list payloads with the speciality clinic when clinics array is empty', () => {
    const map = new Map([['general physician', { _id: 'clinic1', name: 'General physician' }]])
    const enriched = enrichDoctorWithSpecialityClinic(
      { speciality: 'General physician', clinics: [] },
      map
    )
    expect(enriched.clinics).toEqual([{ _id: 'clinic1', name: 'General physician' }])
  })
})
