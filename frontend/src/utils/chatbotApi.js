import axios from 'axios'

export const sendChatbotMessage = async (backendUrl, { messages, language, bookingContext, token }) => {
  const headers = token ? { token } : {}
  const { data } = await axios.post(
    `${backendUrl}/api/chatbot/message`,
    { messages, language, bookingContext },
    { headers }
  )
  return data
}

export const fetchChatbotDoctors = async (backendUrl, { speciality = '' } = {}) => {
  const { data } = await axios.get(`${backendUrl}/api/chatbot/doctors`, {
    params: { speciality }
  })
  return data
}

export const fetchChatbotSlots = async (backendUrl, { docId, days = 14, clinicLocation = '' }) => {
  const { data } = await axios.get(`${backendUrl}/api/chatbot/available-slots`, {
    params: { docId, days, clinicLocation }
  })
  return data
}

export const bookChatbotAppointment = async (
  backendUrl,
  payload,
  token
) => {
  const headers = token ? { token } : {}
  const { data } = await axios.post(`${backendUrl}/api/chatbot/book-appointment`, payload, {
    headers
  })
  return data
}

/** Detect Arabic script in text for RTL chat panel */
export const messageLooksArabic = (text = '') => /[\u0600-\u06FF]/.test(String(text))
