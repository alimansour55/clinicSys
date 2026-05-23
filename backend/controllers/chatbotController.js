import doctorModel from '../models/doctorModel.js'
import { isDoctorOpenForPatientBooking } from '../services/scheduleService.js'
import { attachRatingSummariesToDoctors } from './ratingController.js'
import {
  detectMessageLanguage,
  detectEmergency,
  suggestSpecialtyFromSymptoms,
  matchDoctorSpecialty
} from '../services/chatbotSymptomMap.js'
import { generateChatbotReply } from '../services/chatbotOpenAIService.js'
import {
  shouldOfferDoctorPicker,
  hasHealthConcern,
  isGreetingOnly,
  countUserTurns
} from '../services/chatbotConversation.js'
import { buildAvailableSlotsForDoctor, getDefaultClinicLocation } from '../services/chatbotSlotService.js'
import { bookChatbotAppointment, resolvePatientForChatbot } from '../services/chatbotBookingService.js'

const formatDoctorForChat = (doc) => ({
  id: doc._id?.toString(),
  name: doc.name,
  speciality: doc.speciality,
  fees: doc.fees,
  locations: doc.locations || [],
  image: doc.image,
  patientBookable: doc.patientBookable !== false,
  rating: doc.ratingSummary?.averageRating ?? null
})

const loadBookableDoctors = async ({ specialty = '' } = {}) => {
  const doctors = await doctorModel.find({ available: { $ne: false } }).select('-password -email').lean()
  const withRatings = await attachRatingSummariesToDoctors(doctors)
  const bookable = withRatings
    .map((doc) => ({
      ...doc,
      patientBookable: isDoctorOpenForPatientBooking(doc)
    }))
    .filter((doc) => doc.patientBookable)

  if (!specialty) return bookable

  return bookable.filter((doc) => matchDoctorSpecialty(doc.speciality, specialty))
}

const emergencyReply = (language) =>
  language === 'ar'
    ? '⚠️ هذه الأعراض قد تكون طارئة. توجه فوراً إلى قسم الطوارئ أو اتصل بالإسعاف. لا يمكننا حجز موعد عادي الآن.'
    : '⚠️ These symptoms may be an emergency. Please go to the emergency room or call emergency services now. We cannot book a routine appointment for this.'

/** POST /api/chatbot/message */
export const postChatbotMessage = async (req, res) => {
  try {
    const messages = Array.isArray(req.body.messages) ? req.body.messages : []
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    const userText = String(lastUser?.content || req.body.message || '').trim()

    if (!userText) {
      return res.json({ success: false, message: 'Message is required' })
    }

    const language =
      req.body.language === 'ar' || req.body.language === 'en'
        ? req.body.language
        : detectMessageLanguage(userText)

    if (detectEmergency(userText)) {
      return res.json({
        success: true,
        reply: emergencyReply(language),
        language,
        emergency: true,
        suggestedSpecialty: null,
        suggestedDoctors: [],
        showDoctorPicker: false
      })
    }

    const suggestedSpecialty =
      suggestSpecialtyFromSymptoms(userText) ||
      (req.body.bookingContext?.specialty ? String(req.body.bookingContext.specialty) : null)

    const offerDoctors = hasHealthConcern(userText) && !isGreetingOnly(userText)
    const doctors = offerDoctors
      ? await loadBookableDoctors({ specialty: suggestedSpecialty || '' })
      : []
    const suggestedDoctors = doctors.slice(0, 6).map(formatDoctorForChat)

    const doctorsContext = offerDoctors
      ? JSON.stringify(suggestedDoctors.length ? suggestedDoctors : (await loadBookableDoctors()).slice(0, 8).map(formatDoctorForChat))
      : '[]'

    const siteName = process.env.VITE_APP_DISPLAY_NAME || process.env.APP_DISPLAY_NAME || 'Clinivo'
    const userTurns = countUserTurns(messages)

    const { reply } = await generateChatbotReply({
      messages,
      language,
      doctorsContext,
      siteName,
      userText,
      suggestedSpecialty,
      isFirstTurn: userTurns <= 1
    })

    const showDoctorPicker = shouldOfferDoctorPicker({
      userText,
      messages,
      suggestedDoctors
    })

    return res.json({
      success: true,
      reply,
      language,
      emergency: false,
      suggestedSpecialty: showDoctorPicker ? suggestedSpecialty : null,
      suggestedDoctors: showDoctorPicker ? suggestedDoctors : [],
      showDoctorPicker
    })
  } catch (error) {
    console.error('chatbot message:', error)
    return res.json({ success: false, message: error.message || 'Chat failed' })
  }
}

