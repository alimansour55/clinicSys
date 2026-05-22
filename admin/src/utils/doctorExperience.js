export const parseExperienceYears = (value) => {
  if (value === null || value === undefined || value === '') return null
  const s = String(value).trim()
  const m = s.match(/^(\d{1,3})\b/) || s.match(/(\d{1,3})\s*(?:years?|yrs?)/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return n
}

export const formatExperienceEn = (value) => {
  const n = parseExperienceYears(value)
  if (n === null) return ''
  return `${n} ${n === 1 ? 'year' : 'years'} of experience`
}
