export const DEFAULT_GLOBAL_VISIT_FEES = {
  enabled: false,
  examinationFee: 0,
  consultationFee: 0
}

export const normalizeGlobalVisitFees = (raw = {}) => ({
  enabled: Boolean(raw?.enabled),
  examinationFee: Math.max(0, Number(raw?.examinationFee ?? DEFAULT_GLOBAL_VISIT_FEES.examinationFee) || 0),
  consultationFee: Math.max(0, Number(raw?.consultationFee ?? DEFAULT_GLOBAL_VISIT_FEES.consultationFee) || 0)
})

export const hasDoctorCustomVisitFees = (doctor) => {
  const raw = doctor?.fees
  if (raw === null || raw === undefined) return false
  return String(raw).trim() !== ''
}