/** GET /api/chatbot/doctors?speciality= */
export const getChatbotDoctors = async (req, res) => {
  try {
    const specialty = String(req.query.speciality || req.query.specialty || '').trim()
    const doctors = await loadBookableDoctors({ specialty })
    return res.json({
      success: true,
      doctors: doctors.map(formatDoctorForChat),
      speciality: specialty || null
    })
  } catch (error) {
    console.error('chatbot doctors:', error)
    return res.json({ success: false, message: error.message })
  }
}

/** GET /api/chatbot/available-slots?docId=&days=14&clinicLocation= */
export const getChatbotAvailableSlots = async (req, res) => {
  try {
    const docId = String(req.query.docId || '').trim()
    const dayCount = Math.min(14, Math.max(1, Number(req.query.days) || 10))
    let clinicLocation = String(req.query.clinicLocation || '').trim()

    if (!docId) {
      return res.json({ success: false, message: 'docId is required' })
    }

    const doctor = await doctorModel.findById(docId).select('-password')
    if (!doctor) {
      return res.json({ success: false, message: 'Doctor not found' })
    }

    if (!isDoctorOpenForPatientBooking(doctor)) {
      return res.json({ success: false, message: 'Doctor has no published schedule' })
    }

    if (!clinicLocation) {
      clinicLocation = getDefaultClinicLocation(doctor)
    }

    const locations = (doctor.locations || []).map((l) => String(l || '').trim()).filter(Boolean)
    if (locations.length > 1 && !clinicLocation) {
      return res.json({
        success: true,
        needsClinicLocation: true,
        locations,
        days: []
      })
    }

    const slotDays = buildAvailableSlotsForDoctor(doctor, {
      days: dayCount,
      appointmentType: 'Clinic',
      clinicLocation
    })

    return res.json({
      success: true,
      docId,
      clinicLocation,
      locations: locations.length ? locations : [],
      days: slotDays
    })
  } catch (error) {
    console.error('chatbot slots:', error)
    return res.json({ success: false, message: error.message })
  }
}

/** POST /api/chatbot/book-appointment */
export const postChatbotBookAppointment = async (req, res) => {
  try {
    const {
      docId,
      slotDate,
      slotTime,
      clinicLocation = '',
      paymentMethod = 'Cash',
      symptoms = '',
      patientName = '',
      patientPhone = ''
    } = req.body

    if (!docId || !slotDate || !slotTime) {
      return res.json({ success: false, message: 'Doctor, date, and time are required' })
    }

    const resolved = await resolvePatientForChatbot({
      userId: req.user?.userId,
      phone: patientPhone,
      name: patientName
    })

    if (resolved.error) {
      return res.json({ success: false, message: resolved.error })
    }

    if (resolved.needRegistration) {
      return res.json({
        success: false,
        needLogin: true,
        needRegistration: true,
        message: resolved.message,
        phone: resolved.phone
      })
    }

    const result = await bookChatbotAppointment({
      userId: resolved.userId,
      docId,
      slotDate,
      slotTime,
      clinicLocation,
      paymentMethod,
      symptoms,
      req
    })

    if (result.needLogin) {
      return res.json({ success: false, needLogin: true, message: result.message })
    }

    return res.json(result)
  } catch (error) {
    console.error('chatbot book:', error)
    return res.json({ success: false, message: error.message })
  }
}
