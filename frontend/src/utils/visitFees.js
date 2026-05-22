import { computeHomeVisitSurcharge, DEFAULT_HOME_VISIT_PRICING, normalizeHomeVisitPricing } from './homeVisitPricing.js'
import { payableAfterPromoDiscount } from './promo.js'

export const DEFAULT_GLOBAL_VISIT_FEES = {
  enabled: false,
  examinationFee: 0,
  consultationFee: 0
}

export const normalizeVisitFeeType = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'consultation') return 'consultation'
  return 'examination'
}

export const normalizeGlobalVisitFees = (raw = {}) => ({
  enabled: Boolean(raw?.enabled),
  examinationFee: Math.max(0, Number(raw?.examinationFee || 0)),
  consultationFee: Math.max(0, Number(raw?.consultationFee || 0))
})

export const hasDoctorCustomVisitFees = (doctor) => {
  const raw = doctor?.fees
  if (raw === null || raw === undefined) return false
  return String(raw).trim() !== ''
}

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

  return examinationFromDoctor > 0
    ? Math.round(examinationFromDoctor * 0.75 * 100) / 100
    : 0
}

export const computeAppointmentPayableForVisit = (
  doctor,
  visitFeeType,
  discountAmount,
  appointmentType,
  globalVisitFees = DEFAULT_GLOBAL_VISIT_FEES,
  homeVisitPricing = DEFAULT_HOME_VISIT_PRICING
) => {
  const baseFee = resolveVisitFeeAmount(doctor, visitFeeType, globalVisitFees)
  const consult = payableAfterPromoDiscount(baseFee, discountAmount)
  const examinationBase = resolveVisitFeeAmount(doctor, 'examination', globalVisitFees)
  const surcharge = appointmentType === 'Home Visit'
    ? computeHomeVisitSurcharge(examinationBase, homeVisitPricing)
    : 0
  return consult + surcharge
}
