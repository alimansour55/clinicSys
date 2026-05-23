import { isDoctorBookableForPatients, isDoctorComingSoon } from './doctorBooking'
import { displayPersonName } from './personNameArabic'

const DOCTOR_PREFIX_RE = /^(?:dr\.?|doctor|دكتور|دكتورة|طبيب|طبيبة)\s+/i
const HAS_ARABIC = /[\u0600-\u06FF]/

export const parseDoctorNameQuery = (message) => {
  let q = String(message || '')
    .trim()
    .replace(DOCTOR_PREFIX_RE, '')
    .trim()
  if (HAS_ARABIC.test(q)) {
    return q.replace(/\s+/g, ' ').trim()
  }
  q = q.toLowerCase().replace(/\s+/g, ' ')
  if (q.length < 2) return ''
  return q
}

export const isExplicitDoctorRequest = (message) =>
  DOCTOR_PREFIX_RE.test(String(message || '').trim())

const normalizeName = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')

const scoreDoctorNameMatch = (doctor, query) => {
  const name = normalizeName(doctor?.name)
  if (!name || !query) return 0

  const scoreAgainst = (candidate) => {
    const c = String(candidate || '').trim()
    if (!c) return 0
    const lower = HAS_ARABIC.test(query) ? c : c.toLowerCase()
    const q = HAS_ARABIC.test(query) ? query : query.toLowerCase()
    if (lower === q) return 100
    if (lower.startsWith(q) || q.startsWith(lower)) return 85
    if (lower.includes(q) || q.includes(lower)) return 70
    const tokens = q.split(' ').filter((t) => t.length >= 2)
    if (tokens.length && tokens.every((t) => lower.includes(t))) return 60
    const first = tokens[0]
    if (first && first.length >= 2 && lower.split(' ').some((part) => part.startsWith(first))) return 55
    return 0
  }

  const latinScore = scoreAgainst(name)
  const arabicScore = scoreAgainst(displayPersonName(doctor.name, 'ar'))
  return Math.max(latinScore, arabicScore)
}

export const findDoctorsByNameQuery = (doctors, message) => {
  const query = parseDoctorNameQuery(message)
  if (!query) return []

  const bookable = (doctors || []).filter(
    (d) => isDoctorBookableForPatients(d) && !isDoctorComingSoon(d)
  )

  return bookable
    .map((doctor) => ({ doctor, score: scoreDoctorNameMatch(doctor, query) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.doctor)
}

export const shouldUseDoctorNameSearch = (message, matches) => {
  if (!matches?.length) return false
  if (isExplicitDoctorRequest(message)) return true
  if (matches.length === 1) {
    const query = parseDoctorNameQuery(message)
    return scoreDoctorNameMatch(matches[0], query) >= 55
  }
  return false
}
