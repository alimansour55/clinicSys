import { resolvePlaceTranslationsBatch } from '../services/autoTranslateService.js'
import { resolvePlainTextTranslationsBatch } from '../services/plainTextTranslateService.js'

const WINDOW_MS = 60_000
const MAX_PER_IP = 50
const MAX_STRINGS = 60
const MAX_EACH = 100

const TEXT_WINDOW_MS = 60_000
const TEXT_MAX_PER_IP = 24
const TEXT_MAX_STRINGS = 24
const TEXT_MAX_EACH = 8000

const hitMap = new Map()
const textHitMap = new Map()

const rateLimitOk = (ip) => {
  const key = String(ip || 'unknown')
  const now = Date.now()
  let row = hitMap.get(key)
  if (!row || now > row.resetAt) {
    row = { count: 0, resetAt: now + WINDOW_MS }
  }
  row.count += 1
  hitMap.set(key, row)
  if (row.count > MAX_PER_IP) return false
  return true
}

const textRateLimitOk = (ip) => {
  const key = String(ip || 'unknown')
  const now = Date.now()
  let row = textHitMap.get(key)
  if (!row || now > row.resetAt) {
    row = { count: 0, resetAt: now + TEXT_WINDOW_MS }
  }
  row.count += 1
  textHitMap.set(key, row)
  if (row.count > TEXT_MAX_PER_IP) return false
  return true
}

export const postTranslatePlaces = async (req, res) => {
  try {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    if (!rateLimitOk(ip)) {
      return res.status(429).json({ success: false, message: 'Too many requests' })
    }

    const raw = req.body?.texts
    if (!Array.isArray(raw)) {
      return res.json({ success: false, message: 'texts array required' })
    }

    const texts = [...new Set(raw.map((t) => String(t || '').trim()).filter(Boolean))]
      .filter((s) => s.length <= MAX_EACH)
      .slice(0, MAX_STRINGS)

    if (texts.length === 0) {
      return res.json({ success: true, translations: {} })
    }

    const translations = await resolvePlaceTranslationsBatch(texts)
    res.json({ success: true, translations })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

/** Longer free-text (e.g. doctor about) → UI language; Mongo-cached. */
export const postTranslateTexts = async (req, res) => {
  try {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    if (!textRateLimitOk(ip)) {
      return res.status(429).json({ success: false, message: 'Too many requests' })
    }

    const raw = req.body?.texts
    if (!Array.isArray(raw)) {
      return res.json({ success: false, message: 'texts array required' })
    }

    const target = req.body?.target === 'en' ? 'en' : 'ar'

    const texts = [...new Set(raw.map((t) => String(t || '').trim()).filter(Boolean))]
      .filter((s) => s.length <= TEXT_MAX_EACH)
      .slice(0, TEXT_MAX_STRINGS)

    if (texts.length === 0) {
      return res.json({ success: true, translations: {} })
    }

    const translations = await resolvePlainTextTranslationsBatch(texts, target)
    res.json({ success: true, translations })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}
