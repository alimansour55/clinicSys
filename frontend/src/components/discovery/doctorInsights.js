/*
 * Everything the discovery pages know about a doctor, computed once from the public
 * doctor list: real openings per visit type, fee, places, rating and a search index.
 * No number shown to patients comes from anywhere else.
 */
import { buildDoctorSlots } from '../../utils/schedule'
import { isDoctorBookableForPatients, isDoctorComingSoon } from '../../utils/doctorBooking'
import { doctorOffersHomeVisit } from '../../utils/homeVisitAreas'
import { resolveVisitFeeAmount } from '../../utils/visitFees'
import { fixedDiscountAmount, percentageDiscountAmount } from '../../utils/promo'
import { extractMainPlaceFromLocation, placeFilterKey } from '../../utils/placeTranslations'
import { doctorBelongsToClinicSection } from '../../utils/doctorClinicPlaces'
import { normalizeSearchText } from './searchText'
import { recordSearchTexts } from '../../utils/bilingualContent'

export const VISIT_MODES = ['clinic', 'voice', 'tele', 'home']

export const APPOINTMENT_TYPE_FOR_MODE = {
  clinic: 'Clinic',
  voice: 'Voice Call',
  tele: 'Video Call',
  home: 'Home Visit',
}

/** How far ahead openings are looked up. Two weeks keeps the home page fast. */
export const LOOKAHEAD_DAYS = 14

export const doctorPlaces = (doctor) =>
  (Array.isArray(doctor?.locations) ? doctor.locations : [])
    .map((raw) => String(raw || '').trim())
    .filter(Boolean)
    .map((raw) => {
      const main = extractMainPlaceFromLocation(raw) || raw
      return { raw, main, key: placeFilterKey(main) }
    })

export const supportsMode = (doctor, mode) => {
  // A doctor switched to unavailable takes no bookings of any kind
  if (!doctor || doctor.available === false) return false
  if (mode === 'home') return doctorOffersHomeVisit(doctor)
  if (!isDoctorBookableForPatients(doctor)) return false
  if (mode === 'voice') return doctor.acceptsVoiceCall !== false
  if (mode === 'tele') return doctor.acceptsVideoCall !== false
  return true
}

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/** Real open slots for one visit type, across every branch the doctor works at. */
export const computeOpenings = (doctor, mode, days = LOOKAHEAD_DAYS, now = new Date()) => {
  if (!supportsMode(doctor, mode)) return null
  const type = APPOINTMENT_TYPE_FOR_MODE[mode]
  const branches = mode === 'home' ? [''] : doctorPlaces(doctor).map((place) => place.raw)
  const today = startOfDay(now).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  const seen = new Set()
  let next = null
  let nextPlace = ''
  let today0 = 0
  let tomorrow = 0
  let week = 0

  for (const branch of branches.length ? branches : ['']) {
    for (const day of buildDoctorSlots(doctor, days, type, branch)) {
      for (const slot of day.slots) {
        if (!slot.available) continue
        const at = slot.dateTime.getTime()
        if (!next || at < next.getTime()) {
          next = slot.dateTime
          nextPlace = branch
        }
        if (seen.has(at)) continue
        seen.add(at)
        const offset = Math.floor((startOfDay(slot.dateTime).getTime() - today) / dayMs)
        if (offset === 0) today0 += 1
        if (offset === 1) tomorrow += 1
        if (offset < 7) week += 1
      }
    }
  }

  return { next, nextPlace, today: today0, tomorrow, week }
}

export const doctorFee = (doctor, globalVisitFees) => {
  const fee = Number(resolveVisitFeeAmount(doctor, 'examination', globalVisitFees)) || 0
  const promo = doctor?.promoCode || {}
  const value = Math.max(0, Number(promo.discountValue || 0))
  const discount = promo.active && value > 0
    ? promo.discountType === 'fixed'
      ? fixedDiscountAmount(fee, value)
      : percentageDiscountAmount(fee, Math.min(100, value))
    : 0
  return { fee, offerFee: discount > 0 ? fee - discount : null, hasOffer: Boolean(promo.active && value > 0) }
}

