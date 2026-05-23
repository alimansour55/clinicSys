import { buildDoctorSlots } from './schedule'
import {
  hasDoctorPublishedSchedule,
  isDoctorBookableForPatients,
  isTeleconsultationType,
  usesClinicWeeklySchedule
} from './doctorBooking'
import { doctorOffersHomeVisit } from './homeVisitAreas'
import {
  computeAppointmentPayableForVisit,
  normalizeGlobalVisitFees,
  normalizeVisitFeeType,
  resolveVisitFeeAmount
} from './visitFees'
import { normalizeHomeVisitPricing } from './homeVisitPricing'

export const CHATBOT_APPOINTMENT_TYPES = [
  { value: 'Clinic', labelKey: 'In clinic' },
  { value: 'Home Visit', labelKey: 'Home visit' },
  { value: 'Voice Call', labelKey: 'Voice call' },
  { value: 'Video Call', labelKey: 'Video call' }
]

export const CHATBOT_VISIT_FEE_TYPES = [
  { value: 'examination', labelKey: 'Examination (Kashf)' },
  { value: 'consultation', labelKey: 'Follow-up consultation (Istishara)' }
]

export const getDoctorAppointmentTypeOptions = (doctor) => {
  if (!doctor) return []
  const hasClinic = hasDoctorPublishedSchedule(doctor)
  const homeVisit = doctorOffersHomeVisit(doctor)
  const voice =
    isDoctorBookableForPatients(doctor) && doctor?.acceptsVoiceCall !== false && hasClinic
  const video =
    isDoctorBookableForPatients(doctor) && doctor?.acceptsVideoCall !== false && hasClinic

  return CHATBOT_APPOINTMENT_TYPES.filter((opt) => {
    if (opt.value === 'Clinic') return hasClinic
    if (opt.value === 'Home Visit') return homeVisit
    if (opt.value === 'Voice Call') return voice
    if (opt.value === 'Video Call') return video
    return false
  })
}

const toSlotDate = (date) =>
  `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`

export const buildChatbotSlotDays = (doctor, appointmentType, clinicLocation = '', days = 14) => {
  const branch = String(clinicLocation || '').trim()
  const rows = buildDoctorSlots(doctor, days, appointmentType, branch)
  return rows
    .map((row) => {
      const availableSlots = (row.slots || []).filter((s) => s.available)
      if (!availableSlots.length) return null
      return {
        slotDate: toSlotDate(row.dateTime),
        date: row.dateTime.toISOString(),
        slots: availableSlots.map((s) => ({
          time: s.time,
          ...(branch ? { branch } : {})
        }))
      }
    })
    .filter(Boolean)
}

/** Merge available slots across branches (voice/video — no location picker). */
export const mergeMultiBranchChatbotSlots = (doctor, appointmentType, locations, days = 14) => {
  const dayMap = new Map()

  for (const loc of locations) {
    const branchDays = buildChatbotSlotDays(doctor, appointmentType, loc, days)
    for (const day of branchDays) {
      if (!dayMap.has(day.slotDate)) {
        dayMap.set(day.slotDate, {
          slotDate: day.slotDate,
          date: day.date,
          slots: []
        })
      }
      const entry = dayMap.get(day.slotDate)
      for (const slot of day.slots) {
        const exists = entry.slots.some((s) => s.time === slot.time && s.branch === loc)
        if (!exists) {
          entry.slots.push({ time: slot.time, branch: loc })
        }
      }
    }
  }

  return [...dayMap.values()]
    .map((day) => ({
      ...day,
      slots: day.slots.sort((a, b) => a.time.localeCompare(b.time))
    }))
    .filter((day) => day.slots.length)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
}

export const countSlotsInDays = (days) =>
  (days || []).reduce((n, d) => n + (d.slots?.length || 0), 0)

export const probeDoctorBranchesForType = (doctor, appointmentType, days = 14) => {
  const locs = (doctor?.locations || []).map((l) => String(l || '').trim()).filter(Boolean)

  if (isTeleconsultationType(appointmentType) && locs.length > 1) {
    const slotDays = mergeMultiBranchChatbotSlots(doctor, appointmentType, locs, days)
    return {
      mode: countSlotsInDays(slotDays) ? 'ready' : 'empty',
      branch: '',
      days: slotDays,
      mergedTeleconsultation: true
    }
  }

  if (!usesClinicWeeklySchedule(appointmentType) || locs.length <= 1) {
    const branch = locs[0] || ''
    const slotDays = buildChatbotSlotDays(doctor, appointmentType, branch, days)
    return { mode: countSlotsInDays(slotDays) ? 'ready' : 'empty', branch, days: slotDays }
  }

  const results = locs.map((loc) => {
    const slotDays = buildChatbotSlotDays(doctor, appointmentType, loc, days)
    return { loc, days: slotDays, slotCount: countSlotsInDays(slotDays) }
  })

  const withSlots = results.filter((r) => r.slotCount > 0)
  if (!withSlots.length) return { mode: 'empty', branches: results }
  if (withSlots.length === 1) {
    return { mode: 'ready', branch: withSlots[0].loc, days: withSlots[0].days }
  }
  return { mode: 'pick_branch', branches: withSlots }
}

export const computeChatbotTotalPrice = ({
  doctor,
  visitFeeType,
  appointmentType,
  siteSettings
}) => {
  const globalVisitFees = normalizeGlobalVisitFees(siteSettings?.globalVisitFees)
  const homeVisitPricing = normalizeHomeVisitPricing(siteSettings?.homeVisitPricing)
  const type = normalizeVisitFeeType(visitFeeType)
  const base = resolveVisitFeeAmount(doctor, type, globalVisitFees)
  const total = computeAppointmentPayableForVisit(
    doctor,
    type,
    0,
    appointmentType || 'Clinic',
    globalVisitFees,
    homeVisitPricing
  )
  return { base, total }
}
