/** Eastern Arabic (Hindi) numerals — used when UI language is Arabic. */
const INDIC = '٠١٢٣٤٥٦٧٨٩'

const ARABIC_INDIC_ZERO = 0x0660
const EXT_ARABIC_INDIC_ZERO = 0x06f0

/**
 * Replace Eastern Arabic (U+0660–U+0669) and Persian (U+06F0–U+06F9) digits with ASCII 0–9.
 * Leaves Latin digits unchanged.
 */
export function toWesternAsciiDigits(input) {
  if (input === null || input === undefined) return ''
  return String(input)
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - EXT_ARABIC_INDIC_ZERO))
}

/** Replace ASCII digits 0–9 with Arabic-Indic numerals (٠–٩). */
export function toArabicIndicDigits(input) {
  if (input === null || input === undefined) return ''
  return String(input).replace(/[0-9]/g, (c) => INDIC[c.charCodeAt(0) - 48])
}

/** Arabic UI: turn `15%` / `١٥%` / `5٪` into `%15` / `%١٥` (ASCII `%` before the number). */
function moveTrailingPercentBeforeNumberForArabic(s) {
  return String(s).replace(/([\d\u0660-\u0669]+)\s*(?:%|\u066a)/g, '%$1')
}

/**
 * Format digits for the active UI language: English → Western (0–9), Arabic → Eastern (٠–٩).
 * Normalizes mixed/locale output so switching language never leaves the wrong numeral set.
 * In Arabic, also moves a trailing percent sign to the left of the number (…١٥% → …%١٥).
 */
export function localizeWesternDigits(input, language) {
  const normalized = toWesternAsciiDigits(input === null || input === undefined ? '' : String(input))
  if (language !== 'ar') return normalized
  const indic = toArabicIndicDigits(normalized)
  return moveTrailingPercentBeforeNumberForArabic(indic)
}

/** Arabic UI: `%` before the number (e.g. `%٨٥`). English: after (`85%`). */
export function formatPercentDisplay(value, language) {
  const n = Math.round(Number(value) || 0)
  const num = localizeWesternDigits(String(n), language)
  if (language === 'ar') return `%${num}`
  return `${num}%`
}
