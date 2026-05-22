import notificationModel from '../models/notificationModel.js'
import receptionistModel from '../models/receptionistModel.js'
import {
  sendAppointmentEmailsOnBook,
  sendInvoiceEmail
} from './appointmentEmailService.js'

export const getAdminRecipientId = () => String(process.env.ADMIN_EMAIL || 'admin')

export const isPaidPaymentStatus = (value) => String(value ?? '').trim().toLowerCase() === 'paid'

export function resolveAppointmentPatientUserId(appointment) {
  if (!appointment || typeof appointment !== 'object') return ''
  const direct = appointment.userId
  if (direct != null && String(direct).trim() !== '') return String(direct).trim()
  const ud = appointment.userData
  if (ud && typeof ud === 'object') {
    if (ud.userId != null && String(ud.userId).trim() !== '') return String(ud.userId).trim()
    if (ud._id != null && String(ud._id).trim() !== '') return String(ud._id).trim()
    if (ud.id != null && String(ud.id).trim() !== '') return String(ud.id).trim()
  }
  return ''
}

export async function pushNotification(payload) {
  const { recipientRole, recipientId, title, message, type = 'general', meta = {}, i18n } = payload
  if (!recipientRole || recipientId === undefined || recipientId === null) return
  const rid = String(recipientId).trim()
  if (!rid) return
  const baseMeta = typeof meta === 'object' && meta !== null ? { ...meta } : {}
  if (i18n && typeof i18n === 'object' && i18n.templateId) {
    baseMeta.i18n = {
      templateId: String(i18n.templateId).slice(0, 120),
      params: typeof i18n.params === 'object' && i18n.params !== null ? i18n.params : {}
    }
  }
  try {
    await notificationModel.create({
      recipientRole,
      recipientId: rid,
      title: String(title || 'Notice').slice(0, 200),
      message: String(message || '').slice(0, 2000),
      type: String(type || 'general').slice(0, 64),
      meta: baseMeta,
      read: false
    })
  } catch (err) {
    console.error('pushNotification failed', err.message)
  }
}

export async function notifyAllReceptionists({ title, message, type, meta = {} }) {
  try {
    const rows = await receptionistModel.find({ isActive: { $ne: false } }).select('_id').lean()
    await Promise.all(
      rows.map((r) =>
        pushNotification({
          recipientRole: 'receptionist',
          recipientId: String(r._id),
          title,
          message,
          type,
          meta
        })
      )
    )
  } catch (e) {
    console.error('notifyAllReceptionists', e.message)
  }
}

function slotLabel(appointment) {
  const d = appointment?.slotDate || ''
  const t = appointment?.slotTime || ''
  return `${String(d).replace(/_/g, ' ')} · ${t}`
}

export function notifyAppointmentBooked({ appointment, bookedBy }) {
  const aptId = String(appointment._id)
  const patientName = appointment.userData?.name || 'Patient'
  const doctorName = appointment.docData?.name || 'Doctor'
  const when = slotLabel(appointment)

  void pushNotification({
    recipientRole: 'patient',
    recipientId: resolveAppointmentPatientUserId(appointment),
    title: 'Appointment confirmed',
    message:
      bookedBy === 'Receptionist'
        ? `A visit with Dr. ${doctorName} was scheduled for you (${when}).`
        : `Your visit with Dr. ${doctorName} is booked (${when}).`,
    type: 'appointment_booked',
    meta: { appointmentId: aptId, docId: appointment.docId },
    i18n: {
      templateId: bookedBy === 'Receptionist' ? 'patient_appt_booked_reception' : 'patient_appt_booked_self',
      params: { doctorName, when }
    }
  })

  void pushNotification({
    recipientRole: 'doctor',
    recipientId: appointment.docId,
    title: 'New appointment',
    message:
      bookedBy === 'Receptionist'
        ? `${patientName} was scheduled by reception (${when}).`
        : `${patientName} booked an appointment (${when}).`,
    type: 'appointment_booked',
    meta: { appointmentId: aptId, userId: appointment.userId }
  })

  void pushNotification({
    recipientRole: 'admin',
    recipientId: getAdminRecipientId(),
    title: 'New appointment',
    message: `${patientName} → Dr. ${doctorName} (${when}).`,
    type: 'appointment_booked',
    meta: { appointmentId: aptId }
  })

  if (bookedBy === 'Patient') {
    void notifyAllReceptionists({
      title: 'New patient booking',
      message: `${patientName} booked Dr. ${doctorName} (${when}).`,
      type: 'appointment_booked',
      meta: { appointmentId: aptId }
    })
  }

  void sendAppointmentEmailsOnBook(appointment)
}

