import appointmentModel from '../models/appointmentModel.js'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

const isExaminationVisit = (appointment) => {
  const type = String(appointment?.visitFeeType || '').trim().toLowerCase()
  return !type || type === 'examination'
}

const isQualifyingExamination = (appointment) => {
  if (!appointment || appointment.cancelled === true) return false
  if (appointment.appointmentStatus === 'Cancelled') return false
  if (!isExaminationVisit(appointment)) return false
  return appointment.isCompleted === true || appointment.appointmentStatus === 'Finished'
}

/** Follow-up consultation allowed within 30 days of a completed examination with the same doctor. */
export const patientCanBookConsultation = async (userId, docId) => {
  if (!userId || !docId) {
    return { allowed: false, lastExaminationAt: null }
  }

  const cutoff = Date.now() - THIRTY_DAYS_MS
  const recentAppointments = await appointmentModel
    .find({
      userId: String(userId),
      docId: String(docId),
      date: { $gte: cutoff },
      cancelled: { $ne: true },
      appointmentStatus: { $ne: 'Cancelled' }
    })
    .select('visitFeeType isCompleted appointmentStatus date')
    .sort({ date: -1 })
    .lean()

  const lastExamination = recentAppointments.find(isQualifyingExamination)
  return {
    allowed: Boolean(lastExamination),
    lastExaminationAt: lastExamination?.date || null
  }
}
