import { describe, expect, it } from 'vitest'
import {
  buildAdminAuthHeaders,
  buildDoctorAuthHeaders,
  buildReceptionistAuthHeaders,
  buildStaffAuthHeaders,
} from './staffAuthHeaders'

describe('staffAuthHeaders', () => {
  it('uses lowercase header names expected by the API', () => {
    expect(buildAdminAuthHeaders('admin-jwt')).toEqual({ atoken: 'admin-jwt' })
    expect(buildDoctorAuthHeaders('doc-jwt')).toEqual({ dtoken: 'doc-jwt' })
    expect(buildReceptionistAuthHeaders('rec-jwt')).toEqual({ rtoken: 'rec-jwt' })
  })

  it('prefers admin token when multiple are present', () => {
    expect(buildStaffAuthHeaders({ aToken: 'a', dToken: 'd', rToken: 'r' })).toEqual({ atoken: 'a' })
  })

  it('returns null when no token is provided', () => {
    expect(buildStaffAuthHeaders({})).toBeNull()
    expect(buildAdminAuthHeaders('')).toEqual({})
  })
})
