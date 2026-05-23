import {
  getStaticDoctorAboutAr,
  isKnownDoctorAboutEn,
} from '../data/doctorAboutEnToAr.js'

const hasArabic = (s) => /[\u0600-\u06FF]/.test(String(s || ''))
const hasLatinLetters = (s) => /[A-Za-z]/.test(String(s || ''))

/**
 * Doctor `about` strings that should be machine-translated for the current UI language.
 */
export const collectDoctorAboutTextsNeedingTranslate = (doctors = [], targetLang) => {
  const set = new Set()
  for (const d of doctors) {
    const about = String(d?.about || '').trim()
    if (!about) continue
    if (targetLang === 'ar' && hasLatinLetters(about) && !isKnownDoctorAboutEn(about)) set.add(about)
    if (targetLang === 'en' && hasArabic(about)) set.add(about)
  }
  return [...set]
}

/**
 * @param {string} raw doctor-written about (any language)
 * @param {'en'|'ar'} language UI language
 * @param {Record<string, string>} overrides map original → translated from `/api/user/translate-texts`
 */
export const getTranslatedDoctorAbout = (raw, language, overrides = {}) => {
  const s = String(raw || '').trim()
  if (!s) return ''

  if (language === 'ar') {
    const staticAr = getStaticDoctorAboutAr(s)
    if (staticAr) return staticAr
    if (overrides[s]) return overrides[s]
    if (hasLatinLetters(s)) return overrides[s] || s
    return s
  }

  if (language === 'en') {
    if (overrides[s]) return overrides[s]
    if (hasArabic(s)) return overrides[s] || s
    return s
  }

  return s
}
