/**
 * Clinic / district labels (Latin or mixed spellings) → Arabic display.
 * Static list: `src/data/placeNamesLatinToAr.js`.
 * Unknown Latin strings can be filled via `/api/user/translate-places` (Mongo cache + optional MT).
 */
import { PLACE_NAMES_LATIN_TO_AR } from '../data/placeNamesLatinToAr.js'

const PLACE_TO_AR = { ...PLACE_NAMES_LATIN_TO_AR }

export const norm = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ')

const latinKeyFromRaw = (raw) => norm(raw).replace(/[^a-z0-9 ]/g, '')

/** True if this segment is already covered by the static map (no remote translate needed). */
export const isKnownLatinPlace = (raw) => {
  const s = String(raw || '').trim()
  if (!s || /[\u0600-\u06FF]/.test(s)) return true
  const latinKey = latinKeyFromRaw(s)
  if (!latinKey) return true
  if (PLACE_TO_AR[latinKey]) return true
  const compact = latinKey.replace(/\s+/g, '')
  const underscored = latinKey.replace(/\s+/g, '_')
  if (PLACE_TO_AR[compact]) return true
  if (PLACE_TO_AR[underscored]) return true
  return false
}

/**
 * Unique doctor location + clinic name strings that are Latin and not in the static dictionary.
 */
export const collectDoctorPlaceStringsNeedingTranslate = (doctors = []) => {
  const set = new Set()
  for (const d of doctors) {
    for (const loc of d.locations || []) {
      const s = String(loc || '').trim()
      if (s && !isKnownLatinPlace(s)) set.add(s)
    }
    for (const c of d.clinics || []) {
      const name = typeof c === 'object' && c !== null ? (c.name || '') : String(c || '')
      const s = String(name || '').trim()
      if (s && !isKnownLatinPlace(s)) set.add(s)
    }
  }
  return [...set]
}

/** Clinic directory names (e.g. homepage speciality strip) not tied to a single doctor. */
export const collectClinicNamesNeedingTranslate = (clinics = []) => {
  const set = new Set()
  for (const c of clinics) {
    const name = typeof c === 'object' && c !== null ? (c.name || '') : String(c || '')
    const s = String(name || '').trim()
    if (s && !isKnownLatinPlace(s)) set.add(s)
  }
  return [...set]
}

export const collectPlaceStringsNeedingTranslate = (doctors = [], clinics = []) => {
  const set = new Set([...collectDoctorPlaceStringsNeedingTranslate(doctors), ...collectClinicNamesNeedingTranslate(clinics)])
  return [...set]
}

const overrideLookup = (raw, overrides) => {
  if (!overrides || typeof overrides !== 'object') return ''
  const s = String(raw || '').trim()
  if (!s) return ''
  if (overrides[s]) return overrides[s]
  const nk = latinKeyFromRaw(s)
  if (nk && overrides[nk]) return overrides[nk]
  const compact = nk.replace(/\s+/g, '')
  if (compact && overrides[compact]) return overrides[compact]
  return ''
}

export const translatePlaceSegment = (segment, language, t, overrides = {}) => {
  const raw = String(segment || '').trim()
  if (!raw) return raw
  if (language !== 'ar') {
    const tr = t(raw)
    return tr !== raw ? tr : raw
  }
  if (/[\u0600-\u06FF]/.test(raw)) return raw
  const latinKey = latinKeyFromRaw(raw)
  if (PLACE_TO_AR[latinKey]) return PLACE_TO_AR[latinKey]
  const compact = latinKey.replace(/\s+/g, '')
  const underscored = latinKey.replace(/\s+/g, '_')
  if (PLACE_TO_AR[compact]) return PLACE_TO_AR[compact]
  if (PLACE_TO_AR[underscored]) return PLACE_TO_AR[underscored]
  const auto = overrideLookup(raw, overrides)
  if (auto) return auto
  const tr = t(raw)
  return tr !== raw ? tr : raw
}

/** Comma-separated locations / clinic names for doctor cards. */
export const formatLocationLine = (joined, language, t, overrides = {}) => {
  if (!joined || typeof joined !== 'string') return ''
  const sep = language === 'ar' ? '، ' : ', '
  const parts = joined.split(/\s*[,،;]\s*|\s*·\s*|\s*\|\s*/)
  return parts
    .map((s) => translatePlaceSegment(s, language, t, overrides))
    .filter(Boolean)
    .join(sep)
}
