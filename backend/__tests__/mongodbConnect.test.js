import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('mongodb connect config', () => {
  const originalUri = process.env.MONGODB_URI
  const originalVercel = process.env.VERCEL

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    if (originalUri === undefined) delete process.env.MONGODB_URI
    else process.env.MONGODB_URI = originalUri
    if (originalVercel === undefined) delete process.env.VERCEL
    else process.env.VERCEL = originalVercel
  })

  it('throws on Vercel when MONGODB_URI is missing', async () => {
    delete process.env.MONGODB_URI
    process.env.VERCEL = '1'
    const { getMongoUriOrThrow, MONGODB_URI_MISSING_MESSAGE } = await import('../config/mongodb.js')
    expect(() => getMongoUriOrThrow()).toThrow(MONGODB_URI_MISSING_MESSAGE)
  })

  it('returns trimmed URI when set', async () => {
    process.env.MONGODB_URI = '  mongodb://localhost:27017/test  '
    delete process.env.VERCEL
    const { getMongoUriOrThrow } = await import('../config/mongodb.js')
    expect(getMongoUriOrThrow()).toBe('mongodb://localhost:27017/test')
  })
})