export function notifyAppointmentCancelled({ appointment, cancelledBy }) {
  const aptId = String(appointment._id)
  const patientName = appointment.userData?.name || 'Patient'
  const doctorName = appointment.docData?.name || 'Doctor'
  const when = slotLabel(appointment)
  const by = cancelledBy === 'patient' ? 'Patient' : cancelledBy === 'doctor' ? 'Doctor' : cancelledBy === 'receptionist' ? 'Reception' : 'Admin'
  const byKey =
    cancelledBy === 'patient'
      ? 'patient'
      : cancelledBy === 'doctor'
        ? 'doctor'
        : cancelledBy === 'receptionist'
          ? 'receptionist'
          : 'admin'

  void pushNotification({
    recipientRole: 'patient',
    recipientId: resolveAppointmentPatientUserId(appointment),
    title: 'Appointment cancelled',
    message: `Your appointment with Dr. ${doctorName} (${when}) was cancelled (${by}).`,
    type: 'appointment_cancelled',
    meta: { appointmentId: aptId },
    i18n: {
      templateId: 'patient_appt_cancelled',
      params: { doctorName, when, byKey }
    }
  })

  void pushNotification({
    recipientRole: 'doctor',
    recipientId: appointment.docId,
    title: 'Appointment cancelled',
    message: `${patientName} — appointment (${when}) cancelled (${by}).`,
    type: 'appointment_cancelled',
    meta: { appointmentId: aptId }
  })

  void pushNotification({
    recipientRole: 'admin',
    recipientId: getAdminRecipientId(),
    title: 'Appointment cancelled',
    message: `${patientName} / Dr. ${doctorName} (${when}) — ${by}.`,
    type: 'appointment_cancelled',
    meta: { appointmentId: aptId }
  })

  void notifyAllReceptionists({
    title: 'Appointment cancelled',
    message: `${patientName} with Dr. ${doctorName} (${when}) was cancelled.`,
    type: 'appointment_cancelled',
    meta: { appointmentId: aptId }
  })
}

export function notifyAppointmentStatusChanged({ appointment, previousStatus, nextStatus }) {
  const aptId = String(appointment._id)
  const patientName = appointment.userData?.name || 'Patient'
  const doctorName = appointment.docData?.name || 'Doctor'
  const msg = `Status is now “${nextStatus}” (was ${previousStatus || '—'}).`

  void pushNotification({
    recipientRole: 'patient',
    recipientId: resolveAppointmentPatientUserId(appointment),
    title: 'Appointment updated',
    message: msg,
    type: 'appointment_status',
    meta: { appointmentId: aptId, appointmentStatus: nextStatus },
    i18n: {
      templateId: 'patient_appt_status',
      params: { nextStatus, previousStatus: previousStatus || '' }
    }
  })

  const doctorStatuses = ['Checked In', 'In Progress', 'Finished', 'Cancelled']
  if (doctorStatuses.includes(nextStatus)) {
    void pushNotification({
      recipientRole: 'doctor',
      recipientId: appointment.docId,
      title: 'Appointment status',
      message: `${patientName}: ${msg}`,
      type: 'appointment_status',
      meta: { appointmentId: aptId, appointmentStatus: nextStatus }
    })
  }

  if (nextStatus === 'Finished' || nextStatus === 'Cancelled') {
    void pushNotification({
      recipientRole: 'admin',
      recipientId: getAdminRecipientId(),
      title: 'Appointment update',
      message: `${patientName} / Dr. ${doctorName} — ${nextStatus}.`,
      type: 'appointment_status',
      meta: { appointmentId: aptId }
    })
  }
}

