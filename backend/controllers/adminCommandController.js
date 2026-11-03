import mongoose from 'mongoose'
import appointmentModel from '../models/appointmentModel.js'
import auditLogModel from '../models/auditLogModel.js'
import clinicModel from '../models/clinicModel.js'
import doctorModel from '../models/doctorModel.js'
import receptionistModel from '../models/receptionistModel.js'
import userModel from '../models/userModel.js'
import { logAudit } from '../services/auditService.js'
import { buildCommandCenter } from '../services/adminInsightsService.js'
import { countPendingBilingual } from '../services/bilingualContentService.js'
import { BILINGUAL_MODELS } from '../services/bilingualRegistry.js'
import { getSecuritySettings } from '../services/securityPolicyService.js'
import { notifyPatientAccountStatus } from '../services/notificationService.js'
import { cancelOneAppointment } from './adminController.js'

const BULK_LIMIT = 200
const SEARCH_LIMIT = 6
const DAY_MS = 24 * 60 * 60 * 1000

const APPOINTMENT_FIELDS =
  'docId slotDate slotTime date amount paidAt cancelled isCompleted appointmentStatus appointmentType paymentStatus paymentMethod refundStatus bookedBy reservationNumber userData.name docData.name docData.image docData.speciality docData.i18n.name'

