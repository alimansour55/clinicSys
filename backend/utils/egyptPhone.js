/** Egyptian mobile: +20 then 10 digits (1[0125] + 8 digits); stored as 01XXXXXXXXX. */

const EGYPT_MOBILE_LOCAL = /^1[0125]\d{8}$/
const EGYPT_MOBILE_STORED = /^01[0125]\d{8}$/

export const EGYPT_DIAL_CODE = '+20'

export const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '')

/** Strip to up to 10 local digits (no leading 0) for input display. */
export const parseEgyptLocalDigits = (value) => {
  let d = digitsOnly(value)
  if (d.startsWith('20')) d = d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)
  return d.slice(0, 10)
}

export const isValidEgyptPhone = (value) => EGYPT_MOBILE_STORED.test(normalizeEgyptPhone(value) || '')

/** Returns 11-digit domestic form (01xxxxxxxxx) or null if invalid. */
export const normalizeEgyptPhone = (value) => {
  if (value == null || value === '') return null

  let d = digitsOnly(value)
  if (!d) return null

  if (d.startsWith('20')) d = d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)

  if (EGYPT_MOBILE_LOCAL.test(d)) return `0${d}`
  if (EGYPT_MOBILE_STORED.test(d)) return d

  return null
}
