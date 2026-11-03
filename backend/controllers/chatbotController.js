import mongoose from 'mongoose'
import doctorModel from '../models/doctorModel.js'
import { isDoctorOpenForPatientBooking } from '../services/scheduleService.js'
import { attachRatingSummariesToDoctors } from './ratingController.js'
import {
  findAmbiguousSpecialties,
  isUnlocatedPainMessage,
  isVagueOnlyMessage,
  suggestSpecialtyFromConversation,
  suggestSpecialtyFromText,
  matchDoctorSpecialty
} from '../services/chatbotSymptomMap.js'
import { isAiConfigured, understandWithAI } from '../services/chatbotOpenAIService.js'
import {
  PAIN_LOCATION_OPTIONS,
  buildIntentReply,
  buildManipulationReply,
  buildMedicalAdviceReply,
  buildRuleBasedReply,
  countUserTurns,
  detectIntent,
  inBothLanguages,
  isGreetingOnly,
  needsMoreSymptomInfo,
  parseDoctorPreference,
  parseVisitType,
  specialtyLabels
} from '../services/chatbotConversation.js'
import { buildEmergencyAdvice, detectManipulation, detectRedFlag, isMedicalAdviceRequest } from '../services/chatbotSafety.js'
import { resolveReplyLanguage } from '../services/chatbotText.js'
import {
  buildAvailableSlotsForDoctor,
  getDefaultClinicLocation,
  pickNextSlots
} from '../services/chatbotSlotService.js'
import { bookChatbotAppointment, resolvePatientForChatbot } from '../services/chatbotBookingService.js'
import {
  clinicNow,
  isSchedulingQuery,
  parseRequestedDay,
  parseRequestedDayPart,
  parseRequestedTime,
  slotDateKey,
  wantsSoonest,
  filterSlotDaysForDate,
  formatSlotDayReply
} from '../services/chatbotScheduling.js'

const MAX_TURNS = 12
const MAX_CHARS_PER_TURN = 1000
const MAX_SCREENED_CHARS = 8000
const MAX_DOCTORS_SHOWN = 6
const APPOINTMENT_TYPES = ['Clinic', 'Home Visit', 'Voice Call', 'Video Call']

const siteDisplayName = () => process.env.VITE_APP_DISPLAY_NAME || process.env.APP_DISPLAY_NAME || 'Clinivo'

const formatDoctorForChat = (doc, nextSlots = null) => ({
  id: doc._id?.toString(),
  name: doc.name,
  speciality: doc.speciality,
  fees: doc.fees,
  locations: doc.locations || [],
  image: doc.image,
  patientBookable: doc.patientBookable !== false,
  rating: doc.ratingSummary?.averageRating ?? null,
  ...(nextSlots ? { nextSlots: nextSlots.slots, slotsMatchRequest: nextSlots.matched } : {})
})

const isValidDocId = (value) => typeof value === 'string' && mongoose.isValidObjectId(value)

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

/** Client text is untrusted. Keep user turns only, as bounded plain strings. */
const readConversation = (body = {}) => {
  const raw = Array.isArray(body.messages) ? body.messages.slice(-MAX_TURNS) : []
  const messages = raw
    .filter((m) => m && m.role === 'user' && typeof m.content === 'string')
    .map((m) => ({ role: 'user', content: m.content.slice(0, MAX_CHARS_PER_TURN) }))

  const last = raw.length ? raw[raw.length - 1] : null
  const lastText = last?.role === 'user' && typeof last.content === 'string' ? last.content : ''
  const fallback = typeof body.message === 'string' ? body.message : ''
  const fullText = (lastText || fallback).slice(0, MAX_SCREENED_CHARS).trim()

  if (!messages.length && fullText) messages.push({ role: 'user', content: fullText.slice(0, MAX_CHARS_PER_TURN) })
  return { messages, fullText, userText: fullText.slice(0, MAX_CHARS_PER_TURN) }
}

const readBookingContext = (raw) => {
  const context = raw && typeof raw === 'object' ? raw : {}
  const text = (value) => (typeof value === 'string' ? value.trim().slice(0, 120) : '')
  const appointmentType = text(context.appointmentType)
  return {
    docId: isValidDocId(context.docId) ? context.docId : '',
    clinicLocation: text(context.clinicLocation),
    specialty: text(context.specialty),
    step: text(context.step),
    appointmentType: APPOINTMENT_TYPES.includes(appointmentType) ? appointmentType : ''
  }
}

