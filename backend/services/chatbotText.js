/**
 * Text helpers shared by the assistant's safety, specialty and scheduling rules.
 * Everything matches on normalized text, so spelling variants of Arabic letters,
 * diacritics, stretched letters and Eastern digits all compare equal.
 */

const ARABIC_SCRIPT = /[؀-ۿ]/
const DIACRITICS = /[ً-ٰٟـ]/g
const CLITIC_PREFIX = '(?:و|ف|ب|ل|ك|ال|بال|وال|فال|كال|لل|وب|ول|وبال)?'
const WORD_SUFFIX = '(?:ي|يا|ك|كي|ه|ها|نا|هم|كم|ا|ات|ين|ون|تي|تك|ته|تها)?'

export const toWesternDigits = (value = '') =>
  String(value)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))

export const normalizeText = (value = '') =>
  toWesternDigits(String(value).normalize('NFKC'))
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[’`]/g, "'")
    .replace(/([ء-ي])\1{2,}/g, '$1')
    .replace(/[^\p{L}\p{N}\s':/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const termCache = new Map()

/** Word-bounded matcher. A trailing `*` keeps any ending, for stems like `dermat*`. */
const termRegex = (term) => {
  const cached = termCache.get(term)
  if (cached) return cached

  const stem = term.endsWith('*')
  const body = normalizeText(stem ? term.slice(0, -1) : term)
  const pattern = escapeRegex(body).replace(/ /g, '\\s+')
  const regex = ARABIC_SCRIPT.test(body)
    ? new RegExp(`(?:^|\\s)${CLITIC_PREFIX}${pattern}${stem ? '\\S*' : WORD_SUFFIX}(?=\\s|$)`)
    : new RegExp(`(?:^|[^a-z0-9])${pattern}${stem ? '[a-z0-9]*' : '(?:s|es)?'}(?=[^a-z0-9]|$)`)

  termCache.set(term, regex)
  return regex
}

/** `normalized` must already have been through normalizeText. */
export const hasTerm = (normalized, term) => termRegex(term).test(normalized)

export const hasAnyTerm = (normalized, terms = []) => terms.some((term) => hasTerm(normalized, term))

export const countTerms = (normalized, terms = []) =>
  terms.reduce((total, term) => total + (hasTerm(normalized, term) ? 1 : 0), 0)

/** True when a word from each list sits within `gap` words, in either order. */
export const hasTermsNear = (normalized, firstTerms, secondTerms, gap = 4) => {
  const words = normalized.split(' ')
  const indexes = (terms) =>
    words.flatMap((word, index) => (terms.some((term) => hasTerm(word, term)) ? [index] : []))
  const first = indexes(firstTerms)
  if (!first.length) return false
  const second = indexes(secondTerms)
  return first.some((a) => second.some((b) => Math.abs(a - b) <= gap))
}

export const containsArabicScript = (text = '') => ARABIC_SCRIPT.test(String(text))

const FRANCO_WORD = /(?:^|[^a-z0-9])(?:[a-z]+[235678][a-z0-9]*|[235678][a-z]{2,})(?=[^a-z0-9]|$)/
const NOT_FRANCO = /(?:^|\s)\d+(?:st|nd|rd|th|am|pm|mg|ml|kg|cm)(?=\s|$)/g
const FRANCO_VOCABULARY = [
  'ana', 'ayez', 'ayza', 'awez', 'awza', 'mesh', 'msh', 'bokra', 'bukra', 'enaharda', 'naharda', 'elnaharda',
  'andy', 'andi', 'ebny', 'ebni', 'benty', 'binti', 'batny', 'batni', 'dersy', 'dersi', 'sedry', 'sedri',
  'tamam', 'aywa', 'eh', 'ezay', 'keda', 'dah', 'di', 'doctora', 'dakhtor', 'tany', 'tani', 'bard'
]

/** Arabic typed in Latin letters, which Egyptians use widely ("3andy so5onia"). */
export const looksLikeFrancoArabic = (text = '') => {
  const normalized = normalizeText(text)
  if (!normalized || containsArabicScript(normalized)) return false
  if (FRANCO_WORD.test(normalized.replace(NOT_FRANCO, ' '))) return true
  return FRANCO_VOCABULARY.filter((word) => hasTerm(normalized, word)).length >= 2
}

/**
 * The language to answer in. What the person just wrote wins over the site setting,
 * unless it has no real words to judge by, like "ok" or "5".
 */
export const resolveReplyLanguage = (text = '', preferred = '') => {
  const site = preferred === 'ar' || preferred === 'en' ? preferred : ''
  if (containsArabicScript(text) || looksLikeFrancoArabic(text)) return 'ar'
  const latinWords = normalizeText(text).match(/[a-z]{2,}/g) || []
  if (latinWords.length >= 2) return 'en'
  return site || (latinWords.length ? 'en' : 'ar')
}