export async function notifyPaymentRecorded({ appointment, source = 'online' }) {
  const aptId = String(appointment._id)
  const patientUserId = resolveAppointmentPatientUserId(appointment)
  if (!patientUserId) {
    console.warn('notifyPaymentRecorded: missing patient user id on appointment', aptId)
  }
  const patientName = appointment.userData?.name || 'Patient'
  const doctorName = appointment.docData?.name || 'Doctor'
  const when = slotLabel(appointment)
  const src = source === 'receptionist' ? 'Front desk' : source === 'online' ? 'Online payment' : 'Payment'
  const sourceKey = source === 'receptionist' ? 'front_desk' : source === 'online' ? 'online' : 'other'

  await Promise.all([
    patientUserId
      ? pushNotification({
          recipientRole: 'patient',
          recipientId: patientUserId,
          title: 'Payment recorded',
          message: `${src}: your visit with Dr. ${doctorName} (${when}) is marked paid.`,
          type: 'payment_paid',
          meta: { appointmentId: aptId },
          i18n: {
            templateId: 'patient_payment_paid',
            params: { sourceKey, doctorName, when }
          }
        })
      : Promise.resolve(),
    appointment.docId
      ? pushNotification({
          recipientRole: 'doctor',
          recipientId: appointment.docId,
          title: 'Payment recorded',
          message: `${patientName} (${when}) — paid (${src}).`,
          type: 'payment_paid',
          meta: { appointmentId: aptId }
        })
      : Promise.resolve(),
    pushNotification({
      recipientRole: 'admin',
      recipientId: getAdminRecipientId(),
      title: 'Payment recorded',
      message: `${patientName} / Dr. ${doctorName} (${when}) — paid.`,
      type: 'payment_paid',
      meta: { appointmentId: aptId }
    })
  ])

  void sendInvoiceEmail(appointment)
}

export function notifyVisitCompletedWithPrescription({ appointment }) {
  const aptId = String(appointment._id)
  const doctorName = appointment.docData?.name || 'Doctor'
  const when = slotLabel(appointment)

  void pushNotification({
    recipientRole: 'patient',
    recipientId: resolveAppointmentPatientUserId(appointment),
    title: 'Visit completed',
    message: `Your visit with Dr. ${doctorName} (${when}) is finished. Your prescription is available in My Appointments.`,
    type: 'visit_completed',
    meta: { appointmentId: aptId },
    i18n: {
      templateId: 'patient_visit_completed',
      params: { doctorName, when }
    }
  })

  void pushNotification({
    recipientRole: 'admin',
    recipientId: getAdminRecipientId(),
    title: 'Visit completed',
    message: `Dr. ${doctorName} completed a visit (${when}).`,
    type: 'visit_completed',
    meta: { appointmentId: aptId }
  })
}

export function notifyNewPatientRating({ docId, patientName, rating, appointmentId }) {
  void pushNotification({
    recipientRole: 'doctor',
    recipientId: docId,
    title: 'New patient rating',
    message: `${patientName || 'A patient'} rated you ${rating}/5.`,
    type: 'new_rating',
    meta: { appointmentId: String(appointmentId || '') }
  })
}

export function notifyProfileUpdatedByAdmin({ recipientRole, recipientId, detail = '' }) {
  const detailTrim = String(detail || '').trim()
  const title = 'Profile updated'
  const message = detailTrim || 'An administrator updated your profile.'
  const base = {
    recipientRole,
    recipientId: String(recipientId),
    title,
    message,
    type: 'profile_updated_admin',
    meta: {}
  }
  if (recipientRole === 'patient') {
    if (detailTrim) {
      void pushNotification({
        ...base,
        i18n: { templateId: 'patient_profile_admin_detail', params: { detail: detailTrim } }
      })
      return
    }
    void pushNotification({
      ...base,
      i18n: { templateId: 'patient_profile_admin_generic', params: {} }
    })
    return
  }
  void pushNotification(base)
}

export function notifyPatientAccountStatus({ patientId, isActive }) {
  void pushNotification({
    recipientRole: 'patient',
    recipientId: String(patientId),
    title: 'Account status',
    message: isActive ? 'Your account has been activated.' : 'Your account has been deactivated. Contact the clinic if you need help.',
    type: 'account_status',
    meta: { isActive },
    i18n: {
      templateId: isActive ? 'patient_account_active' : 'patient_account_deactivated',
      params: {}
    }
  })
}

export function notifyReceptionistAccountStatus({ receptionistId, isActive }) {
  void pushNotification({
    recipientRole: 'receptionist',
    recipientId: String(receptionistId),
    title: 'Account status',
    message: isActive ? 'Your reception account has been activated.' : 'Your reception account has been disabled.',
    type: 'account_status',
    meta: { isActive }
  })
}
