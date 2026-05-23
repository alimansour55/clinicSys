import { describe, it, expect } from 'vitest'
import { getApiErrorMessage, isDatabaseConfig503 } from './apiErrorMessage'

describe('apiErrorMessage', () => {
  it('detects missing MONGODB_URI 503', () => {
    const error = {
      response: {
        status: 503,
        data: { message: 'MONGODB_URI is not configured on the server' },
      },
    }
    expect(isDatabaseConfig503(error)).toBe(true)
    expect(getApiErrorMessage(error)).toMatch(/MONGODB_URI|database not configured/i)
  })

  it('returns generic 503 message', () => {
    const error = {
      response: { status: 503, data: { message: 'Database connection failed' } },
    }
    expect(isDatabaseConfig503(error)).toBe(false)
    expect(getApiErrorMessage(error)).toBe('Database connection failed')
  })
})
