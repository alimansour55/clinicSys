import express from 'express'
import {
  bookAppointmentForPatient,
  checkInPatient,
  createPatientForReceptionist,
  loginReceptionist,
  receptionistAppointments,
  receptionistDashboard,
  receptionistDoctors,
  receptionistPatients,
  updateAppointmentHomeVisitAddress,
  updateAppointmentStatus,
  updatePatientInsurance,
  updateDoctorLocationsByReceptionist,
  updatePayment
} from '../controllers/receptionistController.js'
import authReceptionist from '../middlewares/authReceptionist.js'
import { authorizePermission } from '../middlewares/rbac.js'
import upload from '../middlewares/multer.js'
import { getDoctorRatings } from '../controllers/ratingController.js'

const receptionistRouter = express.Router()

const optionalUpload = (fieldName) => (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.single(fieldName)(req, res, next)
  }
  return next()
}

receptionistRouter.post('/login', loginReceptionist)
receptionistRouter.get('/dashboard', authReceptionist, receptionistDashboard)
receptionistRouter.get('/appointments', authReceptionist, authorizePermission('update appointments'), receptionistAppointments)
receptionistRouter.get('/doctors', authReceptionist, authorizePermission('view doctors'), receptionistDoctors)
receptionistRouter.get('/doctor-ratings/:docId', authReceptionist, authorizePermission('view doctors'), getDoctorRatings)
receptionistRouter.get('/patients', authReceptionist, authorizePermission('view basic patient profile'), receptionistPatients)
receptionistRouter.post('/patients', authReceptionist, authorizePermission('create appointments'), optionalUpload('insuranceCardPhoto'), createPatientForReceptionist)
receptionistRouter.post('/patient-insurance', authReceptionist, authorizePermission('view basic patient profile'), optionalUpload('insuranceCardPhoto'), updatePatientInsurance)
receptionistRouter.post('/book-appointment', authReceptionist, authorizePermission('create appointments'), bookAppointmentForPatient)
receptionistRouter.post('/check-in', authReceptionist, authorizePermission('update appointments'), checkInPatient)
receptionistRouter.post('/appointment-status', authReceptionist, authorizePermission('update appointments'), updateAppointmentStatus)
receptionistRouter.post('/home-visit-address', authReceptionist, authorizePermission('update appointments'), updateAppointmentHomeVisitAddress)
receptionistRouter.post('/payment', authReceptionist, authorizePermission('manage payment status'), updatePayment)
receptionistRouter.post('/doctor-locations', authReceptionist, authorizePermission('view doctors'), updateDoctorLocationsByReceptionist)

export default receptionistRouter