/**
 * One row per doctor. `labels` supplies display text in both languages, so a patient can
 * search in Arabic while the data is stored in English, and the other way round.
 */
export const buildDoctorRow = (doctor, { globalVisitFees, labels = () => [], now = new Date() } = {}) => {
  const places = doctorPlaces(doctor)
  const modes = {}
  for (const mode of VISIT_MODES) modes[mode] = computeOpenings(doctor, mode, LOOKAHEAD_DAYS, now)
  const nextAny = VISIT_MODES.map((mode) => modes[mode]?.next).filter(Boolean).sort((a, b) => a - b)[0] || null
  const { fee, offerFee, hasOffer } = doctorFee(doctor, globalVisitFees)
  const languages = Array.isArray(doctor.languages) ? doctor.languages.filter(Boolean) : []

  const searchParts = [
    doctor.name,
    doctor.speciality,
    doctor.title,
    doctor.degree,
    ...places.map((place) => place.raw),
    ...languages,
    ...labels(doctor),
    /* Stored English and Arabic, so a search in either language matches. */
    ...recordSearchTexts(doctor, ['name', 'speciality', 'degree', 'address']),
  ]

  return {
    id: String(doctor._id),
    doctor,
    speciality: doctor.speciality || '',
    places,
    modes,
    nextAny,
    fee,
    offerFee,
    hasOffer,
    rating: Number(doctor.ratingSummary?.averageRating || 0),
    ratingCount: Number(doctor.ratingSummary?.ratingCount || 0),
    completed: Number(doctor.completedBookingsCount || 0),
    comingSoon: isDoctorComingSoon(doctor),
    bookable: doctor.available !== false && isDoctorBookableForPatients(doctor),
    gender: doctor.gender || '',
    title: doctor.title || '',
    acceptsCash: doctor.acceptsCash !== false,
    acceptsOnline: doctor.acceptsOnlinePayment !== false,
    languages,
    search: normalizeSearchText(searchParts.filter(Boolean).join(' ')),
  }
}

/** The availability a row has for the chosen visit type, or the soonest across all of them. */
export const openingsFor = (row, mode) => {
  if (mode) return row.modes[mode]
  const all = VISIT_MODES.map((m) => row.modes[m]).filter(Boolean)
  if (!all.length) return null
  return all.reduce((best, current) => {
    const better = current.next && (!best.next || current.next < best.next) ? current : best
    return {
      ...better,
      today: Math.max(best.today, current.today),
      tomorrow: Math.max(best.tomorrow, current.tomorrow),
      week: Math.max(best.week, current.week),
    }
  })
}

/* ---------- Filtering ---------- */

export const EMPTY_FILTERS = {
  speciality: '',
  area: '',
  mode: '',
  when: '',
  maxPrice: null,
  minRating: 0,
  gender: '',
  title: '',
  pay: '',
  offer: false,
  language: '',
  terms: [],
}

/** Each dimension is a separate test, so facet counts can leave one out at a time. */
export const FILTER_TESTS = {
  speciality: (row, value) => doctorBelongsToClinicSection(row.doctor, value),
  area: (row, value) => row.places.some((place) => place.key === value),
  mode: (row, value) => Boolean(row.modes[value]),
  when: (row, value, filters) => {
    const openings = openingsFor(row, filters.mode)
    if (!openings) return false
    if (value === 'today') return openings.today > 0
    if (value === 'tomorrow') return openings.tomorrow > 0
    return openings.week > 0
  },
  maxPrice: (row, value) => row.fee > 0 && (row.offerFee ?? row.fee) <= value,
  minRating: (row, value) => row.ratingCount > 0 && row.rating >= value,
  gender: (row, value) => row.gender === value,
  title: (row, value) => row.title === value,
  pay: (row, value) => (value === 'cash' ? row.acceptsCash : row.acceptsOnline),
  offer: (row) => row.hasOffer,
  language: (row, value) => row.languages.some((lang) => normalizeSearchText(lang) === normalizeSearchText(value)),
  terms: (row, value) => value.every((term) => row.search.includes(term)),
}

