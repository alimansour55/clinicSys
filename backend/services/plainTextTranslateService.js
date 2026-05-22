import crypto from 'crypto'
import contentTranslationCacheModel from '../models/contentTranslationCacheModel.js'

const hasArabic = (s) => /[\u0600-\u06FF]/.test(String(s || ''))
const hasLatinLetters = (s) => /[A-Za-z]/.test(String(s || ''))

const makeCacheKey = (text, targetLang) =>
  crypto.createHash('sha256').update(`${String(text).trim()}\n${targetLang}`).digest('hex')

const CHUNK = 4500

function splitForTranslate(text) {
  const t = String(text || '').trim()
  if (t.length <= CHUNK) return [t]
  const parts = []
  let rest = t
  while (rest.length > CHUNK) {
    const slice = rest.slice(0, CHUNK)
    const breakAt = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '), slice.lastIndexOf('\n'))
    const cut = breakAt > CHUNK * 0.4 ? breakAt + 1 : CHUNK
    parts.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) parts.push(rest)
  return parts.filter(Boolean)
}

async function googleTranslate(text, targetLang) {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!key || !text) return null
  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, target: targetLang, format: 'text' })
    })
    if (!r.ok) return null
    const data = await r.json()
    const out = data?.data?.translations?.[0]?.translatedText
    return out ? String(out).trim() : null
  } catch {
    return null
  }
}

async function libreTranslate(text, targetLang) {
  if (!text) return null
  const base = (process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com').replace(/\/$/, '')
  const apiKey = process.env.LIBRETRANSLATE_API_KEY || ''
  try {
    const r = await fetch(`${base}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'auto',
        target: targetLang,
        format: 'text',
        ...(apiKey ? { api_key: apiKey } : {})
      })
    })
    if (!r.ok) return null
    const data = await r.json()
    const out = data?.translatedText
    return out ? String(out).trim() : null
  } catch {
    return null
  }
}

async function translateChunk(text, targetLang) {
  let translated = await googleTranslate(text, targetLang)
  let source = 'google'
  if (!translated) {
    translated = await libreTranslate(text, targetLang)
    source = 'libre'
  }
  return { translated, source }
}

async function persist(cacheKey, targetLang, translated, source) {
  if (!cacheKey || !translated) return
  try {
    await contentTranslationCacheModel.findOneAndUpdate(
      { cacheKey },
      { $set: { targetLang, translated, source } },
      { upsert: true, new: true }
    )
  } catch (e) {
    console.warn('contentTranslationCache upsert failed', e.message)
  }
}

/**
 * @param {string} original
 * @param {'ar'|'en'} targetLang
 * @returns {Promise<string>} same string if no translation needed / failed
 */
export async function translatePlainTextForTarget(original, targetLang) {
  const raw = String(original || '').trim()
  if (!raw || (targetLang !== 'ar' && targetLang !== 'en')) return raw

  if (targetLang === 'ar' && !hasLatinLetters(raw)) return raw
  if (targetLang === 'en' && !hasArabic(raw)) return raw

  const cacheKey = makeCacheKey(raw, targetLang)
  try {
    const hit = await contentTranslationCacheModel.findOne({ cacheKey }).lean()
    if (hit?.translated) return hit.translated
  } catch {
    /* ignore */
  }

  const chunks = splitForTranslate(raw)
  const outs = []
  let usedSource = 'libre'
  for (const chunk of chunks) {
    const { translated, source } = await translateChunk(chunk, targetLang)
    usedSource = source
    if (!translated) return raw
    outs.push(translated)
  }
  const merged = outs.join('\n\n').trim()
  if (!merged || merged === raw) return raw

  await persist(cacheKey, targetLang, merged, usedSource)
  return merged
}

/**
 * @param {string[]} originals trimmed unique strings
 * @param {'ar'|'en'} targetLang
 * @returns {Promise<Record<string, string>>}
 */
export async function resolvePlainTextTranslationsBatch(originals = [], targetLang = 'ar') {
  const out = {}
  const unique = [...new Set(originals.map((s) => String(s || '').trim()).filter(Boolean))]
  const concurrency = 2
  for (let i = 0; i < unique.length; i += concurrency) {
    const chunk = unique.slice(i, i + concurrency)
    await Promise.all(
      chunk.map(async (orig) => {
        const tr = await translatePlainTextForTarget(orig, targetLang)
        out[orig] = tr
      })
    )
  }
  return out
}
