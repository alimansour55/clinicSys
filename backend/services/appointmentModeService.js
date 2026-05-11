const validAppointmentTypes = ['Clinic', 'Voice Call', 'Video Call', 'Home Visit']

const normalizeAppointmentType = (value) => validAppointmentTypes.includes(value) ? value : 'Clinic'

const buildTeleconsultationLink = ({ appointmentId, docId, userId, slotDate, slotTime }) => {
  const roomKey = [appointmentId, docId, userId, slotDate, slotTime]
    .map((part) => String(part || '').replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
    .join('-')

  return roomKey ? `https://meet.jit.si/clinicsys-${roomKey}` : ''
}

export { buildTeleconsultationLink, normalizeAppointmentType }
