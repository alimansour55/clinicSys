import auditLogModel from '../models/auditLogModel.js'
import siteSettingModel from '../models/siteSettingModel.js'

const SETTING_KEY = 'site-settings'

const DEFAULT_SECURITY_SETTINGS = {
  mfaEnabled: false,
  mfaRequiredGlobally: false,
  mfaAllowUserOptIn: true,
  adminMfa: {
    enabled: false,
    secret: '',
    configuredAt: 0,
    resetAt: 0
  },
  mfaRequiredForAdmins: false,
  mfaRequiredForDoctors: false,
  mfaRequiredForReceptionists: false,
  mfaRequiredForPatients: false,
  enforceStrongPasswords: true,
  passwordMinLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialCharacter: true,
  preventCommonPasswords: true,
  passwordExpiryDays: 180,
  maxLoginAttempts: 5,
  lockoutMinutes: 15,
  sessionTimeoutMinutes: 60,
  auditLogsEnabled: true,
  auditLogRetentionDays: 365,
  dataRetentionDays: 2555,
  inactiveAccountRetentionDays: 730,
  allowPatientSelfRegistration: true,
  requireEmailVerification: false,
  enforceHttpsOnly: true,
  allowIpTracking: true
}

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'admin123',
  'letmein',
  'welcome',
  'clinic123'
])

const clampNumber = (value, fallback, min, max) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

const normalizeBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  return value === 'true' || value === '1' || value === 'on'
}

const normalizeSecuritySettings = (source = {}) => {
  const merged = { ...DEFAULT_SECURITY_SETTINGS, ...(source || {}) }

  return {
    mfaEnabled: normalizeBoolean(merged.mfaEnabled, DEFAULT_SECURITY_SETTINGS.mfaEnabled),
    mfaRequiredGlobally: normalizeBoolean(merged.mfaRequiredGlobally, DEFAULT_SECURITY_SETTINGS.mfaRequiredGlobally),
    mfaAllowUserOptIn: normalizeBoolean(merged.mfaAllowUserOptIn, DEFAULT_SECURITY_SETTINGS.mfaAllowUserOptIn),
    adminMfa: {
      enabled: normalizeBoolean(merged.adminMfa?.enabled, DEFAULT_SECURITY_SETTINGS.adminMfa.enabled),
      secret: String(merged.adminMfa?.secret || ''),
      configuredAt: Number(merged.adminMfa?.configuredAt || 0),
      resetAt: Number(merged.adminMfa?.resetAt || 0)
    },
    mfaRequiredForAdmins: normalizeBoolean(merged.mfaRequiredForAdmins, DEFAULT_SECURITY_SETTINGS.mfaRequiredForAdmins),
    mfaRequiredForDoctors: normalizeBoolean(merged.mfaRequiredForDoctors, DEFAULT_SECURITY_SETTINGS.mfaRequiredForDoctors),
    mfaRequiredForReceptionists: normalizeBoolean(merged.mfaRequiredForReceptionists, DEFAULT_SECURITY_SETTINGS.mfaRequiredForReceptionists),
    mfaRequiredForPatients: normalizeBoolean(merged.mfaRequiredForPatients, DEFAULT_SECURITY_SETTINGS.mfaRequiredForPatients),
    enforceStrongPasswords: normalizeBoolean(merged.enforceStrongPasswords, DEFAULT_SECURITY_SETTINGS.enforceStrongPasswords),
    passwordMinLength: clampNumber(merged.passwordMinLength, DEFAULT_SECURITY_SETTINGS.passwordMinLength, 6, 128),
    requireUppercase: normalizeBoolean(merged.requireUppercase, DEFAULT_SECURITY_SETTINGS.requireUppercase),
    requireLowercase: normalizeBoolean(merged.requireLowercase, DEFAULT_SECURITY_SETTINGS.requireLowercase),
    requireNumber: normalizeBoolean(merged.requireNumber, DEFAULT_SECURITY_SETTINGS.requireNumber),
    requireSpecialCharacter: normalizeBoolean(merged.requireSpecialCharacter, DEFAULT_SECURITY_SETTINGS.requireSpecialCharacter),
    preventCommonPasswords: normalizeBoolean(merged.preventCommonPasswords, DEFAULT_SECURITY_SETTINGS.preventCommonPasswords),
    passwordExpiryDays: clampNumber(merged.passwordExpiryDays, DEFAULT_SECURITY_SETTINGS.passwordExpiryDays, 0, 3650),
    maxLoginAttempts: clampNumber(merged.maxLoginAttempts, DEFAULT_SECURITY_SETTINGS.maxLoginAttempts, 3, 20),
    lockoutMinutes: clampNumber(merged.lockoutMinutes, DEFAULT_SECURITY_SETTINGS.lockoutMinutes, 1, 1440),
    sessionTimeoutMinutes: clampNumber(merged.sessionTimeoutMinutes, DEFAULT_SECURITY_SETTINGS.sessionTimeoutMinutes, 5, 1440),
    auditLogsEnabled: normalizeBoolean(merged.auditLogsEnabled, DEFAULT_SECURITY_SETTINGS.auditLogsEnabled),
    auditLogRetentionDays: clampNumber(merged.auditLogRetentionDays, DEFAULT_SECURITY_SETTINGS.auditLogRetentionDays, 30, 3650),
    dataRetentionDays: clampNumber(merged.dataRetentionDays, DEFAULT_SECURITY_SETTINGS.dataRetentionDays, 30, 3650),
    inactiveAccountRetentionDays: clampNumber(merged.inactiveAccountRetentionDays, DEFAULT_SECURITY_SETTINGS.inactiveAccountRetentionDays, 30, 3650),
    allowPatientSelfRegistration: normalizeBoolean(merged.allowPatientSelfRegistration, DEFAULT_SECURITY_SETTINGS.allowPatientSelfRegistration),
    requireEmailVerification: normalizeBoolean(merged.requireEmailVerification, DEFAULT_SECURITY_SETTINGS.requireEmailVerification),
    enforceHttpsOnly: normalizeBoolean(merged.enforceHttpsOnly, DEFAULT_SECURITY_SETTINGS.enforceHttpsOnly),
    allowIpTracking: normalizeBoolean(merged.allowIpTracking, DEFAULT_SECURITY_SETTINGS.allowIpTracking)
  }
}

