import express from 'express'
import {
  bookAppointmentForPatient,
  checkInPatient,
  completeReceptionistMfaLoginSetup,
  createPatientForReceptionist,
  disableReceptionistMfa,
  enableReceptionistMfa,
  getReceptionistMfaStatus,
  loginReceptionist,
  receptionistAppointments,
  receptionistClinics,
  receptionistDashboard,
  receptionistDoctors,
  receptionistPatientDetails,
  receptionistPatients,
  receptionistProfile,
  startReceptionistMfaSetup,
  updateAppointmentHomeVisitAddress,
  updateAppointmentStatus,
  updatePatientInsurance,
  verifyPatientInsurance,
  updateDoctorLocationsByReceptionist,
  updatePayment,
  updateReceptionistProfileData,
  verifyReceptionistMfaLogin
} from '../controllers/receptionistController.js'
import authReceptionist from '../middlewares/authReceptionist.js'
import { authorizePermission } from '../middlewares/rbac.js'
import upload from '../middlewares/multer.js'
import { getDoctorRatings } from '../controllers/ratingController.js'

const receptionistRouter = express.Router()

const optionalImageUpload = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.single('image')(req, res, next)
  }
  return next()
}

const optionalUpload = (fieldName) => (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.single(fieldName)(req, res, next)
  }
  return next()
}

receptionistRouter.post('/login', loginReceptionist)
receptionistRouter.post('/mfa/verify-login', verifyReceptionistMfaLogin)
receptionistRouter.post('/mfa/complete-login-setup', completeReceptionistMfaLoginSetup)
receptionistRouter.get('/profile', authReceptionist, authorizePermission('view own profile'), receptionistProfile)
receptionistRouter.post('/update-profile', authReceptionist, authorizePermission('update own profile'), optionalImageUpload, updateReceptionistProfileData)
receptionistRouter.get('/mfa/status', authReceptionist, authorizePermission('view own profile'), getReceptionistMfaStatus)
receptionistRouter.post('/mfa/setup', authReceptionist, authorizePermission('update own profile'), startReceptionistMfaSetup)
receptionistRouter.post('/mfa/enable', authReceptionist, authorizePermission('update own profile'), enableReceptionistMfa)
receptionistRouter.post('/mfa/disable', authReceptionist, authorizePermission('update own profile'), disableReceptionistMfa)
receptionistRouter.get('/dashboard', authReceptionist, receptionistDashboard)
receptionistRouter.get('/appointments', authReceptionist, authorizePermission('update appointments'), receptionistAppointments)
receptionistRouter.get('/doctors', authReceptionist, authorizePermission('view doctors'), receptionistDoctors)
receptionistRouter.get('/clinics', authReceptionist, authorizePermission('view doctors'), receptionistClinics)
receptionistRouter.get('/doctor-ratings/:docId', authReceptionist, authorizePermission('view doctors'), getDoctorRatings)
receptionistRouter.get('/patients', authReceptionist, authorizePermission('view basic patient profile'), receptionistPatients)
receptionistRouter.get('/patients/:patientId', authReceptionist, authorizePermission('view basic patient profile'), receptionistPatientDetails)
receptionistRouter.post('/patients', authReceptionist, authorizePermission('create appointments'), optionalUpload('insuranceCardPhoto'), createPatientForReceptionist)
receptionistRouter.post('/patient-insurance', authReceptionist, authorizePermission('view basic patient profile'), optionalUpload('insuranceCardPhoto'), updatePatientInsurance)
receptionistRouter.post('/patient-insurance-verify', authReceptionist, authorizePermission('view basic patient profile'), verifyPatientInsurance)
receptionistRouter.post('/book-appointment', authReceptionist, authorizePermission('create appointments'), bookAppointmentForPatient)
receptionistRouter.post('/check-in', authReceptionist, authorizePermission('update appointments'), checkInPatient)
receptionistRouter.post('/appointment-status', authReceptionist, authorizePermission('update appointments'), updateAppointmentStatus)
receptionistRouter.post('/home-visit-address', authReceptionist, authorizePermission('update appointments'), updateAppointmentHomeVisitAddress)
receptionistRouter.post('/payment', authReceptionist, authorizePermission('manage payment status'), updatePayment)
receptionistRouter.post('/doctor-locations', authReceptionist, authorizePermission('view doctors'), updateDoctorLocationsByReceptionist)

export default receptionistRouter
