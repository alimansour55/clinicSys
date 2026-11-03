import express from 'express'
import {
  postChatbotMessage,
  getChatbotDoctors,
  getChatbotAvailableSlots,
  postChatbotBookAppointment
} from '../controllers/chatbotController.js'
import optionalAuthUser from '../middlewares/optionalAuthUser.js'
import { limitRequests } from '../services/chatbotUsageLimits.js'

const MINUTE = 60 * 1000

const chatbotRouter = express.Router()

chatbotRouter.post('/message', limitRequests({ name: 'message', windowMs: MINUTE, max: 30 }), postChatbotMessage)
chatbotRouter.get('/doctors', limitRequests({ name: 'doctors', windowMs: MINUTE, max: 60 }), getChatbotDoctors)
chatbotRouter.get('/available-slots', limitRequests({ name: 'slots', windowMs: MINUTE, max: 60 }), getChatbotAvailableSlots)
chatbotRouter.post('/book-appointment', limitRequests({ name: 'book', windowMs: MINUTE, max: 10 }), optionalAuthUser, postChatbotBookAppointment)

export default chatbotRouter
