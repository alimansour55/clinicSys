import express from 'express'
import { registerUser, loginUser, getProfile, updateProfile, updateInsurance, getMedicalHistory, createMedicalHistory, updateMedicalHistory, bookAppointment, listAppointment, cancelAppointment, getUserPrescription, sendPasswordResetOtp, verifyPasswordResetOtp, resetPassword } from '../controllers/userController.js'
import authUser from '../middlewares/authUser.js'
import upload from '../middlewares/multer.js'
import { authorizePermission } from '../middlewares/rbac.js'
import { getPublicSiteSettings } from '../controllers/siteSettingController.js'
import { confirmBookingPaymentIntent, confirmPaymentIntent, createBookingPaymentIntent, createPaymentIntent } from '../controllers/paymentController.js'
import { createRating, getDoctorRatings } from '../controllers/ratingController.js'

const userRouter = express.Router()

const optionalUpload = (fieldName) => (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.single(fieldName)(req, res, next)
  }
  return next()
}

userRouter.post('/register', optionalUpload('insuranceCardPhoto'), registerUser)
userRouter.post('/login', loginUser)
userRouter.get('/site-settings', getPublicSiteSettings)
userRouter.get('/doctor-ratings/:docId', getDoctorRatings)

userRouter.post('/send-reset-otp', sendPasswordResetOtp)
userRouter.post('/verify-reset-otp', verifyPasswordResetOtp)
userRouter.post('/reset-password', resetPassword)

userRouter.get('/get-profile', authUser, authorizePermission('view own profile'), getProfile)
userRouter.post('/update-profile', upload.single('image'), authUser, authorizePermission('update own basic profile'), updateProfile)
userRouter.post('/insurance', optionalUpload('insuranceCardPhoto'), authUser, authorizePermission('update own basic profile'), updateInsurance)
userRouter.post('/update-insurance', optionalUpload('insuranceCardPhoto'), authUser, authorizePermission('update own basic profile'), updateInsurance)
userRouter.get('/medical-history', authUser, authorizePermission('view own medical history'), getMedicalHistory)
userRouter.post('/medical-history', authUser, authorizePermission('update own medical history'), createMedicalHistory)
userRouter.put('/medical-history', authUser, authorizePermission('update own medical history'), updateMedicalHistory)
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
