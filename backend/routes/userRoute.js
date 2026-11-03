import express from 'express'
import { getVisitFeeEligibility, bookAppointment, listAppointment, cancelAppointment, getUserPrescription } from '../controllers/userController.js'
import {
  getAccountVerificationStatus,
  resendAccountVerificationCodes,
  verifyAccountEmail,
  verifyAccountPhone
} from '../controllers/accountVerificationController.js'
import {
  sendSignupEmailCode,
  confirmSignupEmailCode,
  sendSignupPhoneCode,
  confirmSignupPhoneCode
} from '../controllers/signupVerificationController.js'
import authUser from '../middlewares/authUser.js'
import { authorizePermission } from '../middlewares/rbac.js'
import { getPublicSiteSettings, listInsuranceProviders } from '../controllers/siteSettingController.js'
import { confirmBookingPaymentIntent, confirmPaymentIntent, createBookingPaymentIntent, createPaymentIntent, releaseBookingHold } from '../controllers/paymentController.js'
import {
  downloadAppointmentPdf,
  downloadCalendar,
  downloadPrescriptionPdf,
  getAvailability,
  getBookingQuote,
  getCalendarLinks,
  getMyWaitlist,
  getNextAvailable,
  joinDoctorWaitlist,
  leaveDoctorWaitlist,
  rescheduleAppointment
} from '../controllers/bookingController.js'
import { createRating, getDoctorRatings } from '../controllers/ratingController.js'
import { postTranslatePlaces, postTranslateTexts } from '../controllers/translateController.js'

/** Patient sign-in, profile, MFA and medical history live in accountRoute.js (patientAuthRouter), mounted first. */
const userRouter = express.Router()

userRouter.post('/signup-verify/send-email', sendSignupEmailCode)
userRouter.post('/signup-verify/confirm-email', confirmSignupEmailCode)
userRouter.post('/signup-verify/send-phone', sendSignupPhoneCode)
userRouter.post('/signup-verify/confirm-phone', confirmSignupPhoneCode)
userRouter.post('/verify-account/status', getAccountVerificationStatus)
userRouter.post('/verify-account/resend', resendAccountVerificationCodes)
userRouter.post('/verify-account/verify-email', verifyAccountEmail)
userRouter.post('/verify-account/verify-phone', verifyAccountPhone)
userRouter.get('/site-settings', getPublicSiteSettings)
userRouter.get('/insurance-providers', listInsuranceProviders)
userRouter.post('/translate-places', postTranslatePlaces)
userRouter.post('/translate-texts', postTranslateTexts)
userRouter.get('/doctor-ratings/:docId', getDoctorRatings)
userRouter.get('/availability/:docId', getAvailability)
userRouter.get('/next-available', getNextAvailable)
userRouter.get('/booking-quote/:docId', getBookingQuote)

userRouter.get('/visit-fee-eligibility/:docId', authUser, authorizePermission('create appointments'), getVisitFeeEligibility)
userRouter.post('/book-appointment', authUser, authorizePermission('create appointments'), bookAppointment)
userRouter.post('/create-booking-payment-intent', authUser, authorizePermission('create appointments'), createBookingPaymentIntent)
userRouter.post('/confirm-booking-payment-intent', authUser, authorizePermission('create appointments'), confirmBookingPaymentIntent)
userRouter.post('/release-booking-hold', authUser, authorizePermission('create appointments'), releaseBookingHold)
userRouter.post('/create-payment-intent', authUser, authorizePermission('create appointments'), createPaymentIntent)
userRouter.post('/confirm-payment-intent', authUser, authorizePermission('create appointments'), confirmPaymentIntent)
userRouter.get('/appointments', authUser, authorizePermission('view own appointments'), listAppointment)
userRouter.post('/cancel-appointment', authUser, authorizePermission('cancel own appointments'), cancelAppointment)
userRouter.post('/reschedule-appointment', authUser, authorizePermission('cancel own appointments'), rescheduleAppointment)
userRouter.get('/appointments/:appointmentId/calendar.ics', authUser, authorizePermission('view own appointments'), downloadCalendar)
userRouter.get('/appointments/:appointmentId/calendar-links', authUser, authorizePermission('view own appointments'), getCalendarLinks)
userRouter.get('/appointments/:appointmentId/pdf', authUser, authorizePermission('view own appointments'), downloadAppointmentPdf)
userRouter.get('/prescriptions/:appointmentId/pdf', authUser, authorizePermission('view own prescriptions'), downloadPrescriptionPdf)
userRouter.get('/waitlist', authUser, authorizePermission('view own appointments'), getMyWaitlist)
userRouter.post('/waitlist/join', authUser, authorizePermission('create appointments'), joinDoctorWaitlist)
userRouter.post('/waitlist/leave', authUser, authorizePermission('create appointments'), leaveDoctorWaitlist)
userRouter.post('/get-prescription', authUser, authorizePermission('view own prescriptions'), getUserPrescription)  
userRouter.post('/ratings', authUser, authorizePermission('view own appointments'), createRating)
  
export default userRouter