const isMfaRequiredForProfile = (security, role, profile = {}) => {
  if (security.mfaRequiredGlobally) return true
  if (!security.mfaEnabled) return Boolean(profile.mfa?.enabled || profile.mfa?.requiredByAdmin)
  if (profile.mfa?.requiredByAdmin) return true

  const roleFlags = {
    admin: security.mfaRequiredForAdmins,
    doctor: security.mfaRequiredForDoctors,
    receptionist: security.mfaRequiredForReceptionists,
    patient: security.mfaRequiredForPatients
  }

  return Boolean(roleFlags[role] || profile.mfa?.enabled)
}

const getSecuritySettings = async () => {
  const settings = await siteSettingModel.findOne({ key: SETTING_KEY }).select('security')
  return normalizeSecuritySettings(settings?.security?.toObject?.() || settings?.security || {})
}

const validatePasswordAgainstPolicy = async (password) => {
  const policy = await getSecuritySettings()
  const value = String(password || '')

  if (!value) return { valid: false, message: 'Password is required', policy }
  if (value.length < policy.passwordMinLength) {
    return { valid: false, message: `Password must be at least ${policy.passwordMinLength} characters`, policy }
  }

  if (!policy.enforceStrongPasswords) return { valid: true, policy }

  if (policy.requireUppercase && !/[A-Z]/.test(value)) {
    return { valid: false, message: 'Password must include an uppercase letter', policy }
  }
  if (policy.requireLowercase && !/[a-z]/.test(value)) {
    return { valid: false, message: 'Password must include a lowercase letter', policy }
  }
  if (policy.requireNumber && !/[0-9]/.test(value)) {
    return { valid: false, message: 'Password must include a number', policy }
  }
  if (policy.requireSpecialCharacter && !/[^A-Za-z0-9]/.test(value)) {
    return { valid: false, message: 'Password must include a special character', policy }
  }
  if (policy.preventCommonPasswords && COMMON_PASSWORDS.has(value.toLowerCase())) {
    return { valid: false, message: 'Password is too common. Please choose a stronger password', policy }
  }

  return { valid: true, policy }
}

const purgeExpiredAuditLogs = async () => {
  const policy = await getSecuritySettings()
  if (!policy.auditLogsEnabled) return { deletedCount: 0, retentionDays: policy.auditLogRetentionDays }

  const cutoff = new Date(Date.now() - policy.auditLogRetentionDays * 24 * 60 * 60 * 1000)
  const result = await auditLogModel.deleteMany({ createdAt: { $lt: cutoff } })
  return { deletedCount: result.deletedCount || 0, retentionDays: policy.auditLogRetentionDays }
}

export {
  DEFAULT_SECURITY_SETTINGS,
  getSecuritySettings,
  isMfaRequiredForProfile,
  normalizeSecuritySettings,
  purgeExpiredAuditLogs,
  validatePasswordAgainstPolicy
}
