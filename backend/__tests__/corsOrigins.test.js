import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCorsOriginConfig, PRODUCTION_CORS_ORIGINS } from '../config/corsOrigins.js'

describe('getCorsOriginConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    delete process.env.VERCEL
    delete process.env.APP_ENV
    delete process.env.NODE_ENV
    delete process.env.CORS_ORIGINS
  })

  it('allows all origins in local dev when CORS_ORIGINS is unset', () => {
    expect(getCorsOriginConfig()).toBe(true)
  })

  it('merges env origins with production defaults on Vercel', () => {
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('CORS_ORIGINS', 'https://my-admin.vercel.app')
    expect(getCorsOriginConfig()).toEqual([
      ...PRODUCTION_CORS_ORIGINS,
      'https://my-admin.vercel.app',
    ])
  })

  it('uses production defaults when CORS_ORIGINS is empty on Vercel', () => {
    vi.stubEnv('VERCEL', '1')
    expect(getCorsOriginConfig()).toEqual([...PRODUCTION_CORS_ORIGINS])
  })
})
