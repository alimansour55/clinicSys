import { doctorOffersHomeVisit } from './homeVisitService.js'

const validAppointmentTypes = ['Clinic', 'Voice Call', 'Video Call', 'Home Visit']
const defaultTeleconsultationBaseUrl = 'https://meet.ffmuc.net'

const normalizeAppointmentType = (value) => validAppointmentTypes.includes(value) ? value : 'Clinic'

const getDoctorAppointmentModeError = (doctor, appointmentType) => {
  if (appointmentType === 'Voice Call' && doctor?.acceptsVoiceCall === false) return 'This doctor does not accept voice calls'
  if (appointmentType === 'Video Call' && doctor?.acceptsVideoCall === false) return 'This doctor does not accept video calls'
  if (appointmentType === 'Home Visit' && !doctorOffersHomeVisit(doctor)) {
    return 'This doctor is not available for home visits in any area'
  }
  return ''
}

const isTeleconsultationType = (appointmentType) => ['Voice Call', 'Video Call'].includes(appointmentType)

const getTeleconsultationBaseUrl = () => {
  const configuredUrl = process.env.TELECONSULTATION_BASE_URL || process.env.JITSI_SERVER_URL || defaultTeleconsultationBaseUrl
  return String(configuredUrl).replace(/\/+$/, '')
}

const buildTeleconsultationLink = ({ appointmentId, docId, userId, slotDate, slotTime }) => {
  const roomKey = [appointmentId, docId, userId, slotDate, slotTime]
    .map((part) => String(part || '').replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
    .join('-')

  return roomKey ? `${getTeleconsultationBaseUrl()}/clinicsys-${roomKey}` : ''
}

const normalizeTeleconsultationLink = (link = '') => {
  if (!link) return ''

  try {
    const url = new URL(link)
    if (url.hostname === 'meet.jit.si') {
      const baseUrl = new URL(getTeleconsultationBaseUrl())
      url.protocol = baseUrl.protocol
      url.host = baseUrl.host
    }

    return url.toString()
  } catch {
    return link
  }
}

const normalizeAppointmentTeleconsultationLink = (appointment) => {
  if (!appointment) return appointment

  const normalizedAppointment = typeof appointment.toObject === 'function' ? appointment.toObject() : { ...appointment }

  if (!isTeleconsultationType(normalizedAppointment.appointmentType)) return normalizedAppointment

  normalizedAppointment.teleconsultationLink = normalizeTeleconsultationLink(normalizedAppointment.teleconsultationLink)
    || buildTeleconsultationLink({
      appointmentId: normalizedAppointment._id,
      docId: normalizedAppointment.docId,
      userId: normalizedAppointment.userId,
      slotDate: normalizedAppointment.slotDate,
      slotTime: normalizedAppointment.slotTime
    })

  return normalizedAppointment
}

const normalizeAppointmentTeleconsultationLinks = (appointments = []) => appointments.map(normalizeAppointmentTeleconsultationLink)

export { buildTeleconsultationLink, getDoctorAppointmentModeError, normalizeAppointmentType, normalizeTeleconsultationLink, normalizeAppointmentTeleconsultationLink, normalizeAppointmentTeleconsultationLinks }
