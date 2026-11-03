/* Text normalisation shared by doctor search, so English and Arabic queries match the same way. */

const ARABIC_DIACRITICS = /[ً-ٰٟـ]/g
const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g
export const HAS_ARABIC = /[؀-ۿ]/

/** Lowercase, unify Arabic letter variants and digits, drop diacritics and punctuation. */
export const normalizeSearchText = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .replace(ARABIC_INDIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10))
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}<>+.\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/* Arabic attaches prepositions and the article to the word ("بالفيديو", "والجلدية"). */
const ARABIC_PREFIXES = ['وبال', 'بال', 'وال', 'فال', 'كال', 'لل', 'ال', 'و', 'ب', 'ل', 'ف']

export const stripArabicPrefix = (token) => {
  if (!HAS_ARABIC.test(token)) return token
  for (const prefix of ARABIC_PREFIXES) {
    if (token.startsWith(prefix) && token.length - prefix.length >= 2) return token.slice(prefix.length)
  }
  return token
}

/** Whether a query token is the same word as a keyword token. */
export const tokenMatches = (token, keyword) => {
  if (!token || !keyword) return false
  if (token === keyword) return true
  if (!HAS_ARABIC.test(keyword)) {
    // Latin: allow a plural or possessive ending, nothing looser
    return token === `${keyword}s` || token === `${keyword}'s` || token === `${keyword}es`
  }
  const bare = stripArabicPrefix(token)
  const bareKeyword = stripArabicPrefix(keyword)
  return bare === bareKeyword || bare === keyword || token === bareKeyword
}
