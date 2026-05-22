/**
 * Auto-translate Latin place / clinic names to Arabic with Mongo cache.
 * Optional: GOOGLE_TRANSLATE_API_KEY (Google Cloud Translation v2).
 * Fallback: public LibreTranslate (set LIBRETRANSLATE_URL; may rate-limit).
 * Static dictionary: shared with frontend (see import path).
 */
import translationCacheModel from '../models/translationCacheModel.js'
import { PLACE_NAMES_LATIN_TO_AR } from '../../frontend/src/data/placeNamesLatinToAr.js'

const norm = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ')

const normLookupKey = (s) => norm(s).replace(/[^a-z0-9 ]/g, '')

const staticLookup = (raw) => {
  const latinKey = normLookupKey(raw)
  if (!latinKey) return ''
  if (PLACE_NAMES_LATIN_TO_AR[latinKey]) return PLACE_NAMES_LATIN_TO_AR[latinKey]
  const compact = latinKey.replace(/\s+/g, '')
  const underscored = latinKey.replace(/\s+/g, '_')
  if (PLACE_NAMES_LATIN_TO_AR[compact]) return PLACE_NAMES_LATIN_TO_AR[compact]
  if (PLACE_NAMES_LATIN_TO_AR[underscored]) return PLACE_NAMES_LATIN_TO_AR[underscored]
  return ''
}

const hasArabic = (s) => /[\u0600-\u06FF]/.test(String(s || ''))

async function googleTranslateLine(text) {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!key || !text) return null
  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, target: 'ar', source: 'en', format: 'text' })
    })
    if (!r.ok) return null
    const data = await r.json()
    const out = data?.data?.translations?.[0]?.translatedText
    return out ? String(out).trim() : null
  } catch {
    return null
  }
}

async function libreTranslateLine(text) {
  if (!text) return null
  const base = (process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com').replace(/\/$/, '')
  const apiKey = process.env.LIBRETRANSLATE_API_KEY || ''
  try {
    const r = await fetch(`${base}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'en',
        target: 'ar',
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

async function persistCache(cacheKey, valueAr, source) {
  if (!cacheKey || !valueAr) return
  try {
    await translationCacheModel.findOneAndUpdate(
      { key: cacheKey },
      { $set: { valueAr, source } },
      { upsert: true, new: true }
    )
  } catch (e) {
    console.warn('translationCache upsert failed', e.message)
  }
}

/**
 * Resolve a single display string to Arabic (or return original if already Arabic / failed).
 */
export async function translatePlaceOrClinicName(original) {
  const raw = String(original || '').trim()
  if (!raw) return ''
  if (hasArabic(raw)) return raw

  const fromStatic = staticLookup(raw)
  if (fromStatic) return fromStatic

  const cacheKey = normLookupKey(raw) || raw.toLowerCase()
  try {
    const hit = await translationCacheModel.findOne({ key: cacheKey }).lean()
    if (hit?.valueAr) return hit.valueAr
  } catch {
    /* ignore */
  }

  let translated = await googleTranslateLine(raw)
  let source = 'google'
  if (!translated) {
    translated = await libreTranslateLine(raw)
    source = 'libre'
  }

  if (!translated || translated === raw) {
    return raw
  }

  await persistCache(cacheKey, translated, source)
  return translated
}

/**
 * @param {string[]} originals trimmed unique strings
 * @returns {Promise<Record<string, string>>} map original input -> Arabic (or same if skipped)
 */
export async function resolvePlaceTranslationsBatch(originals = []) {
  const out = {}
  const unique = [...new Set(originals.map((s) => String(s || '').trim()).filter(Boolean))]
  const concurrency = 4
  for (let i = 0; i < unique.length; i += concurrency) {
    const chunk = unique.slice(i, i + concurrency)
    await Promise.all(
      chunk.map(async (orig) => {
        const ar = await translatePlaceOrClinicName(orig)
        out[orig] = ar
        const nk = normLookupKey(orig)
        if (nk) out[nk] = ar
      })
    )
  }
  return out
}
