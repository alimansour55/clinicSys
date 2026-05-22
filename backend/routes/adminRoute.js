import express from 'express'
import { addDoctor, allDoctors, loginAdmin, verifyAdminMfaLogin, completeAdminMfaLoginSetup, getAdminProfile, updateAdminProfile, getAdminMfaStatus, startAdminMfaSetup, enableAdminMfa, disableAdminMfa, appointmentsAdmin, appointmentCancel, adminDashboard, allAppointmentHistory, deleteAppointmentHistory, deleteProfile, updateDoctorByAdmin, addReceptionist, allReceptionists, changeReceptionistStatus, receptionistProfileByAdmin, updateReceptionistByAdmin, allPatients, allUsers, createUserByAdmin, updateUserByAdmin, resetUserPassword, updateUserMfaRequirement, resetUserMfa, deleteUserAccount, patientDetails, changePatientStatus, deletePatientProfile, adminFinancialAnalytics } from '../controllers/adminController.js'
import upload from '../middlewares/multer.js'
import authAdmin from '../middlewares/authAdmin.js'
import { changeAvailability } from '../controllers/doctorController.js'
import { authorizePermission } from '../middlewares/rbac.js'
import { getAuditLogs } from '../controllers/auditLogController.js'
import { assignDoctorsToClinic, createClinic, deleteClinic, getClinics, updateClinic } from '../controllers/clinicController.js'
import { getPublicSiteSettings, updateBrandingLogo, updateFooterSettings, updateHomeBannerSettings, updateHomeHeroSettings, updateHomeServiceCardsSettings, updateGlobalVisitFeesSettings, updateHomeVisitPricingSettings, updateInsuranceProviders, updateLanguagePoliciesSettings, updateSecuritySettings } from '../controllers/siteSettingController.js'
import { deleteRating, getAllDoctorRatings, getDoctorRatings } from '../controllers/ratingController.js'

const adminRouter = express.Router()

const optionalReceptionistImage = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.single('image')(req, res, next)
  }
  return next()
}

const optionalHeaderLogo = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.single('headerLogo')(req, res, next)
  }
  return next()
}

adminRouter.post('/add-doctor', authAdmin, authorizePermission('manage doctors'), upload.single('image'), addDoctor)
adminRouter.post('/update-doctor', authAdmin, authorizePermission('manage doctors'), upload.single('image'), updateDoctorByAdmin)
adminRouter.post('/login', loginAdmin)
adminRouter.post('/mfa/verify-login', verifyAdminMfaLogin)
adminRouter.post('/mfa/complete-login-setup', completeAdminMfaLoginSetup)
adminRouter.get('/profile', authAdmin, getAdminProfile)
adminRouter.post('/update-profile', authAdmin, upload.single('image'), updateAdminProfile)
adminRouter.get('/mfa/status', authAdmin, getAdminMfaStatus)
adminRouter.post('/mfa/setup', authAdmin, startAdminMfaSetup)
adminRouter.post('/mfa/enable', authAdmin, enableAdminMfa)
adminRouter.post('/mfa/disable', authAdmin, disableAdminMfa)
adminRouter.post('/all-doctors', authAdmin, authorizePermission('view all profiles'), allDoctors )
adminRouter.get('/users', authAdmin, authorizePermission('view all profiles'), allUsers)
adminRouter.post('/create-user', authAdmin, authorizePermission('manage users'), createUserByAdmin)
adminRouter.post('/update-user', authAdmin, authorizePermission('manage users'), updateUserByAdmin)
adminRouter.post('/reset-user-password', authAdmin, authorizePermission('manage users'), resetUserPassword)
adminRouter.post('/update-user-mfa-requirement', authAdmin, authorizePermission('manage users'), updateUserMfaRequirement)
adminRouter.post('/reset-user-mfa', authAdmin, authorizePermission('manage users'), resetUserMfa)
adminRouter.post('/delete-user-account', authAdmin, authorizePermission('delete profiles'), deleteUserAccount)
adminRouter.get('/patients', authAdmin, authorizePermission('view all profiles'), allPatients)
adminRouter.get('/patients/:patientId', authAdmin, authorizePermission('view all profiles'), patientDetails)
adminRouter.post('/change-patient-status', authAdmin, authorizePermission('manage users'), changePatientStatus)
adminRouter.post('/delete-patient', authAdmin, authorizePermission('delete profiles'), deletePatientProfile)
adminRouter.post('/change-availability', authAdmin, authorizePermission('manage doctors'), changeAvailability)
adminRouter.post('/add-receptionist', authAdmin, authorizePermission('manage receptionists'), optionalReceptionistImage, addReceptionist)
adminRouter.get('/receptionists', authAdmin, authorizePermission('view all profiles'), allReceptionists)
adminRouter.get('/receptionist/:receptionistId', authAdmin, authorizePermission('view all profiles'), receptionistProfileByAdmin)
adminRouter.post('/update-receptionist', authAdmin, authorizePermission('manage receptionists'), optionalReceptionistImage, updateReceptionistByAdmin)
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
adminRouter.post('/site-settings/branding', authAdmin, authorizePermission('manage site content'), optionalHeaderLogo, updateBrandingLogo)
adminRouter.post('/site-settings/home-hero', authAdmin, authorizePermission('manage site content'), upload.fields([{ name: 'heroImage', maxCount: 1 }, { name: 'groupImage', maxCount: 1 }]), updateHomeHeroSettings)
adminRouter.post('/site-settings/home-banner', authAdmin, authorizePermission('manage site content'), upload.fields([{ name: 'bannerImage', maxCount: 1 }]), updateHomeBannerSettings)
adminRouter.post('/site-settings/home-service-cards', authAdmin, authorizePermission('manage site content'), upload.fields([{ name: 'teleconsultationImage', maxCount: 1 }, { name: 'homeVisitImage', maxCount: 1 }]), updateHomeServiceCardsSettings)
adminRouter.post('/site-settings/footer', authAdmin, authorizePermission('manage site content'), updateFooterSettings)
adminRouter.post('/site-settings/insurance-providers', authAdmin, authorizePermission('manage site content'), updateInsuranceProviders)
adminRouter.post('/site-settings/security', authAdmin, authorizePermission('view audit logs'), updateSecuritySettings)
adminRouter.post('/site-settings/home-visit-pricing', authAdmin, authorizePermission('manage site content'), updateHomeVisitPricingSettings)
adminRouter.post('/site-settings/global-visit-fees', authAdmin, authorizePermission('manage site content'), updateGlobalVisitFeesSettings)
adminRouter.post('/site-settings/language-policies', authAdmin, authorizePermission('manage site content'), updateLanguagePoliciesSettings)
adminRouter.post('/cancel-appointment', authAdmin, authorizePermission('manage appointments'), appointmentCancel)
adminRouter.get('/ratings', authAdmin, authorizePermission('manage doctors'), getAllDoctorRatings)
adminRouter.get('/doctor-ratings/:docId', authAdmin, authorizePermission('manage doctors'), getDoctorRatings)
adminRouter.post('/delete-rating', authAdmin, authorizePermission('manage doctors'), deleteRating)
adminRouter.get('/dashboard', authAdmin, adminDashboard)
adminRouter.get('/financial-analytics', authAdmin, authorizePermission('manage doctors'), adminFinancialAnalytics)

export default adminRouter