const isActive = (key, value) => {
  if (key === 'terms') return Array.isArray(value) && value.length > 0
  if (key === 'maxPrice') return value != null && value > 0
  return Boolean(value)
}

export const activeFilterKeys = (filters) =>
  Object.keys(FILTER_TESTS).filter((key) => isActive(key, filters[key]))

export const matchesFilters = (row, filters, skip = null) =>
  activeFilterKeys(filters).every((key) => key === skip || FILTER_TESTS[key](row, filters[key], filters))

export const filterRows = (rows, filters) => rows.filter((row) => matchesFilters(row, filters))

/** How many doctors each option of one dimension would give, with every other filter kept. */
export const facetCounts = (rows, filters, key, options) => {
  const base = rows.filter((row) => matchesFilters(row, filters, key))
  const counts = {}
  for (const option of options) {
    counts[option] = base.filter((row) => FILTER_TESTS[key](row, option, { ...filters, [key]: option })).length
  }
  return { total: base.length, counts }
}

/** When nothing matches, which single filter to drop and how many doctors that would bring back. */
export const suggestRelaxations = (rows, filters) =>
  activeFilterKeys(filters)
    .map((key) => ({ key, count: rows.filter((row) => matchesFilters(row, filters, key)).length }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)

/* ---------- Sorting ---------- */

const time = (date) => (date ? date.getTime() : Number.POSITIVE_INFINITY)

export const SORTS = ['recommended', 'soonest', 'price-asc', 'price-desc', 'rating']

export const sortRows = (rows, sort, mode = '') => {
  const list = [...rows]
  const price = (row) => (row.fee > 0 ? row.offerFee ?? row.fee : Number.POSITIVE_INFINITY)
  const ratingScore = (row) => (row.ratingCount ? row.rating * Math.min(1, row.ratingCount / 3) : 0)
  const next = (row) => time(openingsFor(row, mode)?.next)
  const byName = (a, b) => String(a.doctor.name).localeCompare(String(b.doctor.name))

  const compare = {
    soonest: (a, b) => next(a) - next(b) || byName(a, b),
    'price-asc': (a, b) => price(a) - price(b) || next(a) - next(b),
    'price-desc': (a, b) => (price(b) === Infinity ? -1 : price(a) === Infinity ? 1 : price(b) - price(a)) || next(a) - next(b),
    rating: (a, b) => ratingScore(b) - ratingScore(a) || b.ratingCount - a.ratingCount || next(a) - next(b),
    recommended: (a, b) =>
      Number(b.bookable) - Number(a.bookable) ||
      Number(Boolean(openingsFor(b, mode)?.next)) - Number(Boolean(openingsFor(a, mode)?.next)) ||
      ratingScore(b) - ratingScore(a) ||
      b.completed - a.completed ||
      next(a) - next(b) ||
      byName(a, b),
  }[sort] || null

  return compare ? list.sort(compare) : list
}

/** Rows with a real opening, soonest first, one per doctor. Used by the home page board. */
export const upcomingOpenings = (rows, mode = '', limit = 5) =>
  rows
    .map((row) => ({ row, openings: openingsFor(row, mode) }))
    .filter((item) => item.openings?.next && !item.row.comingSoon)
    .sort((a, b) => a.openings.next - b.openings.next)
    .slice(0, limit)

/** Real catalogue numbers for headlines. Nothing here is estimated. */
export const catalogueStats = (rows) => {
  const specialities = new Set(rows.map((row) => row.speciality).filter(Boolean))
  const areas = new Set(rows.flatMap((row) => row.places.map((place) => place.key)).filter(Boolean))
  const openThisWeek = rows.reduce((sum, row) => sum + (openingsFor(row, '')?.week || 0), 0)
  const modes = Object.fromEntries(VISIT_MODES.map((mode) => [mode, rows.filter((row) => row.modes[mode]).length]))
  return {
    doctors: rows.length,
    bookable: rows.filter((row) => row.bookable).length,
    specialities: specialities.size,
    areas: areas.size,
    openThisWeek,
    modes,
  }
}
