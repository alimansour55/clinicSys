/**
 * Patient notification copy: English + Arabic templates keyed by `meta.i18n.templateId`.
 * When adding new notification types from the backend, register the template here
 * and pass the same `templateId` + `params` from `pushNotification` (see notificationService.js).
 */

import { localizeWesternDigits } from './arabicNumerals.js'

const fill = (tpl, params = {}) =>
  String(tpl || '').replace(/\{\{(\w+)\}\}/g, (_, k) =>
    params[k] != null && params[k] !== '' ? String(params[k]) : ''
  )

const APPOINTMENT_STATUS = {
  Booked: { en: 'Booked', ar: 'محجوز' },
  'Checked In': { en: 'Checked in', ar: 'تم الحضور' },
  'In Progress': { en: 'In progress', ar: 'جاري الكشف' },
  Finished: { en: 'Finished', ar: 'منتهي' },
  Cancelled: { en: 'Cancelled', ar: 'ملغي' }
}

const statusLabel = (code, lang) => {
  const c = String(code || '').trim()
  if (!c || c === '—' || c === '-') return '—'
  const row = APPOINTMENT_STATUS[c]
  if (!row) return c
  return lang === 'ar' ? row.ar : row.en
}

const CANCELLED_BY = {
  patient: { en: 'Patient', ar: 'المريض' },
  doctor: { en: 'Doctor', ar: 'الطبيب' },
  receptionist: { en: 'Reception', ar: 'الاستقبال' },
  admin: { en: 'Admin', ar: 'الإدارة' }
}

const cancelledByLabel = (key, lang) => {
  const row = CANCELLED_BY[key] || CANCELLED_BY.admin
  return lang === 'ar' ? row.ar : row.en
}

const PAYMENT_SOURCE = {
  front_desk: { en: 'Front desk', ar: 'الاستقبال' },
  online: { en: 'Online payment', ar: 'الدفع الإلكتروني' },
  other: { en: 'Payment', ar: 'الدفع' }
}

const paymentSourceLabel = (key, lang) => {
  const row = PAYMENT_SOURCE[key] || PAYMENT_SOURCE.other
  return lang === 'ar' ? row.ar : row.en
}

const TEMPLATES = {
  patient_appt_booked_reception: {
    title: { en: 'Appointment confirmed', ar: 'تم تأكيد الموعد' },
    message: {
      en: 'A visit with Dr. {{doctorName}} was scheduled for you ({{when}}).',
      ar: 'تم حجز زيارة مع د. {{doctorName}} لك ({{when}}).'
    }
  },
  patient_appt_booked_self: {
    title: { en: 'Appointment confirmed', ar: 'تم تأكيد الموعد' },
    message: {
      en: 'Your visit with Dr. {{doctorName}} is booked ({{when}}).',
      ar: 'تم حجز زيارتك مع د. {{doctorName}} ({{when}}).'
    }
  },
  patient_appt_cancelled: {
    title: { en: 'Appointment cancelled', ar: 'تم إلغاء الموعد' },
    message: {
      en: 'Your appointment with Dr. {{doctorName}} ({{when}}) was cancelled ({{by}}).',
      ar: 'تم إلغاء موعدك مع د. {{doctorName}} ({{when}}) بواسطة {{by}}.'
    }
  },
  patient_appt_status: {
    title: { en: 'Appointment updated', ar: 'تحديث الموعد' },
    message: {
      en: 'Status is now “{{nextStatus}}” (was {{previousStatus}}).',
      ar: 'الحالة الآن «{{nextStatus}}» (كانت {{previousStatus}}).'
    }
  },
  patient_payment_paid: {
    title: { en: 'Payment recorded', ar: 'تم تسجيل الدفع' },
    message: {
      en: '{{source}}: your visit with Dr. {{doctorName}} ({{when}}) is marked paid.',
      ar: '{{source}}: زيارتك مع د. {{doctorName}} ({{when}}) أصبحت مدفوعة.'
    }
  },
  patient_visit_completed: {
    title: { en: 'Visit completed', ar: 'اكتملت الزيارة' },
    message: {
      en: 'Your visit with Dr. {{doctorName}} ({{when}}) is finished. Your prescription is available in My Appointments.',
      ar: 'انتهت زيارتك مع د. {{doctorName}} ({{when}}). يمكنك الاطلاع على الوصفة من صفحة مواعيدي.'
    }
  },
  patient_account_active: {
    title: { en: 'Account status', ar: 'حالة الحساب' },
    message: {
      en: 'Your account has been activated.',
      ar: 'تم تفعيل حسابك.'
    }
  },
  patient_account_deactivated: {
    title: { en: 'Account status', ar: 'حالة الحساب' },
    message: {
      en: 'Your account has been deactivated. Contact the clinic if you need help.',
      ar: 'تم تعطيل حسابك. تواصل مع العيادة إذا كنت بحاجة إلى مساعدة.'
    }
  },
  patient_profile_admin_generic: {
    title: { en: 'Profile updated', ar: 'تحديث الملف' },
    message: {
      en: 'An administrator updated your profile.',
      ar: 'قام أحد المسؤولين بتحديث ملفك.'
    }
  },
  patient_profile_admin_detail: {
    title: { en: 'Profile updated', ar: 'تحديث الملف' },
    message: {
      en: '{{detail}}',
      ar: '{{detail}}'
    }
  }
}

function enrichParams(templateId, params, lang) {
  const out = { ...params }

  if (templateId === 'patient_appt_cancelled' && params.byKey) {
    out.by = cancelledByLabel(String(params.byKey).toLowerCase(), lang)
  }

  if (templateId === 'patient_appt_status') {
    out.nextStatus = statusLabel(params.nextStatus, lang)
    out.previousStatus = statusLabel(params.previousStatus, lang)
  }

  if (templateId === 'patient_payment_paid' && params.sourceKey) {
    out.source = paymentSourceLabel(String(params.sourceKey).toLowerCase(), lang)
  }

  return out
}

/**
 * @param {object} n - notification document from API
 * @param {string} language - 'ar' | 'en'
 */
export function formatPatientNotification(n, language) {
  const title = n?.title ?? ''
  const message = n?.message ?? ''
  const pack = n?.meta?.i18n
  if (!pack?.templateId) {
    return { title, message }
  }
  const tpl = TEMPLATES[pack.templateId]
  if (!tpl) {
    return { title, message }
  }
  const lang = language === 'ar' ? 'ar' : 'en'
  const params = enrichParams(pack.templateId, pack.params || {}, lang)
  return {
    title: fill(tpl.title[lang], params),
    message: fill(tpl.message[lang], params)
  }
}

const RTF_LOCALE = { en: 'en', ar: 'ar-EG' }

/** Relative time for notification timestamps (past only). */
export function formatNotificationRelativeTime(iso, language) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  const locale = RTF_LOCALE[language === 'ar' ? 'ar' : 'en'] || 'en'
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  let s
  if (diffSec < 60) s = rtf.format(-diffSec, 'second')
  else {
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) s = rtf.format(-diffMin, 'minute')
    else {
      const diffHr = Math.floor(diffMin / 60)
      if (diffHr < 24) s = rtf.format(-diffHr, 'hour')
      else {
        const diffDay = Math.floor(diffHr / 24)
        if (diffDay < 30) s = rtf.format(-diffDay, 'day')
        else {
          const diffMonth = Math.floor(diffDay / 30)
          if (diffMonth < 12) s = rtf.format(-diffMonth, 'month')
          else s = rtf.format(-Math.floor(diffDay / 365), 'year')
        }
      }
    }
  }
  return localizeWesternDigits(s, language)
}
