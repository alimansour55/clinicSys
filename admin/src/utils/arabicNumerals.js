/** Eastern Arabic (Hindi) numerals — used when UI language is Arabic. */
const INDIC = '٠١٢٣٤٥٦٧٨٩'

const ARABIC_INDIC_ZERO = 0x0660
const EXT_ARABIC_INDIC_ZERO = 0x06f0

export function toWesternAsciiDigits(input) {
  if (input === null || input === undefined) return ''
  return String(input)
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - EXT_ARABIC_INDIC_ZERO))
}

export function toArabicIndicDigits(input) {
  if (input === null || input === undefined) return ''
  return String(input).replace(/[0-9]/g, (c) => INDIC[c.charCodeAt(0) - 48])
}

function moveTrailingPercentBeforeNumberForArabic(s) {
  return String(s).replace(/([\d\u0660-\u0669]+)\s*(?:%|\u066a)/g, '%$1')
}

export function localizeWesternDigits(input, language) {
  const normalized = toWesternAsciiDigits(input === null || input === undefined ? '' : String(input))
  if (language !== 'ar') return normalized
  const indic = toArabicIndicDigits(normalized)
  return moveTrailingPercentBeforeNumberForArabic(indic)
}

export function formatPercentDisplay(value, language) {
  const n = Math.round(Number(value) || 0)
  const num = localizeWesternDigits(String(n), language)
  if (language === 'ar') return `%${num}`
  return `${num}%`
}