const baseResponse = (language) => ({
  success: true,
  language,
  source: 'rules',
  intent: null,
  emergency: false,
  emergencyInfo: null,
  action: null,
  understood: null,
  followUp: null,
  noDoctors: false,
  suggestedSpecialty: null,
  suggestedDoctors: [],
  showDoctorPicker: false,
  showSlotPicker: false
})

const bilingual = (replyI18n, language) => ({ reply: replyI18n[language], replyI18n })

/** What the message said beyond the specialty, for the "what I understood" chips and for slot filtering. */
const readEntities = (text) => {
  const date = parseRequestedDay(text, clinicNow())
  const day = date
    ? {
        slotDate: slotDateKey(date),
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      }
    : null
  const time = parseRequestedTime(text)
  return {
    date,
    day,
    dayPart: parseRequestedDayPart(text),
    time,
    visitType: parseVisitType(text),
    preference: parseDoctorPreference(text),
    soonest: wantsSoonest(text)
  }
}

const publicEntities = (entities) => ({
  day: entities.day,
  dayPart: entities.dayPart,
  timeCandidates: entities.time?.candidates || null,
  visitType: entities.visitType,
  preference: entities.preference,
  soonest: entities.soonest
})

const doctorOffersVisitType = (doc, type) => {
  if (!type || type === 'Clinic') return true
  if (type === 'Voice Call') return doc.acceptsVoiceCall !== false
  if (type === 'Video Call') return doc.acceptsVideoCall !== false
  return (doc.homeVisitAreas || []).length > 0
}

const rankDoctors = (rows, preference) => {
  const soonest = (row) => {
    const first = row.nextSlots.slots[0]
    return first ? new Date(first.date).getTime() : Number.MAX_SAFE_INTEGER
  }
  const byPreference = {
    cheapest: (a, b) => Number(a.doc.fees || 0) - Number(b.doc.fees || 0),
    best_rated: (a, b) => (b.doc.ratingSummary?.averageRating || 0) - (a.doc.ratingSummary?.averageRating || 0)
  }[preference]

  return [...rows].sort(
    (a, b) =>
      Number(b.nextSlots.matched) - Number(a.nextSlots.matched) ||
      (byPreference ? byPreference(a, b) : 0) ||
      soonest(a) - soonest(b) ||
      (b.doc.ratingSummary?.averageRating || 0) - (a.doc.ratingSummary?.averageRating || 0)
  )
}

/** Doctors for a specialty with their next slots, best fit for this request first. */
const findDoctorsWithSlots = async (specialty, entities) => {
  const appointmentType = entities.visitType || 'Clinic'
  const doctors = await loadBookableDoctors({ specialty, strict: true })
  const rows = doctors
    .filter((doc) => doctorOffersVisitType(doc, entities.visitType))
    .map((doc) => ({
      doc,
      nextSlots: pickNextSlots(doc, {
        appointmentType,
        date: entities.date,
        dayPart: entities.dayPart,
        time: entities.time
      })
    }))
    .filter((row) => row.nextSlots.slots.length > 0)

  return {
    anyInSpecialty: doctors.length > 0,
    doctors: rankDoctors(rows, entities.preference)
      .slice(0, MAX_DOCTORS_SHOWN)
      .map((row) => formatDoctorForChat(row.doc, row.nextSlots))
  }
}

const describeNoSlotFit = (language) =>
  language === 'ar'
    ? 'مفيش ميعاد مظبوط زي ما طلبت، فدي أقرب المواعيد المتاحة.'
    : "Nothing fits that exact time, so here are the nearest ones available."

/** Replies with doctors for a specialty, or with what to do when there are none. */
const respondWithSpecialty = async ({ res, base, specialty, entities, replyI18n, source, reply, language, siteName, userText }) => {
  const { doctors } = await findDoctorsWithSlots(specialty, entities)
  const understood = { specialty, ...publicEntities(entities) }

  if (!doctors.length) {
    const noDoctors = inBothLanguages((lang) =>
      buildRuleBasedReply({ language: lang, userText, suggestedSpecialty: specialty, siteName, noDoctorsForSpecialty: true })
    )
    return res.json({
      ...base,
      ...bilingual(noDoctors, language),
      intent: 'no_doctors',
      noDoctors: true,
      suggestedSpecialty: specialty,
      understood
    })
  }

  const asked = Boolean(entities.date || entities.dayPart || entities.time)
  const nothingFits = asked && !doctors.some((doc) => doc.slotsMatchRequest)
  const extra = nothingFits ? inBothLanguages(describeNoSlotFit) : null
  const withExtra = (text, lang) => (extra ? `${text}\n\n${extra[lang]}` : text)

  const body = reply
    ? { reply: withExtra(reply, language) }
    : {
        reply: withExtra(replyI18n[language], language),
        replyI18n: { en: withExtra(replyI18n.en, 'en'), ar: withExtra(replyI18n.ar, 'ar') }
      }

  return res.json({
    ...base,
    ...body,
    source,
    intent: 'show_doctors',
    understood,
    suggestedSpecialty: specialty,
    suggestedDoctors: doctors,
    showDoctorPicker: true
  })
}

