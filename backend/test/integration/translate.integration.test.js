import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from './helpers/harness.js'

vi.mock('../../services/autoTranslateService.js', () => ({
  resolvePlaceTranslationsBatch: vi.fn(async (originals) => {
    const out = {}
    for (const o of originals) out[o] = `AR:${o}`
    return out
  }),
}))

vi.mock('../../services/plainTextTranslateService.js', () => ({
  resolvePlainTextTranslationsBatch: vi.fn(async (originals) => {
    const out = {}
    for (const o of originals) out[o] = `TR:${o}`
    return out
  }),
}))

describe('T3.19 Translate endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('translates place names', async () => {
    const res = await api()
      .post('/api/user/translate-places')
      .send({ texts: ['Cairo', 'Maadi'] })
    expect(res.body.success).toBe(true)
    expect(res.body.translations.Cairo).toBe('AR:Cairo')
  })

  it('translates plain texts', async () => {
    const res = await api()
      .post('/api/user/translate-texts')
      .send({ texts: ['About the clinic'], target: 'ar' })
    expect(res.body.success).toBe(true)
    expect(res.body.translations['About the clinic']).toBe('TR:About the clinic')
  })
})
