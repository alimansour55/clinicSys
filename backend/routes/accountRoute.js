import express from 'express'
import authUser from '../middlewares/authUser.js'
import { insuranceCardUpload, profilePhotoUpload } from '../middlewares/patientUpload.js'
import { authorizePermission } from '../middlewares/rbac.js'
import { clientIp, consumeQuota } from '../services/authThrottleService.js'
import {
  changePassword,
  completeMfaLoginSetup,
  disableMfa,
  enableMfa,
  getMfaStatus,
  getPasswordPolicy,
  loginPatient,
  regenerateRecoveryCodes,
  registerPatient,
  resetPatientPassword,
  sendResetOtp,
  signOutEverywhere,
  startMfaSetup,
  verifyMfaLogin,
  verifyResetOtp
} from '../controllers/patientAuthController.js'
import {
  confirmPhoneVerification,
  getMedicalHistory,
  getProfile,
  saveMedicalHistory,
  sendPhoneVerification,
  updateEmergencyProfile,
  updateInsurance,
  updateOnboarding,
  updateProfile
} from '../controllers/patientProfileController.js'
import {
  createEntry,
  createFamilyMember,
  createReminder,
  deleteEntry,
  deleteFamilyMember,
  deleteReminder,
  exportMyData,
  getHub,
  getSecurityActivity,
  getTimeline,
  listEntries,
  listFamily,
  listReminders,
  respondToReminder,
  syncReminders,
  updateFamilyMember,
  updateReminder
} from '../controllers/healthHubController.js'

const HOUR = 60 * 60 * 1000

/** Limits an unauthenticated route that accepts a file, before the file is read. */
const limitByIp = (scope, max) => async (req, res, next) => {
  try {
    if (await consumeQuota(scope, clientIp(req), { max, windowMs: HOUR })) return next()
    return res.json({ success: false, message: 'Too many requests. Please try again later.' })
  } catch (error) {
    console.error('Rate limit check:', error.message)
    return res.status(503).json({ success: false, message: 'Please try again in a moment.' })
  }
}

const canViewProfile = authorizePermission('view own profile')
const canUpdateProfile = authorizePermission('update own basic profile')
const canViewHistory = authorizePermission('view own medical history')
const canUpdateHistory = authorizePermission('update own medical history')

/**
 * The patient account routes of /api/user. Mounted ahead of userRouter, so these answer first.
 * userController.js and userRoute.js belong to another session this round; the shadowed handlers there
 * are now unreachable and are listed for removal in the integration requests.
 */
export const patientAuthRouter = express.Router()

patientAuthRouter.post('/register', limitByIp('register-ip', 30), insuranceCardUpload, registerPatient)
patientAuthRouter.post('/login', loginPatient)
patientAuthRouter.post('/mfa/verify-login', verifyMfaLogin)
patientAuthRouter.post('/mfa/complete-login-setup', completeMfaLoginSetup)
patientAuthRouter.post('/send-reset-otp', sendResetOtp)
patientAuthRouter.post('/verify-reset-otp', verifyResetOtp)
patientAuthRouter.post('/reset-password', resetPatientPassword)

patientAuthRouter.get('/get-profile', authUser, canViewProfile, getProfile)
// Authenticate before reading any file, so strangers cannot write to the server's disk.
patientAuthRouter.post('/update-profile', authUser, canUpdateProfile, profilePhotoUpload, updateProfile)
patientAuthRouter.post('/insurance', authUser, canUpdateProfile, insuranceCardUpload, updateInsurance)
patientAuthRouter.post('/update-insurance', authUser, canUpdateProfile, insuranceCardUpload, updateInsurance)
patientAuthRouter.get('/mfa/status', authUser, canViewProfile, getMfaStatus)
patientAuthRouter.post('/mfa/setup', authUser, canUpdateProfile, startMfaSetup)
patientAuthRouter.post('/mfa/enable', authUser, canUpdateProfile, enableMfa)
patientAuthRouter.post('/mfa/disable', authUser, canUpdateProfile, disableMfa)
patientAuthRouter.get('/medical-history', authUser, canViewHistory, getMedicalHistory)
patientAuthRouter.post('/medical-history', authUser, canUpdateHistory, saveMedicalHistory)
patientAuthRouter.put('/medical-history', authUser, canUpdateHistory, saveMedicalHistory)

/** New patient hub endpoints, under /api/account. */
const accountRouter = express.Router()

accountRouter.get('/password-policy', getPasswordPolicy)

accountRouter.get('/hub', authUser, canViewHistory, getHub)
accountRouter.get('/timeline', authUser, canViewHistory, getTimeline)

accountRouter.get('/family', authUser, canViewHistory, listFamily)
accountRouter.post('/family', authUser, canUpdateHistory, createFamilyMember)
accountRouter.put('/family/:id', authUser, canUpdateHistory, updateFamilyMember)
accountRouter.delete('/family/:id', authUser, canUpdateHistory, deleteFamilyMember)

accountRouter.get('/entries', authUser, canViewHistory, listEntries)
accountRouter.post('/entries', authUser, canUpdateHistory, createEntry)
accountRouter.delete('/entries/:id', authUser, canUpdateHistory, deleteEntry)

accountRouter.get('/reminders', authUser, canViewHistory, listReminders)
accountRouter.post('/reminders', authUser, canUpdateHistory, createReminder)
accountRouter.post('/reminders/sync', authUser, canViewHistory, syncReminders)
accountRouter.put('/reminders/:id', authUser, canUpdateHistory, updateReminder)
accountRouter.post('/reminders/:id/respond', authUser, canUpdateHistory, respondToReminder)
accountRouter.delete('/reminders/:id', authUser, canUpdateHistory, deleteReminder)

accountRouter.put('/emergency', authUser, canUpdateHistory, updateEmergencyProfile)
accountRouter.post('/onboarding', authUser, canUpdateProfile, updateOnboarding)

accountRouter.post('/phone/send', authUser, canUpdateProfile, sendPhoneVerification)
accountRouter.post('/phone/confirm', authUser, canUpdateProfile, confirmPhoneVerification)
accountRouter.post('/change-password', authUser, canUpdateProfile, changePassword)
accountRouter.post('/sign-out-everywhere', authUser, canUpdateProfile, signOutEverywhere)
accountRouter.post('/mfa/recovery-codes', authUser, canUpdateProfile, regenerateRecoveryCodes)
accountRouter.get('/security/activity', authUser, canViewProfile, getSecurityActivity)
accountRouter.get('/export', authUser, canViewHistory, exportMyData)

export default accountRouter
