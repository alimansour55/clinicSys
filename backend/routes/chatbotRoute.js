import express from 'express'
import {
  postChatbotMessage,
  getChatbotDoctors,
  getChatbotAvailableSlots,
  postChatbotBookAppointment
} from '../controllers/chatbotController.js'
import optionalAuthUser from '../middlewares/optionalAuthUser.js'

const chatbotRouter = express.Router()

chatbotRouter.post('/message', postChatbotMessage)
chatbotRouter.get('/doctors', getChatbotDoctors)
chatbotRouter.get('/available-slots', getChatbotAvailableSlots)
chatbotRouter.post('/book-appointment', optionalAuthUser, postChatbotBookAppointment)

export default chatbotRouter