const getCommandCenter = async (req, res) => {
  try {
    const now = Date.now()
    const [appointments, doctors, users, activity, failedLogins, pendingCounts, security] = await Promise.all([
      appointmentModel.find({}).select(APPOINTMENT_FIELDS).lean(),
      doctorModel.find({}).select('name i18n.name i18n.speciality image speciality available clinics').lean(),
      userModel.find({}).select('isActive insurance.enabled insurance.verificationStatus').lean(),
      auditLogModel
        .find({})
        .select('action status actorRole entityType reason metadata.doctorName metadata.patientName metadata.userName metadata.clinicName createdAt')
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      auditLogModel.countDocuments({ action: 'login_failed', createdAt: { $gte: new Date(now - DAY_MS) } }),
      Promise.all(BILINGUAL_MODELS.map(({ model, fields }) => countPendingBilingual(model, fields))),
      getSecuritySettings()
    ])

    res.json({
      success: true,
      commandCenter: buildCommandCenter({
        now,
        appointments,
        doctors,
        users,
        activity,
        failedLogins,
        pendingTranslations: pendingCounts.reduce((sum, count) => sum + count, 0),
        adminMfaOn: Boolean(security.adminMfa?.enabled && security.adminMfa?.secret)
      })
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Results for the command palette. Only what a result row shows, so no record is exposed whole. */
const globalSearch = async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : ''
    if (query.length < 2) {
      return res.json({ success: true, results: { doctors: [], patients: [], receptionists: [], clinics: [], appointments: [] } })
    }
    const match = { $regex: escapeRegex(query), $options: 'i' }

    const [doctors, patients, receptionists, clinics, appointments] = await Promise.all([
      doctorModel
        .find({ $or: [{ name: match }, { 'i18n.name.ar': match }, { 'i18n.name.en': match }, { email: match }, { speciality: match }, { phone: match }] })
        .select('name i18n.name image speciality available')
        .limit(SEARCH_LIMIT)
        .lean(),
      userModel
        .find({ $or: [{ name: match }, { email: match }, { phone: match }, { patientId: match }] })
        .select('name email patientId image')
        .limit(SEARCH_LIMIT)
        .lean(),
      receptionistModel
        .find({ $or: [{ name: match }, { 'i18n.name.ar': match }, { 'i18n.name.en': match }, { email: match }, { phone: match }] })
        .select('name i18n image email')
        .limit(SEARCH_LIMIT)
        .lean(),
      clinicModel
        .find({ $or: [{ name: match }, { 'i18n.name.ar': match }, { 'i18n.name.en': match }] })
        .select('name i18n.name')
        .limit(SEARCH_LIMIT)
        .lean(),
      appointmentModel
        .find({ $or: [{ reservationNumber: match }, { 'userData.name': match }, { 'docData.name': match }] })
        .select('reservationNumber slotDate slotTime userData.name docData.name docData.i18n.name appointmentStatus cancelled isCompleted')
        .sort({ date: -1 })
        .limit(SEARCH_LIMIT)
        .lean()
    ])

    res.json({ success: true, results: { doctors, patients, receptionists, clinics, appointments } })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const readIds = (ids) => [
  ...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string' && mongoose.isValidObjectId(id)))
]

const USER_MODELS = { patient: userModel, receptionist: receptionistModel, doctor: doctorModel }

/** `[{ profileType, profileId }]` as `{ patient: [ids], doctor: [ids], receptionist: [ids] }`. */
const readUsersByType = (users) => {
  const grouped = { patient: [], doctor: [], receptionist: [] }
  if (!Array.isArray(users)) return grouped
  users.forEach((user) => {
    if (grouped[user?.profileType] && typeof user.profileId === 'string' && mongoose.isValidObjectId(user.profileId)) {
      grouped[user.profileType].push(user.profileId)
    }
  })
  return grouped
}

const tooMany = (res) => res.json({ success: false, message: `Choose ${BULK_LIMIT} records or fewer` })
const nothingChosen = (res) => res.json({ success: false, message: 'Nothing was selected' })

const bulkDoctorAvailability = async (req, res) => {
  try {
    const doctorIds = readIds(req.body.doctorIds)
    if (!doctorIds.length) return nothingChosen(res)
    if (doctorIds.length > BULK_LIMIT) return tooMany(res)
    const available = req.body.available === true || req.body.available === 'true'

    const result = await doctorModel.updateMany({ _id: { $in: doctorIds } }, { $set: { available } })

    await logAudit({
      action: 'doctor_availability_bulk_update',
      status: 'success',
      entityType: 'doctor',
      metadata: { doctorIds, available, updated: result.modifiedCount },
      req
    })

    res.json({ success: true, updated: result.modifiedCount, message: 'Availability updated' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

/** A doctor's account has no on/off switch of its own: `available` is what the directory shows. */
const bulkUserStatus = async (req, res) => {
  try {
    const grouped = readUsersByType(req.body.users)
    const total = grouped.patient.length + grouped.doctor.length + grouped.receptionist.length
    if (!total) return nothingChosen(res)
    if (total > BULK_LIMIT) return tooMany(res)
    const active = req.body.active === true || req.body.active === 'true'

    const results = await Promise.all([
      userModel.updateMany(
        { _id: { $in: grouped.patient } },
        { $set: { isActive: active, deactivatedAt: active ? 0 : Date.now() } }
      ),
      receptionistModel.updateMany({ _id: { $in: grouped.receptionist } }, { $set: { isActive: active } }),
      doctorModel.updateMany({ _id: { $in: grouped.doctor } }, { $set: { available: active } })
    ])
    grouped.patient.forEach((patientId) => notifyPatientAccountStatus({ patientId, isActive: active }))

    const updated = results.reduce((sum, result) => sum + result.modifiedCount, 0)
    await logAudit({
      action: 'user_status_bulk_update',
      status: 'success',
      entityType: 'user',
      metadata: { ...grouped, active, updated },
      req
    })

    res.json({ success: true, updated, message: 'Accounts updated' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const bulkUserMfa = async (req, res) => {
  try {
    const grouped = readUsersByType(req.body.users)
    const total = grouped.patient.length + grouped.doctor.length + grouped.receptionist.length
    if (!total) return nothingChosen(res)
    if (total > BULK_LIMIT) return tooMany(res)
    const requiredByAdmin = req.body.requiredByAdmin === true || req.body.requiredByAdmin === 'true'

    const results = await Promise.all(
      Object.entries(grouped).map(([type, ids]) =>
        USER_MODELS[type].updateMany({ _id: { $in: ids } }, { $set: { 'mfa.requiredByAdmin': requiredByAdmin } })
      )
    )
    const updated = results.reduce((sum, result) => sum + result.modifiedCount, 0)

    await logAudit({
      action: 'user_mfa_requirement_bulk_update',
      status: 'success',
      entityType: 'user',
      metadata: { ...grouped, requiredByAdmin, updated },
      req
    })

    res.json({ success: true, updated, message: 'MFA requirement updated' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

/** One at a time, because each can issue a refund. Reports what could not be cancelled and why. */
const bulkCancelAppointments = async (req, res) => {
  try {
    const appointmentIds = readIds(req.body.appointmentIds)
    if (!appointmentIds.length) return nothingChosen(res)
    if (appointmentIds.length > BULK_LIMIT) return tooMany(res)

    let cancelled = 0
    const failed = []
    for (const appointmentId of appointmentIds) {
      try {
        const result = await cancelOneAppointment(appointmentId, req)
        if (result.success) cancelled += 1
        else failed.push({ appointmentId, message: result.message })
      } catch (error) {
        failed.push({ appointmentId, message: error.message })
      }
    }

    res.json({ success: true, cancelled, failed, message: 'Appointments cancelled' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export { getCommandCenter, globalSearch, bulkDoctorAvailability, bulkUserStatus, bulkUserMfa, bulkCancelAppointments }
