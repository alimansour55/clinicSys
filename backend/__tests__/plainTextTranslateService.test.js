import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  translatePlainTextForTarget,
  resolvePlainTextTranslationsBatch,
} from '../services/plainTextTranslateService.js'

vi.mock('../models/contentTranslationCacheModel.js', () => ({
  default: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn().mockResolvedValue({}),
  },
}))

import contentTranslationCacheModel from '../models/contentTranslationCacheModel.js'

describe('plainTextTranslateService', () => {
  beforeEach(() => {
    vi.mocked(contentTranslationCacheModel.findOne).mockReset()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns Arabic text unchanged when target is ar and no Latin letters', async () => {
    expect(await translatePlainTextForTarget('نص عربي', 'ar')).toBe('نص عربي')
  })

  it('returns English text unchanged when target is en and no Arabic', async () => {
    expect(await translatePlainTextForTarget('Hello doctor', 'en')).toBe('Hello doctor')
  })

  it('uses cache hit when available', async () => {
    contentTranslationCacheModel.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ translated: 'مرحبا' }),
    })
    expect(await translatePlainTextForTarget('Hello', 'ar')).toBe('مرحبا')
  })

  it('translates via mocked Google API', async () => {
    vi.stubEnv('GOOGLE_TRANSLATE_API_KEY', 'key')
    contentTranslationCacheModel.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { translations: [{ translatedText: 'وصف الطبيب' }] } }),
    })

    const result = await translatePlainTextForTarget('Doctor bio text', 'ar')
    expect(result).toBe('وصف الطبيب')
    vi.unstubAllEnvs()
  })

  it('resolvePlainTextTranslationsBatch returns map', async () => {
    contentTranslationCacheModel.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ translated: 'أ' }),
    })
    const map = await resolvePlainTextTranslationsBatch(['Line A'], 'ar')
    expect(map['Line A']).toBe('أ')
  })
})
