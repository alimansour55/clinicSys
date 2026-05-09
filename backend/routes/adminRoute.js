import express from 'express'
import { addDoctor, allDoctors, loginAdmin, appointmentsAdmin, appointmentCancel, adminDashboard, allAppointmentHistory, deleteAppointmentHistory, deleteProfile, updateDoctorByAdmin, addReceptionist, allReceptionists, changeReceptionistStatus, allPatients, patientDetails, changePatientStatus, deletePatientProfile } from '../controllers/adminController.js'
import upload from '../middlewares/multer.js'
import authAdmin from '../middlewares/authAdmin.js'
import { changeAvailability } from '../controllers/doctorController.js'
import { authorizePermission } from '../middlewares/rbac.js'
import { getAuditLogs } from '../controllers/auditLogController.js'
import { assignDoctorsToClinic, createClinic, deleteClinic, getClinics, updateClinic } from '../controllers/clinicController.js'
import { getPublicSiteSettings, updateHomeHeroSettings } from '../controllers/siteSettingController.js'

const adminRouter = express.Router()

adminRouter.post('/add-doctor', authAdmin, authorizePermission('manage doctors'), upload.single('image'), addDoctor)
adminRouter.post('/update-doctor', authAdmin, authorizePermission('manage doctors'), upload.single('image'), updateDoctorByAdmin)
adminRouter.post('/login', loginAdmin)
adminRouter.post('/all-doctors', authAdmin, authorizePermission('view all profiles'), allDoctors )
adminRouter.get('/patients', authAdmin, authorizePermission('view all profiles'), allPatients)
adminRouter.get('/patients/:patientId', authAdmin, authorizePermission('view all profiles'), patientDetails)
adminRouter.post('/change-patient-status', authAdmin, authorizePermission('manage users'), changePatientStatus)
adminRouter.post('/delete-patient', authAdmin, authorizePermission('delete profiles'), deletePatientProfile)
adminRouter.post('/change-availability', authAdmin, authorizePermission('manage doctors'), changeAvailability)
adminRouter.post('/add-receptionist', authAdmin, authorizePermission('manage receptionists'), addReceptionist)
adminRouter.get('/receptionists', authAdmin, authorizePermission('view all profiles'), allReceptionists)
adminRouter.post('/change-receptionist-status', authAdmin, authorizePermission('manage receptionists'), changeReceptionistStatus)
adminRouter.get('/appointments', authAdmin, authorizePermission('manage appointments'), appointmentsAdmin)
adminRouter.get('/appointment-history', authAdmin, authorizePermission('manage medical history'), allAppointmentHistory)
adminRouter.post('/delete-appointment-history', authAdmin, authorizePermission('manage medical history'), deleteAppointmentHistory)  
adminRouter.post('/delete-profile', authAdmin, authorizePermission('delete profiles'), deleteProfile)
adminRouter.get('/audit-logs', authAdmin, authorizePermission('view audit logs'), getAuditLogs)
adminRouter.get('/clinics', authAdmin, authorizePermission('manage clinics'), getClinics)
adminRouter.post('/create-clinic', authAdmin, authorizePermission('manage clinics'), createClinic)
adminRouter.post('/update-clinic', authAdmin, authorizePermission('manage clinics'), updateClinic)
adminRouter.post('/delete-clinic', authAdmin, authorizePermission('manage clinics'), deleteClinic)
adminRouter.post('/assign-clinic-doctors', authAdmin, authorizePermission('manage clinics'), assignDoctorsToClinic)
adminRouter.get('/site-settings', authAdmin, authorizePermission('manage site content'), getPublicSiteSettings)
adminRouter.post('/site-settings/home-hero', authAdmin, authorizePermission('manage site content'), upload.fields([{ name: 'heroImage', maxCount: 1 }, { name: 'groupImage', maxCount: 1 }]), updateHomeHeroSettings)
adminRouter.post('/cancel-appointment', authAdmin, authorizePermission('manage appointments'), appointmentCancel)
adminRouter.get('/dashboard', authAdmin, adminDashboard)

export default adminRouter
