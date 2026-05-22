import siteSettingModel from '../models/siteSettingModel.js'

const SETTING_KEY = 'site-settings'

export const VISIT_FEE_TYPES = ['examination', 'consultation']

export const DEFAULT_GLOBAL_VISIT_FEES = {
  enabled: false,
  examinationFee: 0,
  consultationFee: 0
}

export const normalizeVisitFeeType = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'consultation' || raw === 'istishara' || raw === 'استشارة' || raw === 'استشاره') {
    return 'consultation'
  }
  return 'examination'
}

export const normalizeGlobalVisitFees = (raw = {}) => {
  const enabled = Boolean(raw.enabled)
  const examinationFee = Math.max(0, Number(raw.examinationFee ?? DEFAULT_GLOBAL_VISIT_FEES.examinationFee) || 0)
  const consultationFee = Math.max(0, Number(raw.consultationFee ?? DEFAULT_GLOBAL_VISIT_FEES.consultationFee) || 0)

  return { enabled, examinationFee, consultationFee }
}

export const getGlobalVisitFeesSettings = async () => {
  const doc = await siteSettingModel.findOne({ key: SETTING_KEY }).select('globalVisitFees').lean()
  return normalizeGlobalVisitFees(doc?.globalVisitFees)
}

/** True when admin set a per-doctor examination fee (non-empty). */
export const hasDoctorCustomVisitFees = (doctor) => {
  const raw = doctor?.fees
  if (raw === null || raw === undefined) return false
  return String(raw).trim() !== ''
}

/** Effective visit fee: per-doctor fees override global when set; otherwise global (if enabled). */
export const resolveVisitFeeAmount = (doctor, visitFeeType, globalVisitFees = DEFAULT_GLOBAL_VISIT_FEES) => {
  const type = normalizeVisitFeeType(visitFeeType)
  const settings = normalizeGlobalVisitFees(globalVisitFees)
  const examinationFromDoctor = Math.max(0, Number(doctor?.fees || 0))

  if (hasDoctorCustomVisitFees(doctor)) {
    if (type === 'examination') return examinationFromDoctor
    return examinationFromDoctor > 0
      ? Math.round(examinationFromDoctor * 0.75 * 100) / 100
      : 0
  }

  if (settings.enabled) {
    return type === 'consultation' ? settings.consultationFee : settings.examinationFee
  }

  if (type === 'examination') return examinationFromDoctor

  const fallbackConsultation = examinationFromDoctor > 0
    ? Math.round(examinationFromDoctor * 0.75 * 100) / 100
    : 0
  return fallbackConsultation
}

export const getVisitFeeQuote = async (doctor, visitFeeType) => {
  const globalVisitFees = await getGlobalVisitFeesSettings()
  const type = normalizeVisitFeeType(visitFeeType)
  return {
    visitFeeType: type,
    amount: resolveVisitFeeAmount(doctor, type, globalVisitFees),
    examinationAmount: resolveVisitFeeAmount(doctor, 'examination', globalVisitFees),
    consultationAmount: resolveVisitFeeAmount(doctor, 'consultation', globalVisitFees),
    globalVisitFees
  }
}
