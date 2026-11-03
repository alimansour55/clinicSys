import axios from 'axios'

const auth = (token) => ({ headers: { token } })

export const fetchAvailability = async (backendUrl, docId, { appointmentType, clinicLocation }) => {
  const { data } = await axios.get(`${backendUrl}/api/user/availability/${docId}`, { params: { appointmentType, clinicLocation } })
  return data
}

export const fetchNextAvailable = async (backendUrl, { speciality, appointmentType, excludeDocId, limit = 3 }) => {
  const { data } = await axios.get(`${backendUrl}/api/user/next-available`, { params: { speciality, appointmentType, excludeDocId, limit } })
  return data
}

export const fetchQuote = async (backendUrl, docId, { appointmentType, visitFeeType }) => {
  const { data } = await axios.get(`${backendUrl}/api/user/booking-quote/${docId}`, { params: { appointmentType, visitFeeType } })
  return data
}

export const fetchFeeEligibility = async (backendUrl, token, docId) => {
  const { data } = await axios.get(`${backendUrl}/api/user/visit-fee-eligibility/${docId}`, auth(token))
  return data
}

export const bookWithoutCard = async (backendUrl, token, booking) => {
  const { data } = await axios.post(`${backendUrl}/api/user/book-appointment`, booking, auth(token))
  return data
}

export const startBookingCheckout = async (backendUrl, token, booking) => {
  const { data } = await axios.post(`${backendUrl}/api/user/create-booking-payment-intent`, booking, auth(token))
  return data
}

const CONFIRM_RETRIES = 6
const CONFIRM_RETRY_MS = 1500

/** The server says "pending" while another request is finishing the same payment. Waiting always ends in one answer. */
export const confirmBookingCheckout = async (backendUrl, token, paymentIntentId) => {
  for (let attempt = 0; ; attempt += 1) {
    const { data } = await axios.post(`${backendUrl}/api/user/confirm-booking-payment-intent`, { paymentIntentId }, auth(token))
    if (!data.pending || attempt >= CONFIRM_RETRIES) return data
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_RETRY_MS))
  }
}

export const releaseCheckout = async (backendUrl, token, paymentIntentId) => {
  const { data } = await axios.post(`${backendUrl}/api/user/release-booking-hold`, { paymentIntentId }, auth(token))
  return data
}

export const startPayLater = async (backendUrl, token, appointmentId) => {
  const { data } = await axios.post(`${backendUrl}/api/user/create-payment-intent`, { appointmentId }, auth(token))
  return data
}

export const confirmPayLater = async (backendUrl, token, appointmentId, paymentIntentId) => {
  const { data } = await axios.post(`${backendUrl}/api/user/confirm-payment-intent`, { appointmentId, paymentIntentId }, auth(token))
  return data
}

export const cancelVisit = async (backendUrl, token, appointmentId) => {
  const { data } = await axios.post(`${backendUrl}/api/user/cancel-appointment`, { appointmentId }, auth(token))
  return data
}

export const rescheduleVisit = async (backendUrl, token, appointmentId, slot) => {
  const { data } = await axios.post(`${backendUrl}/api/user/reschedule-appointment`, { appointmentId, ...slot }, auth(token))
  return data
}

export const fetchWaitlist = async (backendUrl, token) => {
  const { data } = await axios.get(`${backendUrl}/api/user/waitlist`, auth(token))
  return data
}

export const joinWaitlist = async (backendUrl, token, payload) => {
  const { data } = await axios.post(`${backendUrl}/api/user/waitlist/join`, payload, auth(token))
  return data
}

export const leaveWaitlist = async (backendUrl, token, entryId) => {
  const { data } = await axios.post(`${backendUrl}/api/user/waitlist/leave`, { entryId }, auth(token))
  return data
}

export const fetchGoogleCalendarUrl = async (backendUrl, token, appointmentId, lang) => {
  const { data } = await axios.get(`${backendUrl}/api/user/appointments/${appointmentId}/calendar-links`, { ...auth(token), params: { lang } })
  return data
}

/** Files need the auth header, so they cannot be plain links. */
const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const downloadFile = async (url, token, params, filename) => {
  const response = await axios.get(url, { ...auth(token), params, responseType: 'blob' })
  saveBlob(response.data, filename)
}

export const downloadCalendarFile = (backendUrl, token, appointment, lang) =>
  downloadFile(`${backendUrl}/api/user/appointments/${appointment._id}/calendar.ics`, token, { lang }, `appointment-${appointment.reservationNumber || appointment._id}.ics`)

export const downloadAppointmentPdf = (backendUrl, token, appointment, kind = 'confirmation') =>
  downloadFile(`${backendUrl}/api/user/appointments/${appointment._id}/pdf`, token, { kind }, `${kind === 'invoice' ? 'invoice' : 'appointment'}-${appointment.reservationNumber || appointment._id}.pdf`)

export const downloadPrescriptionPdf = (backendUrl, token, appointmentId, reference) =>
  downloadFile(`${backendUrl}/api/user/prescriptions/${appointmentId}/pdf`, token, {}, `prescription-${reference || appointmentId}.pdf`)
