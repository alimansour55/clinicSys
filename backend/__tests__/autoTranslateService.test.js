import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  translatePlaceOrClinicName,
  resolvePlaceTranslationsBatch,
} from '../services/autoTranslateService.js'

vi.mock('../models/translationCacheModel.js', () => ({
  default: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn().mockResolvedValue({}),
  },
}))

import translationCacheModel from '../models/translationCacheModel.js'

describe('autoTranslateService', () => {
  beforeEach(() => {
    vi.mocked(translationCacheModel.findOne).mockReset()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns Arabic text unchanged', async () => {
    expect(await translatePlaceOrClinicName('القاهرة')).toBe('القاهرة')
  })

  it('uses static dictionary for known places', async () => {
    expect(await translatePlaceOrClinicName('New Cairo')).toBe('القاهرة الجديدة')
  })

  it('uses Mongo cache when present', async () => {
    translationCacheModel.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ valueAr: 'من الكاش' }),
    })
    expect(await translatePlaceOrClinicName('Some District')).toBe('من الكاش')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls Google translate API and caches result', async () => {
    vi.stubEnv('GOOGLE_TRANSLATE_API_KEY', 'test-key')
    translationCacheModel.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { translations: [{ translatedText: 'حي جديد' }] } }),
    })

    const result = await translatePlaceOrClinicName('New District XYZ')
    expect(result).toBe('حي جديد')
    expect(translationCacheModel.findOneAndUpdate).toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('resolvePlaceTranslationsBatch maps multiple originals', async () => {
    const batch = await resolvePlaceTranslationsBatch(['Cairo', 'Cairo'])
    expect(batch.Cairo).toBe('القاهرة')
    expect(batch.cairo).toBe('القاهرة')
  })
})
