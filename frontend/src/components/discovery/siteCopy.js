/*
 * Home page text comes from admin site settings. Some stored defaults make claims the
 * data does not support ("100+ Trusted Doctors", "extensive list"). Those exact defaults
 * are treated as "not set", so honest wording shows instead. Text an admin typed is kept,
 * unless it claims more doctors than the site lists.
 */

const LEGACY_DEFAULTS = new Set(
  [
    'Book Appointment With Trusted Doctors',
    'Simply browse through our extensive list of trusted doctors, schedule your appointment hassle-free.',
    'Book Appointment\nWith 100+ Trusted Doctors',
    'Book Appointment With 100+ Trusted Doctors',
    'With 100+ Trusted Doctors',
    "Simplifying healthcare access through smart appointment management. Book your doctor, anytime, anywhere with Clinivo's intelligent scheduling system. No more long waits or booking hassles - just efficient, reliable, and patient-focused healthcare at your convenience.",
    'Simplifying healthcare access through smart appointment management. Book your doctor, anytime, anywhere with our intelligent scheduling system. No more long waits or booking hassles — just efficient, reliable, and patient-focused healthcare at your convenience.',
  ].map((text) => text.replace(/\s+/g, ' ').trim().toLowerCase()),
)

export const LEGACY_BRAND_COLOR = '#169b8a'

const isLegacy = (text) => LEGACY_DEFAULTS.has(String(text || '').replace(/\s+/g, ' ').trim().toLowerCase())

/** "100+ doctors" style claims larger than the real number of doctors. */
export const overclaimsDoctors = (text, doctorCount) => {
  const match = String(text || '').match(/(\d[\d,]*)\s*\+?\s*(?:trusted\s+|expert\s+|verified\s+)?(?:doctors?|physicians?|specialists?|أطباء|طبيب)/i)
  return Boolean(match && Number(match[1].replace(/,/g, '')) > doctorCount)
}

/** Admin text if it is real and honest, otherwise null so the caller uses its own default. */
export const siteText = (value, doctorCount = Infinity) => {
  const text = String(value || '').trim()
  if (!text || isLegacy(text) || overclaimsDoctors(text, doctorCount)) return null
  return text
}

/** A custom colour an admin chose, ignoring the old default that fails contrast with white text. */
export const customColor = (value) => {
  const color = String(value || '').trim().toLowerCase()
  return color && color !== LEGACY_BRAND_COLOR && /^#[0-9a-f]{6}$/.test(color) ? color : null
}

/** Whether white text is readable (WCAG AA, 4.5:1) on a hex background. */
export const whiteTextReadable = (hex) => {
  const channel = (i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
  return 1.05 / (luminance + 0.05) >= 4.5
}