/** A doctor is already chosen and the message is about when. */
const respondWithDoctorSlots = async ({ res, base, context, entities, language }) => {
  const doctor = await doctorModel.findById(context.docId).select('-password -email')
  if (!doctor) {
    return res.json({ success: false, message: 'Doctor not found' })
  }

  const appointmentType = context.appointmentType || 'Clinic'
  const locations = (doctor.locations || []).map((l) => String(l || '').trim()).filter(Boolean)
  const location = context.clinicLocation || getDefaultClinicLocation(doctor)
  const selectedDoctor = formatDoctorForChat({ ...doctor.toObject(), patientBookable: true })
  const understood = publicEntities(entities)

  if (locations.length > 1 && !location && appointmentType === 'Clinic') {
    const replyI18n = {
      en: 'Please choose a clinic branch from the buttons below first.',
      ar: 'اختار فرع العيادة من الأزرار تحت الأول.'
    }
    return res.json({
      ...base,
      ...bilingual(replyI18n, language),
      intent: 'choose_branch',
      needsClinicLocation: true,
      locations,
      selectedDoctor,
      understood
    })
  }

  const allDays = buildAvailableSlotsForDoctor(doctor, {
    days: 14,
    appointmentType,
    clinicLocation: location
  })
  const requested = entities.date ? filterSlotDaysForDate(allDays, entities.date) : allDays
  const slotDays = requested.length ? requested : allDays

  return res.json({
    ...base,
    reply: formatSlotDayReply({
      language,
      doctorName: doctor.name,
      slotDays,
      requestedDate: entities.date && requested.length ? entities.date : null
    }),
    intent: 'show_slots',
    showSlotPicker: true,
    slotDays,
    requestedDayAvailable: !entities.date || requested.length > 0,
    clinicLocation: location,
    locations,
    selectedDoctor,
    suggestedSpecialty: doctor.speciality,
    understood
  })
}

/** Intents that move the conversation. The client carries them out; nothing is booked from here. */
const NAVIGATION_ACTIONS = {
  restart: 'restart',
  decline: 'decline',
  change_doctor: 'change_doctor',
  change_time: 'change_time',
  back: 'back',
  my_appointments: 'open_appointments',
  human: 'open_contact',
  affirm: 'affirm',
  negative: 'negative'
}

