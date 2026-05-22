import express from 'express'
import { registerUser, loginUser, verifyPatientMfaLogin, completePatientMfaLoginSetup, getProfile, updateProfile, updateInsurance, getPatientMfaStatus, startPatientMfaSetup, enablePatientMfa, disablePatientMfa, getMedicalHistory, createMedicalHistory, updateMedicalHistory, getVisitFeeEligibility, bookAppointment, listAppointment, cancelAppointment, getUserPrescription, sendPasswordResetOtp, verifyPasswordResetOtp, resetPassword } from '../controllers/userController.js'
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
import upload from '../middlewares/multer.js'
import { authorizePermission } from '../middlewares/rbac.js'
import { getPublicSiteSettings, listInsuranceProviders } from '../controllers/siteSettingController.js'
import { confirmBookingPaymentIntent, confirmPaymentIntent, createBookingPaymentIntent, createPaymentIntent } from '../controllers/paymentController.js'
import { createRating, getDoctorRatings } from '../controllers/ratingController.js'
import { postTranslatePlaces, postTranslateTexts } from '../controllers/translateController.js'

const userRouter = express.Router()

const optionalUpload = (fieldName) => (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.single(fieldName)(req, res, next)
  }
  return next()
}

userRouter.post('/signup-verify/send-email', sendSignupEmailCode)
userRouter.post('/signup-verify/confirm-email', confirmSignupEmailCode)
userRouter.post('/signup-verify/send-phone', sendSignupPhoneCode)
userRouter.post('/signup-verify/confirm-phone', confirmSignupPhoneCode)
userRouter.post('/register', optionalUpload('insuranceCardPhoto'), registerUser)
userRouter.post('/login', loginUser)
userRouter.post('/verify-account/status', getAccountVerificationStatus)
userRouter.post('/verify-account/resend', resendAccountVerificationCodes)
userRouter.post('/verify-account/verify-email', verifyAccountEmail)
userRouter.post('/verify-account/verify-phone', verifyAccountPhone)
userRouter.post('/mfa/verify-login', verifyPatientMfaLogin)
userRouter.post('/mfa/complete-login-setup', completePatientMfaLoginSetup)
userRouter.get('/site-settings', getPublicSiteSettings)
userRouter.get('/insurance-providers', listInsuranceProviders)
userRouter.post('/translate-places', postTranslatePlaces)
userRouter.post('/translate-texts', postTranslateTexts)
userRouter.get('/doctor-ratings/:docId', getDoctorRatings)

userRouter.post('/send-reset-otp', sendPasswordResetOtp)
userRouter.post('/verify-reset-otp', verifyPasswordResetOtp)
userRouter.post('/reset-password', resetPassword)

userRouter.get('/get-profile', authUser, authorizePermission('view own profile'), getProfile)
userRouter.post('/update-profile', upload.single('image'), authUser, authorizePermission('update own basic profile'), updateProfile)
userRouter.post('/insurance', optionalUpload('insuranceCardPhoto'), authUser, authorizePermission('update own basic profile'), updateInsurance)
userRouter.post('/update-insurance', optionalUpload('insuranceCardPhoto'), authUser, authorizePermission('update own basic profile'), updateInsurance)
userRouter.get('/mfa/status', authUser, authorizePermission('view own profile'), getPatientMfaStatus)
userRouter.post('/mfa/setup', authUser, authorizePermission('update own basic profile'), startPatientMfaSetup)
userRouter.post('/mfa/enable', authUser, authorizePermission('update own basic profile'), enablePatientMfa)
userRouter.post('/mfa/disable', authUser, authorizePermission('update own basic profile'), disablePatientMfa)
userRouter.get('/medical-history', authUser, authorizePermission('view own medical history'), getMedicalHistory)
userRouter.post('/medical-history', authUser, authorizePermission('update own medical history'), createMedicalHistory)
userRouter.put('/medical-history', authUser, authorizePermission('update own medical history'), updateMedicalHistory)
userRouter.get('/visit-fee-eligibility/:docId', authUser, authorizePermission('create appointments'), getVisitFeeEligibility)
userRouter.post('/book-appointment', authUser, authorizePermission('create appointments'), bookAppointment)
userRouter.post('/create-booking-payment-intent', authUser, authorizePermission('create appointments'), createBookingPaymentIntent)
userRouter.post('/confirm-booking-payment-intent', authUser, authorizePermission('create appointments'), confirmBookingPaymentIntent)
userRouter.post('/create-payment-intent', authUser, authorizePermission('create appointments'), createPaymentIntent)
userRouter.post('/confirm-payment-intent', authUser, authorizePermission('create appointments'), confirmPaymentIntent)
userRouter.get('/appointments', authUser, authorizePermission('view own appointments'), listAppointment)
userRouter.post('/cancel-appointment', authUser, authorizePermission('cancel own appointments'), cancelAppointment)
userRouter.post('/get-prescription', authUser, authorizePermission('view own prescriptions'), getUserPrescription)  
userRouter.post('/ratings', authUser, authorizePermission('view own appointments'), createRating)
  
export default userRouter
