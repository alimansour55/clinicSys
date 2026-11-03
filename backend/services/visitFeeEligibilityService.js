import appointmentModel from '../models/appointmentModel.js'
import { slotStartDate } from './clinicTimeService.js'

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

/** When the examination actually finished. `date` is when it was booked, up to a month earlier. */
const examinationFinishedAt = (appointment) => Number(appointment.statusUpdatedAt || appointment.date || 0)

/**
 * Follow-up consultation allowed within 30 days of a completed examination with the same doctor.
 * With a slotDate, the follow-up visit itself must fall inside that window, not just the booking.
 */
export const patientCanBookConsultation = async (userId, docId, { slotDate = '', now = Date.now() } = {}) => {
  if (!userId || !docId) {
    return { allowed: false, lastExaminationAt: null, consultationUntil: null }
  }

  const appointments = await appointmentModel
    .find({
      userId: String(userId),
      docId: String(docId),
      cancelled: { $ne: true },
      appointmentStatus: { $ne: 'Cancelled' }
    })
    .select('visitFeeType isCompleted appointmentStatus date statusUpdatedAt')
    .sort({ date: -1 })
    .lean()

  const examinations = appointments
    .filter(isQualifyingExamination)
    .sort((a, b) => examinationFinishedAt(b) - examinationFinishedAt(a))
  const lastExamination = examinations[0]
  const lastExaminationAt = lastExamination ? examinationFinishedAt(lastExamination) : null
  const consultationUntil = lastExaminationAt === null ? null : lastExaminationAt + THIRTY_DAYS_MS

  const visitAt = slotDate ? slotStartDate(slotDate, '00:00')?.getTime() ?? now : now
  return {
    allowed: consultationUntil !== null && consultationUntil >= now && consultationUntil >= visitAt,
    lastExaminationAt,
    consultationUntil
  }
}
