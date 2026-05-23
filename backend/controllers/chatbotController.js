import doctorModel from '../models/doctorModel.js'
import { isDoctorOpenForPatientBooking } from '../services/scheduleService.js'
import { attachRatingSummariesToDoctors } from './ratingController.js'
import {
  detectMessageLanguage,
  detectEmergency,
  suggestSpecialtyFromConversation,
  matchDoctorSpecialty
} from '../services/chatbotSymptomMap.js'
import { generateChatbotReply } from '../services/chatbotOpenAIService.js'
import {
  shouldOfferDoctorPicker,
  needsMoreSymptomInfo,
  isGreetingOnly,
  countUserTurns,
  buildRuleBasedReply
} from '../services/chatbotConversation.js'
import { buildAvailableSlotsForDoctor, getDefaultClinicLocation } from '../services/chatbotSlotService.js'
import { bookChatbotAppointment, resolvePatientForChatbot } from '../services/chatbotBookingService.js'
import {
  isSchedulingQuery,
  parseRequestedDay,
  filterSlotDaysForDate,
  formatSlotDayReply
} from '../services/chatbotScheduling.js'

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

const loadBookableDoctors = async ({ specialty = '', strict = false } = {}) => {
  const doctors = await doctorModel.find({ available: { $ne: false } }).select('-password -email').lean()
  const withRatings = await attachRatingSummariesToDoctors(doctors)
  const bookable = withRatings
    .map((doc) => ({
      ...doc,
      patientBookable: isDoctorOpenForPatientBooking(doc)
    }))
    .filter((doc) => doc.patientBookable)

  if (!specialty) return bookable

  const matched = bookable.filter((doc) => matchDoctorSpecialty(doc.speciality, specialty))
  if (strict) return matched
  return matched.length ? matched : bookable
}

const emergencyReply = (language) =>
  language === 'ar'
    ? '⚠️ هذه الأعراض قد تكون طارئة. توجه فوراً إلى قسم الطوارئ أو اتصل بالإسعاف. لا يمكننا حجز موعد عادي الآن.'
    : '⚠️ These symptoms may be an emergency. Please go to the emergency room or call emergency services now. We cannot book a routine appointment for this.'

/** POST /api/chatbot/message */
export const postChatbotMessage = async (req, res) => {
  try {
    const messages = Array.isArray(req.body.messages) ? req.body.messages : []
    const bookingContext = req.body.bookingContext && typeof req.body.bookingContext === 'object'
      ? req.body.bookingContext
      : {}
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
        showDoctorPicker: false,
        showSlotPicker: false
      })
    }

    const docId = String(bookingContext.docId || '').trim()
    const clinicLocation = String(bookingContext.clinicLocation || '').trim()

    // Patient already chose a doctor — help with dates/times, not a new doctor list
    if (docId && isSchedulingQuery(userText)) {
      const doctor = await doctorModel.findById(docId).select('-password')
      if (!doctor) {
        return res.json({ success: false, message: 'Doctor not found' })
      }

      let loc = clinicLocation || getDefaultClinicLocation(doctor)
      const locations = (doctor.locations || []).map((l) => String(l || '').trim()).filter(Boolean)
      if (locations.length > 1 && !loc) {
        return res.json({
          success: true,
          reply:
            language === 'ar'
              ? 'من فضلك اختر فرع العيادة من الأزرار أدناه أولاً.'
              : 'Please choose a clinic branch from the buttons below first.',
          language,
          showDoctorPicker: false,
          showSlotPicker: false,
          needsClinicLocation: true,
          locations,
          selectedDoctor: formatDoctorForChat({ ...doctor.toObject(), patientBookable: true })
        })
      }

      const allDays = buildAvailableSlotsForDoctor(doctor, {
        days: 14,
        appointmentType: 'Clinic',
        clinicLocation: loc
      })

      const requestedDate = parseRequestedDay(userText)
      const filtered = requestedDate ? filterSlotDaysForDate(allDays, requestedDate) : allDays
      const slotDays = filtered.length ? filtered : allDays

      const reply = formatSlotDayReply({
        language,
        doctorName: doctor.name,
        slotDays,
        requestedDate: requestedDate && filtered.length ? requestedDate : null
      })

      return res.json({
        success: true,
        reply,
        language,
        showDoctorPicker: false,
        showSlotPicker: true,
        slotDays,
        clinicLocation: loc,
        locations,
        selectedDoctor: formatDoctorForChat({ ...doctor.toObject(), patientBookable: true }),
        suggestedSpecialty: doctor.speciality,
        suggestedDoctors: []
      })
    }

    const suggestedSpecialty =
      suggestSpecialtyFromConversation(messages) ||
      (bookingContext.specialty ? String(bookingContext.specialty) : null)

    const followUp = needsMoreSymptomInfo(messages, userText)
    const strictSpecialty = Boolean(suggestedSpecialty)
    const doctors = followUp || isGreetingOnly(userText)
      ? []
      : await loadBookableDoctors({ specialty: suggestedSpecialty || '', strict: strictSpecialty })

    const suggestedDoctors = doctors.slice(0, 6).map(formatDoctorForChat)
    const noDoctorsForSpecialty = strictSpecialty && suggestedSpecialty && suggestedDoctors.length === 0

    const doctorsContext = suggestedDoctors.length
      ? JSON.stringify(suggestedDoctors)
      : '[]'

    const siteName = process.env.VITE_APP_DISPLAY_NAME || process.env.APP_DISPLAY_NAME || 'Clinivo'
    const userTurns = countUserTurns(messages)

    let reply
    if (followUp || noDoctorsForSpecialty) {
      reply = buildRuleBasedReply({
        language,
        userText,
        suggestedSpecialty,
        siteName,
        isFirstTurn: userTurns <= 1,
        needsFollowUp: followUp,
        noDoctorsForSpecialty
      })
    } else {
      const ai = await generateChatbotReply({
        messages,
        language,
        doctorsContext,
        siteName,
        userText,
        suggestedSpecialty,
        isFirstTurn: userTurns <= 1,
        bookingContext
      })
      reply = ai.reply
    }

    const showDoctorPicker = shouldOfferDoctorPicker({
      userText,
      messages,
      suggestedDoctors,
      bookingContext
    })

    return res.json({
      success: true,
      reply,
      language,
      emergency: false,
      suggestedSpecialty: showDoctorPicker ? suggestedSpecialty : null,
      suggestedDoctors: showDoctorPicker ? suggestedDoctors : [],
      showDoctorPicker,
      showSlotPicker: false
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
    const doctors = await loadBookableDoctors({ specialty, strict: Boolean(specialty) })
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
    const dayCount = Math.min(14, Math.max(1, Number(req.query.days) || 14))
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

    const appointmentType = String(req.query.appointmentType || 'Clinic').trim() || 'Clinic'

    const slotDays = buildAvailableSlotsForDoctor(doctor, {
      days: dayCount,
      appointmentType,
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
      appointmentType = 'Clinic',
      visitFeeType = 'examination',
      homeVisitAddress = {},
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
      appointmentType,
      visitFeeType,
      homeVisitAddress,
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
