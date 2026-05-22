export const INSURANCE_VERIFICATION = {
  NONE: 'none',
  PENDING: 'pending',
  APPROVED: 'approved',
  DECLINED: 'declined'
}

const INSURANCE_DATA_FIELDS = ['provider', 'fullName', 'birthDate', 'idNumber', 'expiryDate', 'medicalCardPhoto']

export const isInsuranceExpired = (expiryDate) => {
  if (!expiryDate || typeof expiryDate !== 'string') return false
  const expiry = new Date(`${expiryDate}T23:59:59.999`)
  if (Number.isNaN(expiry.getTime())) return false
  return expiry.getTime() < Date.now()
}

export const getEffectiveVerificationStatus = (insurance = {}) => {
  if (!insurance?.enabled) return INSURANCE_VERIFICATION.NONE
  const status = String(insurance.verificationStatus || '').trim()
  if (Object.values(INSURANCE_VERIFICATION).includes(status)) return status
  return INSURANCE_VERIFICATION.PENDING
}

const insuranceDataChanged = (existing = {}, next = {}) =>
  INSURANCE_DATA_FIELDS.some((field) => String(existing[field] || '').trim() !== String(next[field] || '').trim())

export const attachInsuranceVerification = (insurance, { updatedBy = 'patient', existingInsurance = {}, verifiedBy = '' } = {}) => {
  if (!insurance?.enabled) {
    return {
      ...insurance,
      verificationStatus: INSURANCE_VERIFICATION.NONE,
      verifiedAt: 0,
      verifiedBy: '',
      declineReason: '',
      lastCheckedAt: 0,
      lastCheckedBy: ''
    }
  }

  const changed = insuranceDataChanged(existingInsurance, insurance)
  const previousStatus = getEffectiveVerificationStatus(existingInsurance)

  if (updatedBy === 'patient' || changed) {
    return {
      ...insurance,
      verificationStatus: INSURANCE_VERIFICATION.PENDING,
      verifiedAt: 0,
      verifiedBy: '',
      declineReason: ''
    }
  }

  if (updatedBy === 'receptionist' && !existingInsurance?.enabled) {
    return {
      ...insurance,
      verificationStatus: INSURANCE_VERIFICATION.APPROVED,
      verifiedAt: Date.now(),
      verifiedBy: verifiedBy || 'receptionist',
      declineReason: ''
    }
  }

  return {
    ...insurance,
    verificationStatus: previousStatus === INSURANCE_VERIFICATION.NONE ? INSURANCE_VERIFICATION.PENDING : previousStatus,
    verifiedAt: existingInsurance.verifiedAt || 0,
    verifiedBy: existingInsurance.verifiedBy || '',
    declineReason: existingInsurance.declineReason || ''
  }
}

export const applyVerificationDecision = (insurance, { status, verifiedBy = '', declineReason = '' }) => {
  if (!insurance?.enabled) {
    throw new Error('Patient does not have insurance on file')
  }

  const normalized = String(status || '').trim().toLowerCase()
  if (![INSURANCE_VERIFICATION.APPROVED, INSURANCE_VERIFICATION.DECLINED].includes(normalized)) {
    throw new Error('Verification status must be approved or declined')
  }

  if (normalized === INSURANCE_VERIFICATION.APPROVED && isInsuranceExpired(insurance.expiryDate)) {
    throw new Error('Insurance card is expired. Update expiry date or decline coverage.')
  }

  if (normalized === INSURANCE_VERIFICATION.DECLINED && !String(declineReason || '').trim()) {
    throw new Error('Please provide a reason when declining insurance')
  }

  const now = Date.now()
  return {
    ...insurance,
    verificationStatus: normalized,
    verifiedAt: now,
    verifiedBy: verifiedBy || 'receptionist',
    declineReason: normalized === INSURANCE_VERIFICATION.DECLINED ? String(declineReason || '').trim() : '',
    lastCheckedAt: now,
    lastCheckedBy: verifiedBy || 'receptionist'
  }
}

export const buildInsuranceVisitCheck = ({ status, checkedBy = '', note = '' }) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (!['approved', 'declined'].includes(normalized)) {
    throw new Error('Visit insurance check must be approved or declined')
  }
  return {
    status: normalized,
    checkedAt: Date.now(),
    checkedBy: checkedBy || 'receptionist',
    note: String(note || '').trim()
  }
}

export const sanitizeInsuranceForClient = (insurance = {}) => {
  if (!insurance || typeof insurance !== 'object') return { enabled: false, verificationStatus: INSURANCE_VERIFICATION.NONE }
  return {
    enabled: Boolean(insurance.enabled),
    provider: insurance.provider || '',
    fullName: insurance.fullName || '',
    birthDate: insurance.birthDate || '',
    idNumber: insurance.idNumber || '',
    expiryDate: insurance.expiryDate || '',
    medicalCardPhoto: insurance.medicalCardPhoto || '',
    updatedAt: insurance.updatedAt || 0,
    updatedBy: insurance.updatedBy || '',
    verificationStatus: getEffectiveVerificationStatus(insurance),
    verifiedAt: insurance.verifiedAt || 0,
    verifiedBy: insurance.verifiedBy || '',
    declineReason: insurance.declineReason || '',
    lastCheckedAt: insurance.lastCheckedAt || 0,
    lastCheckedBy: insurance.lastCheckedBy || '',
    expired: isInsuranceExpired(insurance.expiryDate)
  }
}