/** POST /api/chatbot/message */
export const postChatbotMessage = async (req, res) => {
  try {
    const { messages, fullText, userText } = readConversation(req.body)
    if (!userText) {
      return res.json({ success: false, message: 'Message is required' })
    }

    const language = resolveReplyLanguage(userText, req.body.language)
    const base = baseResponse(language)
    const context = readBookingContext(req.body.bookingContext)
    const siteName = siteDisplayName()

    // Safety comes first, on the whole message, at every step of the conversation.
    const redFlag = detectRedFlag(fullText)
    if (redFlag) {
      const advice = buildEmergencyAdvice(redFlag.category)
      return res.json({
        ...base,
        ...bilingual({ en: advice.en, ar: advice.ar }, language),
        intent: 'emergency',
        emergency: true,
        emergencyInfo: {
          category: advice.category,
          callNumber: advice.callNumber,
          crisisNumber: advice.crisisNumber
        }
      })
    }

    const manipulation = detectManipulation(fullText)
    if (manipulation) {
      return res.json({
        ...base,
        ...bilingual(inBothLanguages((lang) => buildManipulationReply({ language: lang, kind: manipulation })), language),
        intent: 'refused'
      })
    }

    const entities = readEntities(userText)
    const latestSpecialty = suggestSpecialtyFromText(userText)
    const conversationSpecialty = suggestSpecialtyFromConversation(messages)
    const specialty = latestSpecialty || conversationSpecialty || (context.specialty && !context.docId ? context.specialty : null)

    if (isMedicalAdviceRequest(userText)) {
      const replyI18n = inBothLanguages((lang) =>
        buildMedicalAdviceReply({ language: lang, suggestedSpecialty: latestSpecialty })
      )
      if (latestSpecialty) {
        const response = { ...base, intent: 'medical_advice' }
        return respondWithSpecialty({ res, base: response, specialty: latestSpecialty, entities, replyI18n, source: 'rules', language, siteName, userText })
      }
      return res.json({ ...base, ...bilingual(replyI18n, language), intent: 'medical_advice' })
    }

    const intent = detectIntent(userText)
    // "Another day: tomorrow" already says which day, so go straight to it.
    if (intent === 'change_time' && context.docId && entities.day) {
      return respondWithDoctorSlots({ res, base, context, entities, language })
    }
    if (intent && NAVIGATION_ACTIONS[intent]) {
      const replyI18n = inBothLanguages((lang) => buildIntentReply({ intent, language: lang, siteName }))
      return res.json({
        ...base,
        ...bilingual(replyI18n, language),
        intent,
        action: NAVIGATION_ACTIONS[intent],
        understood: publicEntities(entities)
      })
    }

    // A new specialty beats the current doctor: "actually, I need a dentist".
    const namedNewSpecialty = latestSpecialty && (!context.specialty || latestSpecialty !== context.specialty)
    if (context.docId && !namedNewSpecialty && isSchedulingQuery(userText)) {
      return respondWithDoctorSlots({ res, base, context, entities, language })
    }

    if (intent) {
      const replyI18n = inBothLanguages((lang) =>
        buildIntentReply({ intent, language: lang, siteName, hasDoctor: Boolean(context.docId) })
      )
      return res.json({ ...base, ...bilingual(replyI18n, language), intent })
    }

    if (isGreetingOnly(userText)) {
      const replyI18n = inBothLanguages((lang) => buildRuleBasedReply({ language: lang, userText, siteName }))
      return res.json({ ...base, ...bilingual(replyI18n, language), intent: 'greeting' })
    }

    const ambiguous = findAmbiguousSpecialties(userText)
    if (ambiguous.length > 1) {
      const options = [...ambiguous, 'General physician'].map((name) => ({
        id: name,
        specialty: name,
        en: name,
        ar: specialtyLabels[name]?.section || name
      }))
      return res.json({
        ...base,
        ...bilingual(
          {
            en: "I'm sorry you're dealing with that. Which is bothering you most? If you're not sure, a general physician is a good place to start.",
            ar: 'ألف سلامة عليك. إيه أكتر حاجة تاعباك؟ ولو مش متأكد، دكتور الطب العام بداية كويسة.'
          },
          language
        ),
        intent: 'choose_specialty',
        followUp: { kind: 'choose_specialty', options },
        understood: publicEntities(entities)
      })
    }

    const needsFollowUp = !latestSpecialty && needsMoreSymptomInfo(messages, userText)
    const needsPainLocation = !latestSpecialty && isUnlocatedPainMessage(userText)
    const isVague = !latestSpecialty && isVagueOnlyMessage(userText)
    const ruleContext = { userText, siteName, isFirstTurn: countUserTurns(messages) <= 1, needsFollowUp }
    const ruleReply = (suggestedSpecialty) =>
      inBothLanguages((lang) => buildRuleBasedReply({ language: lang, suggestedSpecialty, ...ruleContext }))

    if (specialty && !needsFollowUp) {
      return respondWithSpecialty({
        res,
        base,
        specialty,
        entities,
        replyI18n: ruleReply(specialty),
        source: 'rules',
        language,
        siteName,
        userText
      })
    }

    if (needsPainLocation || isVague) {
      return res.json({
        ...base,
        ...bilingual(ruleReply(null), language),
        intent: 'follow_up',
        understood: publicEntities(entities),
        followUp: needsPainLocation ? { kind: 'pain_location', options: PAIN_LOCATION_OPTIONS } : null
      })
    }

    // The rules did not understand. This is the only case that costs money.
    const ai = isAiConfigured() ? await understandWithAI({ messages, language, siteName, ip: req.ip }) : null

    if (ai?.redFlag) {
      const advice = buildEmergencyAdvice('cardiac')
      return res.json({
        ...base,
        ...bilingual({ en: advice.en, ar: advice.ar }, language),
        source: 'ai',
        intent: 'emergency',
        emergency: true,
        emergencyInfo: { category: advice.category, callNumber: advice.callNumber, crisisNumber: advice.crisisNumber }
      })
    }

    if (ai?.specialty && ['symptoms', 'book_specialty'].includes(ai.intent)) {
      return respondWithSpecialty({
        res,
        base,
        specialty: ai.specialty,
        entities,
        reply: ai.reply,
        source: 'ai',
        language,
        siteName,
        userText
      })
    }

    if (ai) {
      return res.json({ ...base, reply: ai.reply, source: 'ai', intent: ai.intent, understood: publicEntities(entities) })
    }

    return res.json({
      ...base,
      ...bilingual(ruleReply(null), language),
      intent: 'unclear',
      understood: publicEntities(entities)
    })
  } catch (error) {
    // No request content in logs: it holds health details.
    console.error('chatbot message:', error?.name || 'error')
    return res.json({ success: false, message: 'Chat failed' })
  }
}

