/**
 * Personal names are transliterated, never translated by meaning. Works offline, so a name
 * can always be saved in both languages. Admins can correct the result in the form.
 */
import { COMMON_NAMES, FULL_NAME_AR, displayPersonName } from './personNameArabic.js'

const hasArabic = (s) => /[؀-ۿ]/.test(String(s || ''))

const ARABIC_LETTERS = {
  ا: 'a', أ: 'a', إ: 'e', آ: 'a', ء: '', ئ: 'e', ؤ: 'o',
  ب: 'b', ت: 't', ث: 'th', ج: 'g', ح: 'h', خ: 'kh', د: 'd', ذ: 'z', ر: 'r', ز: 'z',
  س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't', ظ: 'z', ع: 'a', غ: 'gh', ف: 'f', ق: 'k',
  ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', ة: 'a', و: 'o', ي: 'y', ى: 'a'
}

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/* Earlier dictionary spellings win, and those are the common ones (Ahmed before Ahmad) */
const firstSpellingByArabic = (dictionary) => {
  const reverse = {}
  for (const [latin, arabic] of Object.entries(dictionary)) {
    if (!reverse[arabic]) reverse[arabic] = latin
  }
  return reverse
}

const ARABIC_TO_LATIN = firstSpellingByArabic(COMMON_NAMES)
const ARABIC_FULL_TO_LATIN = firstSpellingByArabic(FULL_NAME_AR)

const arabicTokenToLatin = (token) => {
  const known = ARABIC_TO_LATIN[token]
  if (known) return capitalize(known)
  if (token.startsWith('عبدال') && token.length > 5) {
    return `Abdel${arabicTokenToLatin(token.slice(5)).toLowerCase()}`
  }
  if (token.startsWith('ال') && token.length > 3) {
    return `El-${arabicTokenToLatin(token.slice(2))}`
  }
  const latin = [...token]
    .map((ch, i) => (ch === 'ي' && i > 0 ? 'i' : ch in ARABIC_LETTERS ? ARABIC_LETTERS[ch] : ch))
    .join('')
  return capitalize(latin)
}

const TITLES = [
  [/^(dr\.?|doctor)\s+/i, 'د. '],
  [/^(prof\.?|professor)\s+/i, 'أ.د. ']
]
const ARABIC_TITLES = [
  [/^(أ\.د\.?|الأستاذ الدكتور)\s*/, 'Prof. '],
  [/^(د\.|دكتور|الدكتور|دكتورة|الدكتورة)\s*/, 'Dr. ']
]

const splitTitle = (name, titles) => {
  for (const [pattern, output] of titles) {
    if (pattern.test(name)) return [output, name.replace(pattern, '')]
  }
  return ['', name]
}

export const transliterateName = (name, targetLang) => {
  const raw = String(name || '').trim().replace(/\s+/g, ' ')
  if (!raw) return ''
  if (targetLang === 'ar') {
    if (hasArabic(raw)) return raw
    const [title, rest] = splitTitle(raw, TITLES)
    return `${title}${displayPersonName(rest, 'ar')}`
  }
  if (!hasArabic(raw)) return raw
  const [title, rest] = splitTitle(raw, ARABIC_TITLES)
  const full = ARABIC_FULL_TO_LATIN[rest]
  if (full) return `${title}${full.split(' ').map(capitalize).join(' ')}`
  return `${title}${rest.split(' ').map((token) => token.split('-').map(arabicTokenToLatin).join('-')).join(' ')}`
}
