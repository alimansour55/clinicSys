export const EGYPT_DIAL_CODE = '+20'

export const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '')

export const parseEgyptLocalDigits = (value) => {
  let d = digitsOnly(value)
  if (d.startsWith('20')) d = d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)
  return d.slice(0, 10)
}

export const isValidEgyptPhone = (value) => /^01[0125]\d{8}$/.test(normalizeEgyptPhone(value) || '')

export const normalizeEgyptPhone = (value) => {
  if (value == null || value === '') return null

  let d = digitsOnly(value)
  if (!d) return null

  if (d.startsWith('20')) d = d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)

  if (/^1[0125]\d{8}$/.test(d)) return `0${d}`
  if (/^01[0125]\d{8}$/.test(d)) return d

  return null
}

export const toEgyptLocalDigits = (storedPhone) => {
  const normalized = normalizeEgyptPhone(storedPhone)
  if (!normalized) return parseEgyptLocalDigits(storedPhone)
  return normalized.startsWith('0') ? normalized.slice(1) : normalized
}
