import express from 'express'
import { appointmentCancel, appointmentComplete, appointmentsDoctor, doctordashboard, doctorList, doctorProfile, editPrescription, loginDoctor, patienthistory, updateDoctorprofile, updatePatientMedicalHistory } from '../controllers/doctorController.js'
import authDoctor from '../middlewares/authDoctor.js'
import { authorizePermission } from '../middlewares/rbac.js'
import { getPublicClinics } from '../controllers/clinicController.js'

const doctorRouter = express.Router()

doctorRouter.get('/list', doctorList)
doctorRouter.get('/clinics', getPublicClinics)
doctorRouter.post('/login', loginDoctor)
doctorRouter.get('/appointments', authDoctor, authorizePermission('view assigned patients'), appointmentsDoctor)
doctorRouter.post('/complete-appointment', authDoctor, authorizePermission('edit prescriptions'), appointmentComplete)
doctorRouter.post('/cancel-appointment', authDoctor, authorizePermission('manage appointments'), appointmentCancel)
doctorRouter.get('/patient-history', authDoctor, authorizePermission('view medical history'), patienthistory )
doctorRouter.post('/edit-prescription', authDoctor, authorizePermission('edit prescriptions'), editPrescription)
doctorRouter.post('/patient-medical-history', authDoctor, authorizePermission('edit medical history'), updatePatientMedicalHistory)
doctorRouter.get('/dashboard', authDoctor, doctordashboard)
doctorRouter.get('/profile', authDoctor, authorizePermission('view own profile'), doctorProfile)
doctorRouter.post('/update-profile', authDoctor, authorizePermission('update own profile'), updateDoctorprofile)



export default doctorRouter