/** GET /api/chatbot/doctors?speciality= */
export const getChatbotDoctors = async (req, res) => {
  try {
    const specialty = String(req.query.speciality || req.query.specialty || '').trim().slice(0, 120)
    const doctors = await loadBookableDoctors({ specialty, strict: Boolean(specialty) })
    return res.json({
      success: true,
      doctors: doctors.map((doc) => formatDoctorForChat(doc)),
      speciality: specialty || null
    })
  } catch (error) {
    console.error('chatbot doctors:', error?.name || 'error')
    return res.json({ success: false, message: 'Could not load doctors' })
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
    if (!isValidDocId(docId)) {
      return res.json({ success: false, message: 'Doctor not found' })
    }

    const doctor = await doctorModel.findById(docId).select('-password -email')
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
    const requestedType = String(req.query.appointmentType || 'Clinic').trim()
    const appointmentType = APPOINTMENT_TYPES.includes(requestedType) ? requestedType : 'Clinic'

    if (locations.length > 1 && !clinicLocation && appointmentType === 'Clinic') {
      return res.json({
        success: true,
        needsClinicLocation: true,
        locations,
        days: []
      })
    }

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
    console.error('chatbot slots:', error?.name || 'error')
    return res.json({ success: false, message: 'Could not load available times' })
  }
}

const SLOT_DATE = /^\d{1,2}_\d{1,2}_\d{4}$/
const SLOT_TIME = /^\d{1,2}:\d{2}\s?[AP]M$/i

/** POST /api/chatbot/book-appointment. Booking needs a login and an explicit confirmation. */
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
      confirmed
    } = req.body

    if (!docId || !slotDate || !slotTime) {
      return res.json({ success: false, message: 'Doctor, date, and time are required' })
    }

    if (
      !isValidDocId(docId) ||
      typeof slotDate !== 'string' ||
      !SLOT_DATE.test(slotDate) ||
      typeof slotTime !== 'string' ||
      !SLOT_TIME.test(slotTime) ||
      typeof clinicLocation !== 'string' ||
      !APPOINTMENT_TYPES.includes(appointmentType) ||
      typeof visitFeeType !== 'string' ||
      typeof paymentMethod !== 'string' ||
      !homeVisitAddress ||
      typeof homeVisitAddress !== 'object'
    ) {
      return res.json({ success: false, message: 'Invalid booking details' })
    }

    if (confirmed !== true) {
      return res.json({ success: false, needConfirmation: true, message: 'Please confirm the booking first' })
    }

    const resolved = await resolvePatientForChatbot({ userId: req.user?.userId })

    if (resolved.error) {
      return res.json({ success: false, message: resolved.error })
    }

    if (resolved.needRegistration) {
      return res.json({
        success: false,
        needLogin: true,
        needRegistration: true,
        message: resolved.message
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
      req
    })

    if (result.needLogin) {
      return res.json({ success: false, needLogin: true, message: result.message })
    }

    if (!result.success) return res.json(result)

    // Only what the confirmation needs. The stored appointment also embeds full patient and doctor records.
    return res.json({
      success: true,
      message: result.message,
      reservationNumber: result.reservationNumber,
      appointment: {
        id: result.appointment._id,
        slotDate: result.appointment.slotDate,
        slotTime: result.appointment.slotTime,
        amount: result.appointment.amount,
        appointmentType: result.appointment.appointmentType,
        clinicLocation: result.appointment.clinicLocation
      }
    })
  } catch (error) {
    console.error('chatbot book:', error?.name || 'error')
    return res.json({ success: false, message: 'Could not complete the booking' })
  }
}
