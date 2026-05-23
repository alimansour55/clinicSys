import { doctorBelongsToClinicSection } from './doctorClinicPlaces'
import {
  hasDoctorPublishedSchedule,
  isDoctorBookableForPatients,
  isDoctorComingSoon
} from './doctorBooking'
import { doctorOffersHomeVisit } from './homeVisitAreas'
import { SPECIALTY_IDS } from './chatbotSpecialty'
import { translatePlaceSegment } from './placeTranslations'

const SYMPTOM_PRESETS = [
  {
    id: 'skin',
    specialty: SPECIALTY_IDS.DERMATOLOGIST,
    labelEn: 'Skin problem',
    labelAr: 'مشكلة جلدية'
  },
  {
    id: 'child',
    specialty: SPECIALTY_IDS.PEDIATRICIANS,
    labelEn: 'Child doctor',
    labelAr: 'طبيب أطفال'
  },
  {
    id: 'headache',
    specialty: SPECIALTY_IDS.NEUROLOGIST,
    labelEn: 'Headache',
    labelAr: 'صداع'
  },
  {
    id: 'pregnancy',
    specialty: SPECIALTY_IDS.GYNECOLOGIST,
    labelEn: 'Pregnancy',
    labelAr: 'حمل'
  },
  {
    id: 'flu',
    specialty: SPECIALTY_IDS.GENERAL,
     labelEn: 'Flu or fever',
    labelAr: 'برد أو حرارة'
  }
]

const norm = (value) => String(value || '').trim().toLowerCase()

const bookableDoctors = (doctors) =>
  (doctors || []).filter((d) => isDoctorBookableForPatients(d) && !isDoctorComingSoon(d))

/**
 * Quick-start chips shown when the chat opens — clinics, services, symptoms, popular doctors.
 */
export const buildOpeningSuggestions = ({
  doctors = [],
  clinics = [],
  siteSettings = {},
  t = (k) => k,
  tc = (k) => k,
  displayPersonName = (n) => n,
  language = 'en',
  placeTranslationOverrides,
  maxTotal = 12
} = {}) => {
  const bookable = bookableDoctors(doctors)
  const suggestions = []
  const seenKeys = new Set()
  const isAr = language === 'ar'

  const push = (item) => {
    const key = item.dedupeKey || item.id
    if (!key || seenKeys.has(key) || suggestions.length >= maxTotal) return
    seenKeys.add(key)
    suggestions.push(item)
  }

  const activeClinics = (clinics || [])
    .map((clinic) => ({
      id: clinic?._id != null ? String(clinic._id) : null,
      name: String(clinic?.name || clinic || '').trim()
    }))
    .filter((clinic) => clinic.name)

  activeClinics.forEach((clinic) => {
    const count = bookable.filter((doctor) =>
      doctorBelongsToClinicSection(doctor, clinic.name, { clinicId: clinic.id })
    ).length
    if (!count) return

    const label =
      translatePlaceSegment(clinic.name, language, t, placeTranslationOverrides) ||
      tc(clinic.name) ||
      clinic.name

    push({
      id: `clinic-${clinic.id || clinic.name}`,
      kind: 'clinic',
      label,
      clinicName: clinic.name,
      clinicId: clinic.id,
      dedupeKey: `clinic:${norm(clinic.name)}`
    })
  })

  const serviceCards = {
    showTeleconsultation: true,
    showHomeVisit: true,
    teleconsultationTitle: 'Teleconsultation',
    homeVisitTitle: 'Home Visit',
    ...(siteSettings?.homeServiceCards || {})
  }

  if (serviceCards.showTeleconsultation !== false) {
    const teleCount = bookable.filter(
      (d) =>
        hasDoctorPublishedSchedule(d) &&
        (d.acceptsVoiceCall !== false || d.acceptsVideoCall !== false)
    ).length
    if (teleCount) {
      push({
        id: 'service-tele',
        kind: 'service',
        service: 'teleconsultation',
        label: t(serviceCards.teleconsultationTitle),
        dedupeKey: 'service:tele'
      })
    }
  }

  if (serviceCards.showHomeVisit !== false) {
    const homeCount = bookable.filter((d) => doctorOffersHomeVisit(d)).length
    if (homeCount) {
      push({
        id: 'service-home',
        kind: 'service',
        service: 'home',
        label: t(serviceCards.homeVisitTitle),
        dedupeKey: 'service:home'
      })
    }
  }

  for (const preset of SYMPTOM_PRESETS) {
    if (seenKeys.has(`clinic:${norm(preset.specialty)}`)) continue
    const hasDoctors = bookable.some((d) => norm(d.speciality) === norm(preset.specialty))
    if (!hasDoctors) continue
    push({
      id: preset.id,
      kind: 'symptom',
      specialty: preset.specialty,
      label: isAr ? preset.labelAr : preset.labelEn,
      dedupeKey: `symptom:${norm(preset.specialty)}`
    })
  }

  const topDoctors = [...bookable]
    .sort(
      (a, b) =>
        (Number(b.ratingSummary?.averageRating) || 0) -
        (Number(a.ratingSummary?.averageRating) || 0)
    )
    .slice(0, 3)

  topDoctors.forEach((doctor) => {
    const full = displayPersonName(doctor.name) || doctor.name || ''
    const shortName = String(full).split(/\s+/)[0] || full
    if (!shortName) return
    push({
      id: `doctor-${doctor._id}`,
      kind: 'doctor',
      doctorId: doctor._id,
      label: isAr ? `د. ${shortName}` : `Dr ${shortName}`,
      dedupeKey: `doctor:${doctor._id}`
    })
  })

  return suggestions
}

/** Static fallback when clinic/doctor data has not loaded yet. */
export const buildFallbackOpeningSuggestions = (isRtl) => [
  {
    id: 'skin',
    kind: 'symptom',
    specialty: SPECIALTY_IDS.DERMATOLOGIST,
    label: isRtl ? 'مشكلة جلدية' : 'Skin problem'
  },
  {
    id: 'child',
    kind: 'symptom',
    specialty: SPECIALTY_IDS.PEDIATRICIANS,
    label: isRtl ? 'طبيب أطفال' : 'Child doctor'
  },
  {
    id: 'headache',
    kind: 'symptom',
    specialty: SPECIALTY_IDS.NEUROLOGIST,
    label: isRtl ? 'صداع' : 'Headache'
  },
  {
    id: 'pregnancy',
    kind: 'symptom',
    specialty: SPECIALTY_IDS.GYNECOLOGIST,
    label: isRtl ? 'حمل' : 'Pregnancy'
  },
  {
    id: 'flu',
    kind: 'symptom',
    specialty: SPECIALTY_IDS.GENERAL,
    label: isRtl ? 'برد أو حرارة' : 'Flu or fever'
  }
]
